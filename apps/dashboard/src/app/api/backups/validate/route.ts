import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { validateBackupBundle } from "@/lib/backup/validator";
import { withApiHandler } from "@/lib/api-handler";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const dynamic = "force-dynamic";

const MAX_BUNDLE_SIZE = 50 * 1024 * 1024; // 50 MB

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
    const zip = await JSZip.loadAsync(arrayBuffer);

    // ── Manifest ───────────────────────────────────────────────────────────────

    const manifestFile = zip.file("manifest.json");
    let manifest: unknown = null;
    if (manifestFile) {
      const manifestText = await manifestFile.async("string");
      try {
        manifest = JSON.parse(manifestText);
      } catch {
        manifest = null;
      }
    }

    // ── Posts ──────────────────────────────────────────────────────────────────

    const posts: unknown[] = [];
    const postFileObjects: JSZip.JSZipObject[] = [];
    zip.forEach((relativePath, zipEntry) => {
      if (
        relativePath.startsWith("posts/") &&
        relativePath.endsWith(".md") &&
        !zipEntry.dir
      ) {
        postFileObjects.push(zipEntry);
      }
    });

    for (const postFile of postFileObjects) {
      const content = await postFile.async("string");
      const parsed = parsePostFile(content);
      if (parsed) posts.push(parsed);
    }

    // ── Series ─────────────────────────────────────────────────────────────────

    let series: unknown[] = [];
    const seriesFile = zip.file("series/series.json");
    if (seriesFile) {
      const seriesText = await seriesFile.async("string");
      try {
        const parsed = JSON.parse(seriesText);
        if (Array.isArray(parsed)) series = parsed;
      } catch {
        series = [];
      }
    }

    // ── Validate ───────────────────────────────────────────────────────────────

    const bundle = { manifest, posts, series };
    const report = validateBackupBundle(bundle);

    return NextResponse.json(report);
  })(req);
}
