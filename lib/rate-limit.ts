import "server-only";
import { headers } from "next/headers";
import { getSupabaseServer } from "@/lib/supabase/server";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 menit

/**
 * Cek apakah IP saat ini sudah melampaui batas percobaan login.
 * Jika ya, return jumlah detik tersisa sampai bisa mencoba lagi.
 * Jika tidak, return `null`.
 */
export async function checkLoginRateLimit(): Promise<{ blocked: number } | null> {
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";

  const supabase = getSupabaseServer();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const { count } = await supabase
    .from("login_attempts")
    .select("*", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", since);

  if (count != null && count >= MAX_ATTEMPTS) {
    // Cari attempt paling tua dalam window untuk tahu kapan reset
    const { data: oldest } = await supabase
      .from("login_attempts")
      .select("created_at")
      .eq("ip_address", ip)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(1);

    if (oldest && oldest.length > 0) {
      const resetAt = new Date(oldest[0].created_at).getTime() + WINDOW_MS;
      const remainingSeconds = Math.ceil((resetAt - Date.now()) / 1000);
      return { blocked: remainingSeconds };
    }
    return { blocked: 300 }; // default 5 menit
  }

  return null;
}

/**
 * Catat percobaan login (berhasil atau gagal) ke database.
 */
export async function recordLoginAttempt(success: boolean): Promise<void> {
  try {
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headersList.get("x-real-ip") ??
      "unknown";

    const supabase = getSupabaseServer();
    await supabase.from("login_attempts").insert({
      ip_address: ip,
      success,
    });
  } catch {
    // Jangan sampai mengganggu login
  }
}
