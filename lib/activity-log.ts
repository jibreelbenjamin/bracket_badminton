import "server-only";
import { headers } from "next/headers";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Mengekstrak informasi request: IP address, negara (dari header Vercel/Cloudflare),
 * dan user-agent browser.
 */
async function getRequestInfo(): Promise<{
  ip_address: string | null;
  country: string | null;
  browser: string | null;
}> {
  const headersList = await headers();

  // IP: prioritas header yang umum dipakai di production (Vercel, Cloudflare, reverse proxy)
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    null;

  // Negara: header yang disediakan Vercel / Cloudflare
  const country =
    headersList.get("x-vercel-ip-country") ??
    headersList.get("cf-ipcountry") ??
    null;

  // Browser: dari user-agent
  const ua = headersList.get("user-agent") ?? null;
  const browser = ua ? parseBrowser(ua) : null;

  return { ip_address: ip, country, browser };
}

/**
 * Parsing user-agent sederhana menjadi "Browser (OS)".
 */
function parseBrowser(ua: string): string {
  let browser = "Unknown";
  let os = "Unknown";

  if (ua.includes("Edg/")) {
    browser = "Edge";
  } else if (ua.includes("Chrome/") && !ua.includes("Edg/")) {
    browser = "Chrome";
  } else if (ua.includes("Safari/") && !ua.includes("Chrome/")) {
    browser = "Safari";
  } else if (ua.includes("Firefox/")) {
    browser = "Firefox";
  }

  if (ua.includes("Windows")) {
    os = "Windows";
  } else if (ua.includes("Mac OS") || ua.includes("Macintosh")) {
    os = "macOS";
  } else if (ua.includes("Linux") && !ua.includes("Android")) {
    os = "Linux";
  } else if (ua.includes("Android")) {
    os = "Android";
  } else if (ua.includes("iPhone") || ua.includes("iPad") || ua.includes("iOS")) {
    os = "iOS";
  }

  return `${browser} (${os})`;
}

/**
 * Mencatat aktivitas ke tabel activity_logs.
 * Hanya dipanggil dari Server Actions — tidak pernah diekspos ke client.
 *
 * @param action - Label aksi, misal "login", "create_bracket", "delete_bracket"
 * @param details - Informasi tambahan (contoh: nama bracket yang dihapus)
 */
export async function logActivity(action: string, details?: string): Promise<void> {
  try {
    const { ip_address, country, browser } = await getRequestInfo();
    const supabase = getSupabaseServer();

    await supabase.from("activity_logs").insert({
      action,
      ip_address,
      country,
      browser,
      details: details ?? null,
    });
  } catch {
    // Gagal mencatat log tidak boleh mengganggu alur utama aplikasi
  }
}
