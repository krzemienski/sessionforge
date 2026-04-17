import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { workspaces, workspaceActivity } from "@sessionforge/db";
import { eq } from "drizzle-orm";
import { processUploadedFile, processZipFile } from "@/lib/sessions/upload-processor";
import { validateApiKey } from "@/lib/auth/api-key";
import { getAuthorizedWorkspace } from "@/lib/workspace-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { apiResponse, withV1ApiHandler } from "@/lib/api-auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const POST = withV1ApiHandler(async (req) => {
  const next = req as NextRequest;
  const authHeader = next.headers.get("Authorization");
  let workspaceId: string | undefined;
  let userId: string | undefined;

  if (authHeader) {
    const apiKeyResult = await validateApiKey(authHeader);
    if (apiKeyResult.valid) {
      workspaceId = apiKeyResult.workspaceId;
      const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId!),
        columns: { ownerId: true },
      });
      userId = workspace?.ownerId;
    } else {
      throw new AppError(
        apiKeyResult.error ?? "Invalid API key",
        ERROR_CODES.UNAUTHORIZED,
      );
    }
  } else {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);
    }

    const workspaceSlug = next.nextUrl.searchParams.get("workspace");
    if (!workspaceSlug) {
      throw new AppError(
        "workspace query param required",
        ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const { workspace } = await getAuthorizedWorkspace(
      session,
      workspaceSlug,
      PERMISSIONS.SESSIONS_SCAN,
    );

    workspaceId = workspace.id;
    userId = session.user.id;
  }

  if (!workspaceId || !userId) {
    throw new AppError("Authentication failed", ERROR_CODES.UNAUTHORIZED);
  }

  const contentType = next.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    throw new AppError(
      "Content-Type must be multipart/form-data with a 'file' field",
      ERROR_CODES.BAD_REQUEST,
    );
  }

  let formData: FormData;
  try {
    formData = await next.formData();
  } catch (err) {
    throw new AppError(
      "Invalid multipart body",
      ERROR_CODES.BAD_REQUEST,
      undefined,
      { parseError: err instanceof Error ? err.message : String(err) },
    );
  }

  const files = formData.getAll("file");
  if (files.length === 0) {
    throw new AppError("No files provided", ERROR_CODES.VALIDATION_ERROR);
  }

  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const ALLOWED_TYPES = [".jsonl", ".zip"];
  const validatedFiles: File[] = [];

  for (const file of files) {
    if (!(file instanceof File)) {
      throw new AppError("Invalid file format", ERROR_CODES.VALIDATION_ERROR);
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new AppError(
        `File ${file.name} exceeds 50MB limit`,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }
    const fileExtension = file.name
      .toLowerCase()
      .slice(file.name.lastIndexOf("."));
    if (!ALLOWED_TYPES.includes(fileExtension)) {
      throw new AppError(
        `File ${file.name} must be .jsonl or .zip`,
        ERROR_CODES.VALIDATION_ERROR,
      );
    }
    validatedFiles.push(file);
  }

  const allResults = [];
  for (const file of validatedFiles) {
    const fileExtension = file.name
      .toLowerCase()
      .slice(file.name.lastIndexOf("."));

    if (fileExtension === ".jsonl") {
      const result = await processUploadedFile(file, workspaceId);
      allResults.push(result);
    } else if (fileExtension === ".zip") {
      const results = await processZipFile(file, workspaceId);
      allResults.push(...results);
    }
  }

  const uploaded = allResults.length;
  const newSessions = allResults.filter((r) => r.isNew === true).length;
  const updated = allResults.filter(
    (r) => r.isNew === false && r.status === "success",
  ).length;
  const errors = allResults
    .filter((r) => r.status === "error")
    .map((r) => r.error ?? "Unknown error");

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

  return apiResponse({
    uploaded,
    new: newSessions,
    updated,
    errors,
  });
});
