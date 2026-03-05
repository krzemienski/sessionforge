import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { processUploadedFile, processZipFile } from "@/lib/sessions/upload-processor";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Get user's workspace
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, session.user.id))
      .limit(1);

    if (!workspace.length) {
      return NextResponse.json({ error: "No workspace found" }, { status: 404 });
    }

    const ws = workspace[0];

    // Extract files from multipart form data
    const formData = await req.formData();
    const files = formData.getAll("file");

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    // Validate files
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const ALLOWED_TYPES = [".jsonl", ".zip"];
    const validatedFiles: File[] = [];

    for (const file of files) {
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Invalid file format" },
          { status: 400 }
        );
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds 50MB limit` },
          { status: 400 }
        );
      }

      // Check file type
      const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if (!ALLOWED_TYPES.includes(fileExtension)) {
        return NextResponse.json(
          { error: `File ${file.name} must be .jsonl or .zip` },
          { status: 400 }
        );
      }

      validatedFiles.push(file);
    }

    // Process files
    const allResults = [];

    for (const file of validatedFiles) {
      const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

      if (fileExtension === ".jsonl") {
        // Process single .jsonl file
        const result = await processUploadedFile(file, ws.id);
        allResults.push(result);
      } else if (fileExtension === ".zip") {
        // Process zip archive containing multiple .jsonl files
        const results = await processZipFile(file, ws.id);
        allResults.push(...results);
      }
    }

    // Aggregate results
    const uploaded = allResults.length;
    const newSessions = allResults.filter(r => r.isNew === true).length;
    const updated = allResults.filter(r => r.isNew === false && r.status === "success").length;
    const errors = allResults.filter(r => r.status === "error").map(r => r.error ?? "Unknown error");

    return NextResponse.json({
      uploaded,
      new: newSessions,
      updated,
      errors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}
