/**
 * Zip-bomb defense (review finding H2).
 *
 * Decompressing a ZIP without limits lets an attacker submit a small archive
 * (tens of KB) whose entries expand to gigabytes, causing OOM or blocking the
 * event loop. Every caller that reads inbound ZIPs — session uploads, backup
 * validate/restore — must route through `safeLoadZip` + `safeReadEntry` so the
 * following caps are enforced:
 *
 *   - maxEntries: hard cap on the number of files (any type)
 *   - maxEntrySize: per-entry uncompressed byte cap
 *   - maxTotalSize: running-total uncompressed byte cap across all entries
 *
 * These caps are checked BEFORE the entry data is decompressed where possible
 * (JSZip exposes `_data.uncompressedSize`), and always re-checked against the
 * realised buffer length after decompression in case the header lied.
 */

import JSZip from "jszip";

export interface UnzipLimits {
  maxEntries: number;
  maxEntrySize: number;
  maxTotalSize: number;
}

export class ZipLimitExceededError extends Error {
  constructor(public readonly kind: "entries" | "entrySize" | "totalSize", message: string) {
    super(message);
    this.name = "ZipLimitExceededError";
  }
}

interface JSZipEntryInternal {
  _data?: { uncompressedSize?: number };
}

export interface LoadedZip {
  zip: JSZip;
  entryNames: string[];
  limits: UnzipLimits;
  consumed: { totalSize: number };
}

export async function safeLoadZip(
  data: ArrayBuffer | Uint8Array | Buffer,
  limits: UnzipLimits,
): Promise<LoadedZip> {
  const zip = await JSZip.loadAsync(data);
  const entryNames: string[] = [];

  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    entryNames.push(name);
    if (entryNames.length > limits.maxEntries) {
      throw new ZipLimitExceededError(
        "entries",
        `Archive has more than ${limits.maxEntries} file entries`,
      );
    }

    const headerSize = (entry as unknown as JSZipEntryInternal)._data?.uncompressedSize;
    if (typeof headerSize === "number" && headerSize > limits.maxEntrySize) {
      throw new ZipLimitExceededError(
        "entrySize",
        `Entry ${name} declares ${headerSize} bytes (limit ${limits.maxEntrySize})`,
      );
    }
  }

  return { zip, entryNames, limits, consumed: { totalSize: 0 } };
}

async function readEntryWithCap(
  loaded: LoadedZip,
  name: string,
  kind: "string" | "arraybuffer",
): Promise<string | ArrayBuffer> {
  const entry = loaded.zip.files[name];
  if (!entry || entry.dir) {
    throw new Error(`Zip entry not found: ${name}`);
  }

  const headerSize = (entry as unknown as JSZipEntryInternal)._data?.uncompressedSize;
  if (typeof headerSize === "number" && headerSize > loaded.limits.maxEntrySize) {
    throw new ZipLimitExceededError(
      "entrySize",
      `Entry ${name} exceeds per-entry size limit`,
    );
  }

  const buffer =
    kind === "string"
      ? await entry.async("string")
      : await entry.async("arraybuffer");
  const realised = kind === "string"
    ? Buffer.byteLength(buffer as string, "utf8")
    : (buffer as ArrayBuffer).byteLength;

  if (realised > loaded.limits.maxEntrySize) {
    throw new ZipLimitExceededError(
      "entrySize",
      `Entry ${name} decompressed to ${realised} bytes (limit ${loaded.limits.maxEntrySize})`,
    );
  }

  loaded.consumed.totalSize += realised;
  if (loaded.consumed.totalSize > loaded.limits.maxTotalSize) {
    throw new ZipLimitExceededError(
      "totalSize",
      `Archive decompressed size exceeded ${loaded.limits.maxTotalSize} bytes`,
    );
  }

  return buffer;
}

export async function safeReadEntryString(
  loaded: LoadedZip,
  name: string,
): Promise<string> {
  return (await readEntryWithCap(loaded, name, "string")) as string;
}

export async function safeReadEntryArrayBuffer(
  loaded: LoadedZip,
  name: string,
): Promise<ArrayBuffer> {
  return (await readEntryWithCap(loaded, name, "arraybuffer")) as ArrayBuffer;
}
