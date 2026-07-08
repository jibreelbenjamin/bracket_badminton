"use server";

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import type { ActionState } from "@/lib/types";

export async function createBracketAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();

  const name = String(formData.get("name") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const matchDuration = Number(formData.get("match_duration_minutes"));
  const restDuration = Number(formData.get("rest_duration_minutes"));

  if (!name) return { error: "Nama bracket wajib diisi." };
  if (!date || !time) return { error: "Tanggal dan jam mulai wajib diisi." };
  if (!Number.isFinite(matchDuration) || matchDuration <= 0) {
    return { error: "Durasi tiap babak harus berupa angka lebih dari 0." };
  }
  if (!Number.isFinite(restDuration) || restDuration < 0) {
    return { error: "Durasi istirahat harus berupa angka 0 atau lebih." };
  }

  const startTime = new Date(`${date}T${time}:00`);
  if (Number.isNaN(startTime.getTime())) {
    return { error: "Format tanggal/jam mulai tidak valid." };
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("brackets")
    .insert({
      name,
      start_time: startTime.toISOString(),
      match_duration_minutes: matchDuration,
      rest_duration_minutes: restDuration,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Gagal membuat bracket." };
  }

  redirect(`/brackets/${data.id}`);
}
