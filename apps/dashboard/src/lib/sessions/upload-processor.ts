/**
 * Session upload processor for handling uploaded Claude JSONL session files.
 * Processes individual .jsonl files by parsing their content, normalizing the data,
 * and indexing into the database. Designed to work with in-memory File objects
 * from multipart uploads rather than filesystem-based scanning.
 */

import path from "path";
import { parseSessionBuffer } from "./parser";
import { normalizeSession } from "./normalizer";
import { indexSessions } from "./indexer";
import type { SessionFileMeta } from "./scanner";

/** Result of processing a single uploaded session file. */
export interface UploadedFileResult {
  /** UUID-style session identifier extracted from the filename. */
  sessionId: string;
  /** Processing status: 'success', 'error', or 'skipped'. */
  status: "success" | "error" | "skipped";
  /** Human-readable error message if status is 'error'. */
  error?: string;
  /** Whether this was a new session insert (true) or an update (false). */
  isNew?: boolean;
}

/**
 * Processes a single uploaded .jsonl session file.
 *
 * Extracts the session identifier from the filename, reads the file content
 * into a buffer, parses it using {@link parseSessionBuffer}, normalizes the
 * session data, and upserts it into the database via {@link indexSessions}.
 *
 * Unlike the filesystem scanner, uploaded files have no physical path on the
 * server, so `filePath` is set to a synthetic value indicating the upload source.
 * The file's last-modified time is used as the `mtime` fallback for `startedAt`.
 *
 * @param file - The uploaded File object from multipart form data.
 * @param workspaceId - The workspace that owns this session.
 * @returns An {@link UploadedFileResult} indicating success or failure.
 */
export async function processUploadedFile(
  file: File,
  workspaceId: string
): Promise<UploadedFileResult> {
  // Extract sessionId from filename (remove .jsonl extension)
  const sessionId = path.basename(file.name, ".jsonl");

  // Validate sessionId format (should be a UUID-like string)
  if (!sessionId || sessionId === file.name) {
    return {
      sessionId: file.name,
      status: "error",
      error: "Invalid filename: must end with .jsonl",
    };
  }

  try {
    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the session content
    const parsed = await parseSessionBuffer(buffer);

    // Create metadata structure similar to scanner output
    // Use file.lastModified as the mtime fallback
    const meta: SessionFileMeta = {
      filePath: `upload://${file.name}`,
      sessionId,
      projectPath: "uploaded", // Will be overridden by projectName derivation
      mtime: new Date(file.lastModified),
    };

    // Normalize the session data
    const normalized = normalizeSession(meta, parsed);

    // Index into database
    const result = await indexSessions(workspaceId, [normalized]);

    // Check if indexing succeeded
    if (result.errors.length > 0) {
      return {
        sessionId,
        status: "error",
        error: result.errors[0],
      };
    }

    return {
      sessionId,
      status: "success",
      isNew: result.new > 0,
    };
  } catch (err) {
    return {
      sessionId,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
