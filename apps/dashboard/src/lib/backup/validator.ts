import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
} from "./backup-bundle";
import type {
  BackupBundle,
  BackupManifest,
  BackupablePost,
  BackupSeries,
} from "./backup-bundle";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  compatibilityNotes: string[];
  postCount: number;
  seriesCount: number;
}

// ── Required fields ───────────────────────────────────────────────────────────

const REQUIRED_POST_FIELDS: (keyof BackupablePost)[] = [
  "id",
  "title",
  "markdown",
  "contentType",
];

const REQUIRED_MANIFEST_FIELDS: (keyof BackupManifest)[] = [
  "bundleFormat",
  "version",
  "exportedAt",
  "postCount",
  "seriesCount",
  "workspace",
];

// ── Validators ────────────────────────────────────────────────────────────────

function validateManifest(
  manifest: unknown,
  errors: string[],
  warnings: string[],
  compatibilityNotes: string[]
): asserts manifest is BackupManifest {
  if (manifest === null || typeof manifest !== "object") {
    errors.push("manifest.json is missing or invalid");
    return;
  }

  const m = manifest as Record<string, unknown>;

  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!(field in m) || m[field] === undefined || m[field] === null) {
      errors.push(`manifest.json is missing required field: ${field}`);
    }
  }

  if (m.bundleFormat !== undefined && m.bundleFormat !== BACKUP_FORMAT) {
    errors.push(
      `Unrecognised bundleFormat "${m.bundleFormat}". Expected "${BACKUP_FORMAT}".`
    );
  }

  if (m.version !== undefined && m.version !== BACKUP_VERSION) {
    compatibilityNotes.push(
      `Bundle version "${m.version}" differs from current version "${BACKUP_VERSION}". Some fields may not be supported.`
    );
  }

  if (m.exportedAt !== undefined && typeof m.exportedAt === "string") {
    const parsed = Date.parse(m.exportedAt);
    if (Number.isNaN(parsed)) {
      errors.push(
        `manifest.json exportedAt "${m.exportedAt}" is not a valid ISO timestamp`
      );
    }
  }

  const knownFields = new Set<string>([
    ...REQUIRED_MANIFEST_FIELDS,
  ]);
  for (const key of Object.keys(m)) {
    if (!knownFields.has(key)) {
      warnings.push(`manifest.json contains unknown field: "${key}"`);
    }
  }
}

function validatePost(
  post: unknown,
  index: number,
  errors: string[],
  warnings: string[]
): void {
  if (post === null || typeof post !== "object") {
    errors.push(`Post at index ${index} is not a valid object`);
    return;
  }

  const p = post as Record<string, unknown>;

  for (const field of REQUIRED_POST_FIELDS) {
    if (!(field in p) || p[field] === undefined || p[field] === null) {
      const label = p.id ? `post "${p.id as string}"` : `post at index ${index}`;
      errors.push(`${label} is missing required field: ${field}`);
    }
  }

  if (typeof p.markdown === "string" && p.markdown.trim() === "") {
    const label = p.id ? `post "${p.id as string}"` : `post at index ${index}`;
    warnings.push(`${label} has an empty markdown body`);
  }
}

function validateSeries(
  series: unknown[],
  postIds: Set<string>,
  errors: string[]
): void {
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    if (s === null || typeof s !== "object") {
      errors.push(`Series at index ${i} is not a valid object`);
      continue;
    }

    const sr = s as Record<string, unknown>;
    const seriesLabel = sr.id
      ? `series "${sr.id as string}"`
      : `series at index ${i}`;

    if (!Array.isArray(sr.posts)) {
      errors.push(`${seriesLabel} is missing a posts array`);
      continue;
    }

    for (const sp of sr.posts as unknown[]) {
      if (sp === null || typeof sp !== "object") {
        errors.push(`${seriesLabel} contains an invalid series post entry`);
        continue;
      }

      const spObj = sp as Record<string, unknown>;
      const postId = spObj.postId;

      if (typeof postId !== "string") {
        errors.push(`${seriesLabel} contains a series post with no postId`);
        continue;
      }

      if (!postIds.has(postId)) {
        errors.push(
          `${seriesLabel} references postId "${postId}" which does not exist in the bundle`
        );
      }
    }
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Validates a parsed backup bundle object.
 * Returns a structured ValidationReport containing errors, warnings, and
 * compatibility notes. A bundle is considered valid when errors is empty.
 */
export function validateBackupBundle(bundle: unknown): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const compatibilityNotes: string[] = [];

  if (bundle === null || typeof bundle !== "object") {
    errors.push("Bundle is not a valid object");
    return { valid: false, errors, warnings, compatibilityNotes, postCount: 0, seriesCount: 0 };
  }

  const b = bundle as Record<string, unknown>;

  // ── Manifest ────────────────────────────────────────────────────────────────

  if (!("manifest" in b) || b.manifest === undefined || b.manifest === null) {
    errors.push("manifest.json is missing or invalid");
  } else {
    validateManifest(b.manifest, errors, warnings, compatibilityNotes);
  }

  // ── Posts ───────────────────────────────────────────────────────────────────

  const posts = b.posts;
  if (!Array.isArray(posts)) {
    errors.push("Bundle is missing the posts array");
  } else {
    for (let i = 0; i < posts.length; i++) {
      validatePost(posts[i], i, errors, warnings);
    }
  }

  // ── Series ──────────────────────────────────────────────────────────────────

  const series = b.series;
  if (!Array.isArray(series)) {
    errors.push("Bundle is missing the series array");
  } else {
    const postIds = new Set<string>(
      Array.isArray(posts)
        ? posts
            .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
            .map((p) => p.id as string)
            .filter(Boolean)
        : []
    );
    validateSeries(series, postIds, errors);
  }

  const postCount = Array.isArray(posts) ? posts.length : 0;
  const seriesCount = Array.isArray(series) ? series.length : 0;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    compatibilityNotes,
    postCount,
    seriesCount,
  };
}

/**
 * Type-safe overload for callers that have already parsed a BackupBundle.
 */
export function validateTypedBackupBundle(bundle: BackupBundle): ValidationReport {
  return validateBackupBundle(bundle as unknown);
}
