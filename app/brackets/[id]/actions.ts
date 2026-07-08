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

  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("*")
    .eq("bracket_id", bracketId)
    .returns<Participant[]>();

  if (participantsError) return { error: participantsError.message };
  if (!participants || participants.length < 2) {
    return { error: "Minimal 2 pasangan peserta diperlukan untuk membuat bagan." };
  }

  const { matches, remainingCollisions } = generateMatchesForBracket(bracket, participants);

  const { error: deleteError } = await supabase.from("matches").delete().eq("bracket_id", bracketId);
  if (deleteError) return { error: deleteError.message };

  const { error: insertError } = await supabase.from("matches").insert(matches);
  if (insertError) return { error: insertError.message };

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
    }
  }

  revalidatePath(`/brackets/${bracketId}`);
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

  if (!date || !time) return { error: "Tanggal dan jam mulai wajib diisi." };
  if (!Number.isFinite(matchDuration) || matchDuration <= 0) {
    return { error: "Durasi tiap babak harus berupa angka lebih dari 0." };
  }
  if (!Number.isFinite(restDuration) || restDuration < 0) {
    return { error: "Durasi istirahat harus berupa angka 0 atau lebih." };
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
    })
    .eq("id", bracketId);

  if (error) return { error: error.message };

  // Bagan yang sudah ada butuh diacak ulang supaya jadwal jam ikut ter-update
  // (jadwal dihitung ulang penuh saat "Acak / Buat Bagan" ditekan).
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
