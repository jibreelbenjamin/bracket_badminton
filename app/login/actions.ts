"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";
import type { ActionState } from "@/lib/types";

export async function loginAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const pin = String(formData.get("pin") ?? "").trim();

  if (!/^\d{4}$/.test(pin)) {
    return { error: "PIN harus terdiri dari 4 digit angka." };
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase.from("app_settings").select("pin").eq("id", 1).single();

  if (error || !data) {
    return { error: "Gagal memverifikasi PIN. Periksa koneksi Supabase aplikasi." };
  }

  if (data.pin !== pin) {
    return { error: "PIN salah. Coba lagi." };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, createSessionCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  redirect("/dashboard");
}
