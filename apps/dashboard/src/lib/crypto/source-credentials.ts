/**
 * AES-256-GCM encryption for scan source credentials (SSH passwords, etc.).
 *
 * Security invariant: SCAN_SOURCE_ENCRYPTION_KEY MUST be set before any
 * password is encrypted or decrypted. Earlier revisions of this module allowed
 * a `plain:<secret>` fallback when the env var was missing so local dev could
 * proceed without setup; that silently landed plaintext credentials in Postgres
 * and was removed as part of review finding C2.
 *
 * Legacy rows persisted with the `plain:` prefix are still accepted on read
 * (and a warning is logged) so that existing data remains decryptable after an
 * operator sets the key for the first time. They should be re-saved through the
 * scan-sources UI to migrate to `enc:` ciphertext. A future migration should
 * reject `plain:` rows outright.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const envKey = process.env.SCAN_SOURCE_ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error(
      "SCAN_SOURCE_ENCRYPTION_KEY is required to encrypt or decrypt scan-source passwords. " +
        "Generate one with `openssl rand -base64 32` and set it in your environment.",
    );
  }
  return scryptSync(envKey, "sessionforge-scan-sources", KEY_LENGTH);
}

export function encryptPassword(plaintext: string): string {
  const key = getKey();

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `enc:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptPassword(stored: string): string {
  if (stored.startsWith("plain:")) {
    console.warn(
      "[scan-sources] Decrypting a legacy `plain:` password row — re-save this scan source through the UI to migrate it to AES-256-GCM.",
    );
    return stored.slice(6);
  }
  if (!stored.startsWith("enc:")) return stored;

  const key = getKey();

  const [, ivB64, tagB64, dataB64] = stored.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
