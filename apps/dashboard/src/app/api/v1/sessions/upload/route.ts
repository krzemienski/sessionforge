import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
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
    const validatedFiles = [];

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

      validatedFiles.push({
        name: file.name,
        size: file.size,
        type: fileExtension,
      });
    }

    // TODO: Process files (will be implemented in phase 2)
    // For now, return success with file information
    return NextResponse.json({
      success: true,
      filesReceived: validatedFiles.length,
      files: validatedFiles,
      message: "Files validated successfully (processing not yet implemented)",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    );
  }
}
