import crypto from "node:crypto";

/**
 * Derives a 32-byte AES key from the BETTER_AUTH_SECRET environment variable
 * using SHA-256 hashing.
 */
function getDerivedKey(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET environment variable is not set");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a plaintext string using AES-256-CBC.
 * Returns the result as an 'iv_hex:ciphertext_hex' string.
 */
export function encryptAppPassword(plaintext: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts an 'iv_hex:ciphertext_hex' string produced by encryptAppPassword.
 * Throws if the format is invalid or decryption fails.
 */
export function decryptAppPassword(encrypted: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted password format");
  }
  const [ivHex, ciphertextHex] = parts;
  const key = getDerivedKey();
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
