/**
 * AES-256-GCM encryption for scan source credentials.
 * Uses SCAN_SOURCE_ENCRYPTION_KEY env var for key derivation.
 * In dev without the env var, falls back to plaintext with a warning.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey(): Buffer | null {
  const envKey = process.env.SCAN_SOURCE_ENCRYPTION_KEY;
  if (!envKey) {
    console.warn("[scan-sources] SCAN_SOURCE_ENCRYPTION_KEY not set — passwords stored in plaintext (dev only)");
    return null;
  }
  return scryptSync(envKey, "sessionforge-scan-sources", KEY_LENGTH);
}

export function encryptPassword(plaintext: string): string {
  const key = getKey();
  if (!key) return `plain:${plaintext}`;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `enc:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptPassword(stored: string): string {
  if (stored.startsWith("plain:")) return stored.slice(6);
  if (!stored.startsWith("enc:")) return stored;

  const key = getKey();
  if (!key) throw new Error("SCAN_SOURCE_ENCRYPTION_KEY required to decrypt passwords");

  const [, ivB64, tagB64, dataB64] = stored.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
