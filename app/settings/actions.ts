"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

export async function updateSettingsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();

  const pin = String(formData.get("pin") ?? "").trim();
  const matchDuration = Number(formData.get("default_match_duration_minutes"));
  const restDuration = Number(formData.get("default_rest_duration_minutes"));
  const courtsCount = Number(formData.get("default_courts_count"));

  if (!/^\d{4}$/.test(pin)) return { error: "PIN harus terdiri dari 4 digit angka." };
  if (!Number.isFinite(matchDuration) || matchDuration <= 0) {
    return { error: "Durasi tiap babak harus berupa angka lebih dari 0." };
  }
  if (!Number.isFinite(restDuration) || restDuration < 0) {
    return { error: "Durasi istirahat harus berupa angka 0 atau lebih." };
  }
  if (!Number.isFinite(courtsCount) || courtsCount < 1) {
    return { error: "Jumlah lapangan harus berupa angka 1 atau lebih." };
  }

  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from("app_settings")
    .update({
      pin,
      default_match_duration_minutes: matchDuration,
      default_rest_duration_minutes: restDuration,
      default_courts_count: courtsCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: "Pengaturan berhasil disimpan." };
}
