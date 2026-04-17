import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, workspaceActivity } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { processUploadedFile, processZipFile } from "@/lib/sessions/upload-processor";
import { validateApiKey } from "@/lib/auth/api-key";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Support both API key and session authentication
  const authHeader = req.headers.get("Authorization");
  let workspaceId: string | undefined;
  let userId: string | undefined;

  // Try API key authentication first
  if (authHeader) {
    const apiKeyResult = await validateApiKey(authHeader);
    if (apiKeyResult.valid) {
      workspaceId = apiKeyResult.workspaceId;
      // For API key auth, we'll use a system user ID (the workspace owner)
      const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId!),
        columns: { ownerId: true },
      });
      userId = workspace?.ownerId;
    } else {
      return NextResponse.json({ error: apiKeyResult.error }, { status: 401 });
    }
  } else {
    // Fall back to session authentication (for UI)
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get workspace slug from query params or form data
    const workspaceSlug = req.nextUrl.searchParams.get("workspace");

    if (!workspaceSlug) {
      return NextResponse.json(
        { error: "workspace query param required" },
        { status: 400 }
      );
    }

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.SESSIONS_SCAN
    );

    workspaceId = workspace.id;
    userId = session.user.id;
  }

  if (!workspaceId || !userId) {
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }

  // Reject upfront if request has no body or wrong content-type so we don't 500
  // on formData() parse errors.
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json(
      { error: "Content-Type must be multipart/form-data with a 'file' field" },
      { status: 400 }
    );
  }

  try {
    // Extract files from multipart form data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (err) {
      return NextResponse.json(
        {
          error: "Invalid multipart body",
          details: err instanceof Error ? err.message : String(err),
        },
        { status: 400 }
      );
    }
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
        const result = await processUploadedFile(file, workspaceId);
        allResults.push(result);
      } else if (fileExtension === ".zip") {
        // Process zip archive containing multiple .jsonl files
        const results = await processZipFile(file, workspaceId);
        allResults.push(...results);
      }
    }

    // Aggregate results
    const uploaded = allResults.length;
    const newSessions = allResults.filter(r => r.isNew === true).length;
    const updated = allResults.filter(r => r.isNew === false && r.status === "success").length;
    const errors = allResults.filter(r => r.status === "error").map(r => r.error ?? "Unknown error");

    // Log upload activity
    await db.insert(workspaceActivity).values({
      workspaceId,
      userId,
      action: "session_upload",
      resourceType: "session",
      metadata: {
        filesUploaded: validatedFiles.length,
        sessionsNew: newSessions,
        sessionsUpdated: updated,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

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
