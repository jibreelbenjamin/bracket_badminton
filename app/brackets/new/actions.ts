"use server";

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import type { ActionState } from "@/lib/types";

/** Validasi string HH:mm */
function isValidTimeStr(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export async function createBracketAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuth();

  const name = String(formData.get("name") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const matchDuration = Number(formData.get("match_duration_minutes"));
  const restDuration = Number(formData.get("rest_duration_minutes"));
  const courtsCount = Number(formData.get("courts_count") ?? 1);
  const breakCount = Number(formData.get("break_count") ?? 0);

  if (!name) return { error: "Nama bracket wajib diisi." };
  if (!date || !time) return { error: "Tanggal dan jam mulai wajib diisi." };
  if (!Number.isFinite(matchDuration) || matchDuration <= 0) {
    return { error: "Durasi tiap babak harus berupa angka lebih dari 0." };
  }
  if (!Number.isFinite(restDuration) || restDuration < 0) {
    return { error: "Durasi istirahat harus berupa angka 0 atau lebih." };
  }
  if (!Number.isFinite(courtsCount) || courtsCount < 1) {
    return { error: "Jumlah lapangan minimal 1." };
  }

  // Parse break times dari form
  const breakTimes: { label: string; start_time_str: string; end_time_str: string }[] = [];
  if (Number.isFinite(breakCount) && breakCount > 0) {
    for (let i = 0; i < breakCount; i++) {
      const label = String(formData.get(`break_label_${i}`) ?? "").trim();
      const startStr = String(formData.get(`break_start_${i}`) ?? "").trim();
      const endStr = String(formData.get(`break_end_${i}`) ?? "").trim();

      if (!startStr || !endStr) {
        return { error: `Waktu istirahat khusus ke-${i + 1}: jam mulai dan selesai wajib diisi.` };
      }
      if (!isValidTimeStr(startStr) || !isValidTimeStr(endStr)) {
        return { error: `Waktu istirahat khusus ke-${i + 1}: format jam tidak valid (HH:mm).` };
      }
      if (startStr >= endStr) {
        return { error: `Waktu istirahat khusus ke-${i + 1}: jam mulai harus sebelum jam selesai.` };
      }

      breakTimes.push({ label, start_time_str: startStr, end_time_str: endStr });
    }
  }

  const startTime = new Date(`${date}T${time}:00+07:00`);
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
      courts_count: courtsCount,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Gagal membuat bracket." };
  }

  // Insert break times jika ada
  if (breakTimes.length > 0) {
    const { error: breakError } = await supabase.from("break_times").insert(
      breakTimes.map((b) => ({
        bracket_id: data.id,
        label: b.label,
        start_time_str: b.start_time_str,
        end_time_str: b.end_time_str,
      }))
    );
    if (breakError) {
      // Bracket sudah dibuat, tapi break times gagal — hapus bracket
      await supabase.from("brackets").delete().eq("id", data.id);
      return { error: `Gagal menyimpan waktu istirahat: ${breakError.message}` };
    }
  }

  await logActivity("create_bracket", `Membuat bracket: "${name}"`);
  redirect(`/brackets/${data.id}`);
}
