import "server-only";
import crypto from "crypto";

const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = "sha512";
const SALT_LENGTH = 16;

/**
 * Hash PIN dengan PBKDF2 + salt acak.
 * Format: "pbkdf2:{saltHex}:{hashHex}"
 */
export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.pbkdf2Sync(pin, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return `pbkdf2:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/**
 * Verifikasi PIN terhadap hash yang tersimpan.
 * Format: "pbkdf2:{saltHex}:{hashHex}"
 */
export function verifyPin(pin: string, storedHash: string): boolean {
  // Jika hash masih plaintext (migrasi), lakukan upgrade
  if (!storedHash.startsWith("pbkdf2:")) {
    return pin === storedHash;
  }

  const parts = storedHash.split(":");
  if (parts.length !== 3) return false;

  const salt = Buffer.from(parts[1], "hex");
  const expectedHash = parts[2];
  const computedHash = crypto
    .pbkdf2Sync(pin, salt, ITERATIONS, KEY_LENGTH, DIGEST)
    .toString("hex");

  // timingSafeEqual untuk panjang tetap
  const a = Buffer.from(computedHash);
  const b = Buffer.from(expectedHash);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Cek apakah hash perlu di-upgrade (masih plaintext atau iterasi lebih rendah).
 */
export function needsRehash(storedHash: string): boolean {
  if (!storedHash.startsWith("pbkdf2:")) return true;
  // Di masa depan bisa cek ITERATIONS
  return false;
}
