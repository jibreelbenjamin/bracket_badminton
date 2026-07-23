"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { checkLoginRateLimit, recordLoginAttempt } from "@/lib/rate-limit";
import { verifyPin, needsRehash, hashPin } from "@/lib/pin-hash";
import type { ActionState } from "@/lib/types";

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  // Cek rate limiting sebelum memproses PIN
  const rateLimit = await checkLoginRateLimit();
  if (rateLimit) {
    const minutes = Math.ceil(rateLimit.blocked / 60);
    return {
      error: `Terlalu banyak percobaan login. Coba lagi dalam ${minutes} menit.`,
    };
  }

  const pin = String(formData.get("pin") ?? "").trim();

  if (!/^\d{4}$/.test(pin)) {
    await recordLoginAttempt(false);
    await logActivity("login_failed", "PIN format tidak valid");
    return { error: "PIN harus terdiri dari 4 digit angka." };
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from("app_settings").select("pin").eq("id", 1).single();

  if (error || !data) {
    await recordLoginAttempt(false);
    await logActivity("login_failed", "Gagal mengambil data PIN dari database");
    return { error: "Gagal memverifikasi PIN. Periksa koneksi Supabase aplikasi." };
  }

  if (!verifyPin(pin, data.pin)) {
    await recordLoginAttempt(false);
    await logActivity("login_failed", "PIN salah");
    return { error: "PIN salah. Coba lagi." };
  }

  // Upgrade hash jika masih plaintext (migrasi otomatis)
  if (needsRehash(data.pin)) {
    await supabase.from("app_settings").update({ pin: hashPin(pin) }).eq("id", 1);
  }

  // Login berhasil — reset counter dengan mencatat attempt sukses
  await recordLoginAttempt(true);

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, createSessionCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  await logActivity("login_success", "Login berhasil");
  redirect("/dashboard");
}
