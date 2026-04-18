import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { validateBackupBundle } from "@/lib/backup/validator";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
  safeLoadZip,
  safeReadEntryString,
  ZipLimitExceededError,
} from "@/lib/safe-unzip";

export const dynamic = "force-dynamic";

const MAX_BUNDLE_SIZE = 50 * 1024 * 1024;

const BACKUP_ZIP_LIMITS = {
  maxEntries: 5000,
  maxEntrySize: 50 * 1024 * 1024,
  maxTotalSize: 500 * 1024 * 1024,
};

/**
 * Parses a backup markdown file that has YAML-like frontmatter between --- delimiters.
 * Returns an object containing all frontmatter fields plus a `markdown` body field.
 */
function parsePostFile(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatterLines = match[1].split("\n");
  const markdownBody = content.slice(match[0].length).trimStart();

  const result: Record<string, unknown> = { markdown: markdownBody };

  for (const line of frontmatterLines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();

    if (!key) continue;

    // Attempt JSON parse for quoted strings, arrays, and objects; fall back to raw string.
    try {
      result[key] = JSON.parse(rawValue);
    } catch {
      result[key] = rawValue === "null" ? null : rawValue;
    }
  }

  return result;
}

export async function POST(req: Request) {
  return withApiHandler(async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) throw new AppError("Unauthorized", ERROR_CODES.UNAUTHORIZED);

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      throw new AppError("Expected multipart/form-data", ERROR_CODES.BAD_REQUEST);
    }

    const formData = await req.formData();
    const file = formData.get("bundle");

    if (!file || !(file instanceof File)) {
      throw new AppError("bundle field is required", ERROR_CODES.BAD_REQUEST);
    }

    if (file.size > MAX_BUNDLE_SIZE) {
      throw new AppError("Bundle exceeds 50 MB limit", ERROR_CODES.BAD_REQUEST);
    }

    const arrayBuffer = await file.arrayBuffer();
    let loaded: Awaited<ReturnType<typeof safeLoadZip>>;
    try {
      loaded = await safeLoadZip(arrayBuffer, BACKUP_ZIP_LIMITS);
    } catch (err) {
      if (err instanceof ZipLimitExceededError) {
        throw new AppError(`Zip rejected: ${err.message}`, ERROR_CODES.BAD_REQUEST);
      }
      throw new AppError("Invalid ZIP file", ERROR_CODES.BAD_REQUEST);
    }

    let manifest: unknown = null;
    if (loaded.zip.file("manifest.json")) {
      try {
        const manifestText = await safeReadEntryString(loaded, "manifest.json");
        manifest = JSON.parse(manifestText);
      } catch (err) {
        if (err instanceof ZipLimitExceededError) {
          throw new AppError(`Zip rejected: ${err.message}`, ERROR_CODES.BAD_REQUEST);
        }
        manifest = null;
      }
    }

    const posts: unknown[] = [];
    const postEntryNames = loaded.entryNames.filter(
      (name) => name.startsWith("posts/") && name.endsWith(".md"),
    );

    for (const entryName of postEntryNames) {
      try {
        const content = await safeReadEntryString(loaded, entryName);
        const parsed = parsePostFile(content);
        if (parsed) posts.push(parsed);
      } catch (err) {
        if (err instanceof ZipLimitExceededError) {
          throw new AppError(`Zip rejected: ${err.message}`, ERROR_CODES.BAD_REQUEST);
        }
        throw err;
      }
    }

    let series: unknown[] = [];
    if (loaded.zip.file("series/series.json")) {
      try {
        const seriesText = await safeReadEntryString(loaded, "series/series.json");
        const parsed = JSON.parse(seriesText);
        if (Array.isArray(parsed)) series = parsed;
      } catch (err) {
        if (err instanceof ZipLimitExceededError) {
          throw new AppError(`Zip rejected: ${err.message}`, ERROR_CODES.BAD_REQUEST);
        }
        series = [];
      }
    }

    const bundle = { manifest, posts, series };
    const report = validateBackupBundle(bundle);

    return NextResponse.json(report);
  })(req);
}
