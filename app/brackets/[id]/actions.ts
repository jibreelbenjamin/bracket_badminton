"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { parseParticipantsExcel } from "@/lib/excel";
import { generateMatchesForBracket, nextRoundTarget } from "@/lib/bracket-logic";
import type { ActionState, Bracket, MatchRow, Participant } from "@/lib/types";

export async function importParticipantsAction(
  bracketId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAuth();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { error: "Pilih file Excel (.xlsx) terlebih dahulu." };
  }

  let parsed;
  try {
    const buffer = await file.arrayBuffer();
    parsed = parseParticipantsExcel(buffer);
  } catch {
    return { error: "Gagal membaca file. Pastikan file berformat .xlsx atau .xls yang valid." };
  }

  if (parsed.length === 0) {
    return {
      error:
        "Tidak ada data pasangan peserta yang terbaca. Pastikan file memiliki kolom header 'Nama' dan 'Nama PB'.",
    };
  }

  const supabase = getSupabaseServer();
  const rows = parsed.map((p) => ({
    bracket_id: bracketId,
    name: p.name,
    club_name: p.club_name,
  }));

  const { error } = await supabase.from("participants").insert(rows);
  if (error) return { error: error.message };

  revalidatePath(`/brackets/${bracketId}`);
  return { success: `${parsed.length} pasangan peserta berhasil diimpor.` };
}

export async function addParticipantAction(
  bracketId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAuth();

  const name = String(formData.get("name") ?? "").trim();
  const club = String(formData.get("club_name") ?? "").trim();
  if (!name) return { error: "Nama pasangan peserta wajib diisi." };

  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from("participants")
    .insert({ bracket_id: bracketId, name, club_name: club });

  if (error) return { error: error.message };
  revalidatePath(`/brackets/${bracketId}`);
  return { success: "Pasangan peserta ditambahkan." };
}

export async function deleteParticipantAction(bracketId: string, participantId: string) {
  await requireAuth();
  const supabase = getSupabaseServer();
  const { error } = await supabase.from("participants").delete().eq("id", participantId);
  if (error) throw new Error(error.message);
  revalidatePath(`/brackets/${bracketId}`);
}

export async function updateParticipantAction(
  bracketId: string,
  participantId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAuth();

  const name = String(formData.get("name") ?? "").trim();
  const club = String(formData.get("club_name") ?? "").trim();
  if (!name) return { error: "Nama pasangan peserta wajib diisi." };

  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from("participants")
    .update({ name, club_name: club })
    .eq("id", participantId);

  if (error) return { error: error.message };
  revalidatePath(`/brackets/${bracketId}`);
  return { success: "Pasangan peserta berhasil diperbarui." };
}

export async function generateBracketAction(bracketId: string): Promise<{ error?: string; warning?: string }> {
  await requireAuth();
  const supabase = getSupabaseServer();

  const { data: bracket, error: bracketError } = await supabase
    .from("brackets")
    .select("*")
    .eq("id", bracketId)
    .single<Bracket>();

  if (bracketError || !bracket) return { error: "Bracket tidak ditemukan." };

  const [{ data: participants, error: participantsError }, { data: breakTimes }] = await Promise.all([
    supabase
      .from("participants")
      .select("*")
      .eq("bracket_id", bracketId)
      .returns<Participant[]>(),
    supabase
      .from("break_times")
      .select("start_time_str, end_time_str")
      .eq("bracket_id", bracketId)
      .returns<{ start_time_str: string; end_time_str: string }[]>(),
  ]);

  if (participantsError) return { error: participantsError.message };
  if (!participants || participants.length < 2) {
    return { error: "Minimal 2 pasangan peserta diperlukan untuk membuat bagan." };
  }

  const { matches, remainingCollisions } = generateMatchesForBracket(
    bracket,
    participants,
    breakTimes ?? []
  );

  const { error: deleteError } = await supabase.from("matches").delete().eq("bracket_id", bracketId);
  if (deleteError) return { error: deleteError.message };

  const { error: insertError } = await supabase.from("matches").insert(matches);
  if (insertError) return { error: insertError.message };

  // Auto-resolve match yang hanya punya 1 peserta real (dari BYE vs BYE dsb)
  await autoResolveAllMatches(supabase, bracketId);

  await supabase.from("brackets").update({ status: "generated" }).eq("id", bracketId);

  revalidatePath(`/brackets/${bracketId}`);

  if (remainingCollisions > 0) {
    return {
      warning: `Bagan berhasil dibuat, namun ${remainingCollisions} pertandingan di babak 1 tetap mempertemukan pasangan peserta dari PB yang sama karena satu PB memiliki terlalu banyak pasangan peserta dibanding total slot yang tersedia.`,
    };
  }
  return {};
}

async function clearDownstream(
  supabase: ReturnType<typeof getSupabaseServer>,
  bracketId: string,
  roundNumber: number,
  matchIndex: number
): Promise<void> {
  const { nextMatchIndex, slot } = nextRoundTarget(matchIndex);
  const nextRound = roundNumber + 1;

  const { data: nextMatch } = await supabase
    .from("matches")
    .select("*")
    .eq("bracket_id", bracketId)
    .eq("round_number", nextRound)
    .eq("match_index", nextMatchIndex)
    .maybeSingle<MatchRow>();

  if (!nextMatch) return;

  const updates: Record<string, unknown> = { [slot]: null };
  const hadWinner = !!nextMatch.winner_id;
  if (hadWinner) updates.winner_id = null;

  await supabase.from("matches").update(updates).eq("id", nextMatch.id);

  if (hadWinner) {
    await clearDownstream(supabase, bracketId, nextRound, nextMatchIndex);
  }
}

/**
 * Auto-resolve: jika sebuah match di babak 1 memiliki tepat 1 peserta real
 * (lawan BYE struktural), otomatis tetapkan peserta itu sebagai pemenang
 * dan teruskan ke babak berikutnya. Hanya berlaku untuk babak 1 —
 * babak selanjutnya harus di-toggle manual oleh user.
 */
async function autoResolveMatch(
  supabase: ReturnType<typeof getSupabaseServer>,
  bracketId: string,
  roundNumber: number,
  matchIndex: number
): Promise<void> {
  // Hanya auto-resolve untuk babak 1 (BYE struktural)
  if (roundNumber > 1) return;

  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("bracket_id", bracketId)
    .eq("round_number", roundNumber)
    .eq("match_index", matchIndex)
    .maybeSingle<MatchRow>();

  if (!match) return;
  if (match.winner_id) return; // sudah ada pemenang

  const p1 = match.participant1_id;
  const p2 = match.participant2_id;

  // Hanya auto-resolve jika tepat 1 peserta real
  if (!((p1 && !p2) || (!p1 && p2))) return;

  const winnerId = (p1 ?? p2)!;

  await supabase.from("matches").update({ winner_id: winnerId }).eq("id", match.id);

  // Propagasi ke babak berikutnya (hanya isi slot, jangan auto-resolve lagi)
  const { nextMatchIndex, slot } = nextRoundTarget(matchIndex);
  const nextRound = roundNumber + 1;

  const { data: nextMatch } = await supabase
    .from("matches")
    .select("id")
    .eq("bracket_id", bracketId)
    .eq("round_number", nextRound)
    .eq("match_index", nextMatchIndex)
    .maybeSingle<{ id: string }>();

  if (nextMatch) {
    await supabase.from("matches").update({ [slot]: winnerId }).eq("id", nextMatch.id);
    // Propagasi peserta ke babak berikutnya tanpa auto-resolve
    await autoResolveMatch(supabase, bracketId, nextRound, nextMatchIndex);
  }
}

/**
 * Scan match di babak 1 dan auto-resolve match yang hanya punya 1 peserta
 * real (BYE struktural). Hanya berlaku untuk babak 1 — babak selanjutnya
 * harus di-toggle manual oleh user agar tidak auto-juara sebelum lawan
 * dari sisi bracket lain terisi.
 */
async function autoResolveAllMatches(
  supabase: ReturnType<typeof getSupabaseServer>,
  bracketId: string
): Promise<void> {
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("bracket_id", bracketId)
    .eq("round_number", 1)
    .order("match_index", { ascending: true })
    .returns<MatchRow[]>();

  if (!matches) return;

  for (const m of matches) {
    const p1 = m.participant1_id;
    const p2 = m.participant2_id;
    if (!m.winner_id && ((p1 && !p2) || (!p1 && p2))) {
      await autoResolveMatch(supabase, bracketId, m.round_number, m.match_index);
    }
  }
}

export async function setWinnerAction(bracketId: string, matchId: string, participantId: string) {
  await requireAuth();
  const supabase = getSupabaseServer();

  const { data: match, error } = await supabase
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single<MatchRow>();

  if (error || !match) throw new Error("Pertandingan tidak ditemukan.");
  if (match.participant1_is_bye || match.participant2_is_bye) {
    throw new Error("Pertandingan BYE tidak perlu diatur pemenangnya secara manual.");
  }
  if (participantId !== match.participant1_id && participantId !== match.participant2_id) {
    throw new Error("Pemenang harus salah satu pasangan peserta di pertandingan ini.");
  }

  // Klik pasangan yang sudah jadi pemenang = toggle batal menang.
  const newWinnerId = match.winner_id === participantId ? null : participantId;

  // Kalau sebelumnya sudah ada pemenang (baik yang sekarang dibatalkan, atau
  // yang sekarang diganti), bersihkan dulu propagasi lama ke babak berikutnya.
  if (match.winner_id) {
    await clearDownstream(supabase, bracketId, match.round_number, match.match_index);
  }

  await supabase.from("matches").update({ winner_id: newWinnerId }).eq("id", matchId);

  if (newWinnerId) {
    const { nextMatchIndex, slot } = nextRoundTarget(match.match_index);
    const nextRound = match.round_number + 1;

    const { data: nextMatch } = await supabase
      .from("matches")
      .select("id")
      .eq("bracket_id", bracketId)
      .eq("round_number", nextRound)
      .eq("match_index", nextMatchIndex)
      .maybeSingle<{ id: string }>();

    if (nextMatch) {
      await supabase.from("matches").update({ [slot]: newWinnerId }).eq("id", nextMatch.id);
      // Jangan auto-resolve di babak > 1 — biarkan user toggle manual
      // agar tidak auto-juara sebelum lawan dari sisi bracket lain terisi.
    }
  }

  revalidatePath(`/brackets/${bracketId}`);
}

/** Validasi string HH:mm */
function isValidTimeStr(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export async function updateBracketScheduleAction(
  bracketId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAuth();

  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const matchDuration = Number(formData.get("match_duration_minutes"));
  const restDuration = Number(formData.get("rest_duration_minutes"));
  const courtsCount = Number(formData.get("courts_count") ?? 1);
  const breakCount = Number(formData.get("break_count") ?? 0);

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

  // Parse break times
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

  const startTime = new Date(`${date}T${time}:00`);
  if (Number.isNaN(startTime.getTime())) return { error: "Format tanggal/jam tidak valid." };

  const supabase = getSupabaseServer();
  const { error } = await supabase
    .from("brackets")
    .update({
      start_time: startTime.toISOString(),
      match_duration_minutes: matchDuration,
      rest_duration_minutes: restDuration,
      courts_count: courtsCount,
    })
    .eq("id", bracketId);

  if (error) return { error: error.message };

  // Replace break times: hapus semua yang lama, insert yang baru
  const { error: deleteBreakError } = await supabase
    .from("break_times")
    .delete()
    .eq("bracket_id", bracketId);

  if (deleteBreakError) return { error: deleteBreakError.message };

  if (breakTimes.length > 0) {
    const { error: insertBreakError } = await supabase.from("break_times").insert(
      breakTimes.map((b) => ({
        bracket_id: bracketId,
        label: b.label,
        start_time_str: b.start_time_str,
        end_time_str: b.end_time_str,
      }))
    );
    if (insertBreakError) return { error: insertBreakError.message };
  }

  revalidatePath(`/brackets/${bracketId}`);
  return { success: "Jadwal diperbarui. Tekan tombol acak ulang di bawah agar jam pertandingan ikut diperbarui." };
}

export async function updateBracketNameAction(
  bracketId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAuth();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Nama turnamen wajib diisi." };

  const supabase = getSupabaseServer();
  const { error } = await supabase.from("brackets").update({ name }).eq("id", bracketId);

  if (error) return { error: error.message };

  revalidatePath(`/brackets/${bracketId}`);
  revalidatePath("/dashboard");
  return { success: "Nama turnamen berhasil diperbarui." };
}
