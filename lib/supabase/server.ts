import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase khusus SERVER, memakai Service Role Key.
 *
 * Kunci ini TIDAK PERNAH dikirim ke browser. Semua halaman & aksi di
 * aplikasi ini berjalan sebagai Server Component / Server Action, jadi
 * tidak ada anon key / login Supabase Auth yang dipakai di sisi client.
 * Otentikasi pengguna cukup memakai PIN 4 digit (lihat lib/auth.ts).
 */
export function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Konfigurasi Supabase belum diisi. Pastikan NEXT_PUBLIC_SUPABASE_URL dan " +
        "SUPABASE_SERVICE_ROLE_KEY sudah diatur di file .env.local (lihat .env.example)."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
