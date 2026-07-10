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
  const matchDuration = Number(formData.get("match_duration_minutes"));
  const restDuration = Number(formData.get("rest_duration_minutes"));
  const courtsCount = Number(formData.get("courts_count") ?? 1);
  const breakCount = Number(formData.get("break_count") ?? 0);
  const dayCount = Number(formData.get("day_count") ?? 1);

  if (!name) return { error: "Nama bracket wajib diisi." };
  if (!Number.isFinite(matchDuration) || matchDuration <= 0) {
    return { error: "Durasi tiap babak harus berupa angka lebih dari 0." };
  }
  if (!Number.isFinite(restDuration) || restDuration < 0) {
    return { error: "Durasi istirahat harus berupa angka 0 atau lebih." };
  }
  if (!Number.isFinite(courtsCount) || courtsCount < 1) {
    return { error: "Jumlah lapangan minimal 1." };
  }
  if (!Number.isFinite(dayCount) || dayCount < 1) {
    return { error: "Minimal 1 hari pelaksanaan." };
  }

  // Parse schedule days dari form
  const scheduleDays: { date: string; start_time_str: string; end_time_str: string; day_index: number }[] = [];
  for (let i = 0; i < dayCount; i++) {
    const dayDate = String(formData.get(`day_date_${i}`) ?? "").trim();
    const dayStart = String(formData.get(`day_start_${i}`) ?? "").trim();
    const dayEnd = String(formData.get(`day_end_${i}`) ?? "").trim();

    if (!dayDate) return { error: `Hari ke-${i + 1}: tanggal wajib diisi.` };
    if (!dayStart || !dayEnd) {
      return { error: `Hari ke-${i + 1}: jam mulai dan selesai wajib diisi.` };
    }
    if (!isValidTimeStr(dayStart) || !isValidTimeStr(dayEnd)) {
      return { error: `Hari ke-${i + 1}: format jam tidak valid (HH:mm).` };
    }
    if (dayStart >= dayEnd) {
      return { error: `Hari ke-${i + 1}: jam mulai harus sebelum jam selesai.` };
    }

    scheduleDays.push({ date: dayDate, start_time_str: dayStart, end_time_str: dayEnd, day_index: i });
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

  // Gunakan hari pertama sebagai start_time utama bracket (untuk backward compatibility)
  const firstDay = scheduleDays[0];
  const startTime = new Date(`${firstDay.date}T${firstDay.start_time_str}:00+07:00`);
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

  // Insert schedule days
  const { error: dayError } = await supabase.from("schedule_days").insert(
    scheduleDays.map((d) => ({
      bracket_id: data.id,
      date: d.date,
      start_time_str: d.start_time_str,
      end_time_str: d.end_time_str,
      day_index: d.day_index,
    }))
  );
  if (dayError) {
    await supabase.from("brackets").delete().eq("id", data.id);
    return { error: `Gagal menyimpan hari pelaksanaan: ${dayError.message}` };
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
