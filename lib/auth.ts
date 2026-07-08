import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE_NAME = "bb_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 jam

function getSecret(): string {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "APP_SESSION_SECRET belum diatur. Tambahkan ke file .env.local (lihat .env.example)."
    );
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

/**
 * Membuat nilai cookie sesi baru setelah PIN terverifikasi benar.
 * Format: "<expiryTimestamp>.<signature>". Tidak menyimpan sesi di database,
 * cukup ditandatangani (HMAC) supaya tidak bisa dipalsukan tanpa APP_SESSION_SECRET.
 */
export function createSessionCookieValue(): string {
  const expiry = Date.now() + SESSION_TTL_MS;
  const signature = sign(String(expiry));
  return `${expiry}.${signature}`;
}

export function isSessionValid(value: string | undefined | null): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 2) return false;
  const [expiryStr, signature] = parts;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;

  const expected = sign(expiryStr);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function getSessionCookieValue(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function isAuthenticated(): Promise<boolean> {
  const value = await getSessionCookieValue();
  return isSessionValid(value);
}

/**
 * Panggil di awal setiap Server Component halaman yang butuh proteksi PIN.
 * Akan redirect ke /login jika sesi tidak valid / sudah kedaluwarsa.
 */
export async function requireAuth(): Promise<void> {
  const ok = await isAuthenticated();
  if (!ok) {
    redirect("/login");
  }
}
