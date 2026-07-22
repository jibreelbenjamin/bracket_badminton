"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { parseParticipantsExcel } from "@/lib/excel";
import { generateMatchesForBracket, nextRoundTarget, recomputeMatchTimes } from "@/lib/bracket-logic";
import { logActivity } from "@/lib/activity-log";
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

  await logActivity("import_participants", `Mengimpor ${parsed.length} peserta ke bracket ${bracketId}`);
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
  await logActivity("add_participant", `Menambah peserta "${name}" ke bracket ${bracketId}`);
  revalidatePath(`/brackets/${bracketId}`);
  return { success: "Pasangan peserta ditambahkan." };
}

export async function deleteParticipantAction(bracketId: string, participantId: string) {
  await requireAuth();
  const supabase = getSupabaseServer();

  // Cari semua pertandingan yang mereferensikan peserta ini
  const { data: affectedMatches } = await supabase
    .from("matches")
    .select("*")
    .eq("bracket_id", bracketId)
    .or(`participant1_id.eq.${participantId},participant2_id.eq.${participantId}`)
    .returns<MatchRow[]>();

  if (affectedMatches && affectedMatches.length > 0) {
    for (const match of affectedMatches) {
      const updates: Record<string, unknown> = {};

      if (match.participant1_id === participantId) {
        updates.participant1_id = null;
        updates.participant1_is_bye = true;
      }
      if (match.participant2_id === participantId) {
        updates.participant2_id = null;
        updates.participant2_is_bye = true;
      }

      // Jika peserta yang dihapus adalah pemenang, hapus pemenang & bersihkan downstream
      if (match.winner_id === participantId) {
        updates.winner_id = null;
        await clearDownstream(supabase, bracketId, match.round_number, match.match_index);
      }

      await supabase.from("matches").update(updates).eq("id", match.id);
    }

    // Auto-resolve ulang: jika setelah dihapus, match jadi BYE vs kosong → otomatis menang
    for (const match of affectedMatches) {
      await autoResolveMatch(supabase, bracketId, match.round_number, match.match_index);
    }
  }

  const { error } = await supabase.from("participants").delete().eq("id", participantId);
  if (error) throw new Error(error.message);
  await logActivity("delete_participant", `Menghapus peserta ${participantId} dari bracket ${bracketId}`);
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
  await logActivity("update_participant", `Memperbarui peserta "${name}" di bracket ${bracketId}`);
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

  const [{ data: participants, error: participantsError }, { data: breakTimes }, { data: scheduleDays }, { data: roundAssignments }] = await Promise.all([
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
    supabase
      .from("schedule_days")
      .select("id, date, start_time_str, end_time_str, day_index")
      .eq("bracket_id", bracketId)
      .order("day_index")
      .returns<{ id: string; date: string; start_time_str: string; end_time_str: string; day_index: number }[]>(),
    supabase
      .from("round_schedule_assignments")
      .select("round_number, schedule_day_id")
      .eq("bracket_id", bracketId)
      .returns<{ round_number: number; schedule_day_id: string }[]>(),
  ]);

  if (participantsError) return { error: participantsError.message };
  if (!participants || participants.length < 2) {
    return { error: "Minimal 2 pasangan peserta diperlukan untuk membuat bagan." };
  }

  const { matches, remainingCollisions } = generateMatchesForBracket(
    bracket,
    participants,
    breakTimes ?? [],
    scheduleDays ?? [],
    roundAssignments ?? []
  );

  const { error: deleteError } = await supabase.from("matches").delete().eq("bracket_id", bracketId);
  if (deleteError) return { error: deleteError.message };

  const { error: insertError } = await supabase.from("matches").insert(matches);
  if (insertError) return { error: insertError.message };

  // Auto-resolve match yang hanya punya 1 peserta real (dari BYE vs BYE dsb)
  await autoResolveAllMatches(supabase, bracketId);

  // Simpan auto-assigned round assignments ke database (jika belum ada)
  if ((scheduleDays ?? []).length > 0) {
    const existingRounds = new Set((roundAssignments ?? []).map((ra) => ra.round_number));
    const dayByDate = new Map<string, string>(); // date → schedule_day_id
    for (const sd of (scheduleDays ?? [])) {
      dayByDate.set(sd.date, sd.id);
    }

    const newAssignments: { bracket_id: string; round_number: number; schedule_day_id: string }[] = [];
    const seenRounds = new Set<number>();

    for (const m of matches) {
      if (seenRounds.has(m.round_number)) continue;
      if (existingRounds.has(m.round_number)) continue;
      seenRounds.add(m.round_number);

      const matchDate = (m.start_time as string)?.slice(0, 10);
      const dayId = matchDate ? dayByDate.get(matchDate) : undefined;
      if (dayId) {
        newAssignments.push({
          bracket_id: bracketId,
          round_number: m.round_number,
          schedule_day_id: dayId,
        });
      }
    }

    if (newAssignments.length > 0) {
      await supabase.from("round_schedule_assignments").insert(newAssignments);
    }
  }

  await supabase.from("brackets").update({ status: "generated" }).eq("id", bracketId);

  await logActivity("generate_bracket", `Generate bagan untuk bracket ${bracketId} (${bracket.name})`);
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

    // Propagasi loser semifinal ke pertandingan juara 3
    await propagateSemifinalLoserToThirdPlace(
      supabase,
      bracketId,
      match,
      newWinnerId
    );
  } else {
    // Jika pemenang dibatalkan, hapus juga peserta dari juara 3
    await clearThirdPlaceSlot(supabase, bracketId, match);
  }

  await logActivity("set_winner", `Set pemenang match ${matchId} di bracket ${bracketId}`);
  revalidatePath(`/brackets/${bracketId}`);
}

/**
 * Ketika pemenang semifinal ditentukan, loser-nya dimasukkan ke
 * pertandingan perebutan juara 3 (jika ada).
 */
async function propagateSemifinalLoserToThirdPlace(
  supabase: ReturnType<typeof getSupabaseServer>,
  bracketId: string,
  match: MatchRow,
  winnerId: string
): Promise<void> {
  // Cari total rounds bracket ini
  const { data: allMatches } = await supabase
    .from("matches")
    .select("round_number")
    .eq("bracket_id", bracketId)
    .eq("is_third_place", false)
    .order("round_number", { ascending: false })
    .limit(1)
    .returns<{ round_number: number }[]>();

  if (!allMatches || allMatches.length === 0) return;
  const totalRounds = allMatches[0].round_number;

  // Hanya propagate dari semifinal (round = totalRounds - 1)
  if (match.round_number !== totalRounds - 1) return;

  // Tentukan loser
  const loserId =
    match.participant1_id === winnerId
      ? match.participant2_id
      : match.participant1_id;

  if (!loserId) return;

  // Cari pertandingan juara 3
  const { data: thirdPlaceMatch } = await supabase
    .from("matches")
    .select("id, participant1_id, participant2_id")
    .eq("bracket_id", bracketId)
    .eq("is_third_place", true)
    .maybeSingle<{ id: string; participant1_id: string | null; participant2_id: string | null }>();

  if (!thirdPlaceMatch) return;

  // Tentukan slot: match_index ganjil/genap dari semifinal
  // Semifinal match_index 0 → slot participant1_id, match_index 1 → participant2_id
  const slot =
    match.match_index % 2 === 0 ? "participant1_id" : "participant2_id";

  await supabase
    .from("matches")
    .update({ [slot]: loserId, winner_id: null })
    .eq("id", thirdPlaceMatch.id);
}

/**
 * Hapus slot peserta dari pertandingan juara 3 ketika pemenang semifinal
 * dibatalkan/diubah.
 */
async function clearThirdPlaceSlot(
  supabase: ReturnType<typeof getSupabaseServer>,
  bracketId: string,
  match: MatchRow
): Promise<void> {
  // Hanya relevan untuk semifinal
  const { data: allMatches } = await supabase
    .from("matches")
    .select("round_number")
    .eq("bracket_id", bracketId)
    .eq("is_third_place", false)
    .order("round_number", { ascending: false })
    .limit(1)
    .returns<{ round_number: number }[]>();

  if (!allMatches || allMatches.length === 0) return;
  const totalRounds = allMatches[0].round_number;

  if (match.round_number !== totalRounds - 1) return;

  const slot =
    match.match_index % 2 === 0 ? "participant1_id" : "participant2_id";

  const { data: thirdPlaceMatch } = await supabase
    .from("matches")
    .select("id")
    .eq("bracket_id", bracketId)
    .eq("is_third_place", true)
    .maybeSingle<{ id: string }>();

  if (thirdPlaceMatch) {
    await supabase
      .from("matches")
      .update({ [slot]: null, winner_id: null })
      .eq("id", thirdPlaceMatch.id);
  }
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

  const matchDuration = Number(formData.get("match_duration_minutes"));
  const restDuration = Number(formData.get("rest_duration_minutes"));
  const courtsCount = Number(formData.get("courts_count") ?? 1);
  const breakCount = Number(formData.get("break_count") ?? 0);
  const dayCount = Number(formData.get("day_count") ?? 1);

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

  // Gunakan hari pertama sebagai start_time utama bracket
  const firstDay = scheduleDays[0];
  const startTime = new Date(`${firstDay.date}T${firstDay.start_time_str}:00+07:00`);
  if (Number.isNaN(startTime.getTime())) return { error: "Format tanggal/jam tidak valid." };

  const supabase = getSupabaseServer();

  // Update bracket settings
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

  // Replace schedule days — baca data lama dulu SEBELUM delete
  const { data: oldDays } = await supabase
    .from("schedule_days")
    .select("id, day_index")
    .eq("bracket_id", bracketId)
    .order("day_index");

  // Baca round assignments lama sebelum dihapus cascade
  const { data: oldAssignments } = await supabase
    .from("round_schedule_assignments")
    .select("round_number, schedule_day_id")
    .eq("bracket_id", bracketId);

  // Mapping: round_number → day_index (lama)
  const oldRoundToDayIndex = new Map<number, number>();
  if (oldAssignments && oldDays) {
    const oldDayIndexById = new Map(oldDays.map((d) => [d.id, d.day_index]));
    for (const ra of oldAssignments) {
      const dayIdx = oldDayIndexById.get(ra.schedule_day_id);
      if (dayIdx !== undefined) {
        oldRoundToDayIndex.set(ra.round_number, dayIdx);
      }
    }
  }

  // Hapus hari lama (cascade akan menghapus round_assignments terkait)
  await supabase.from("schedule_days").delete().eq("bracket_id", bracketId);

  // Insert hari baru
  const { data: insertedDays, error: dayInsertError } = await supabase
    .from("schedule_days")
    .insert(
      scheduleDays.map((d) => ({
        bracket_id: bracketId,
        date: d.date,
        start_time_str: d.start_time_str,
        end_time_str: d.end_time_str,
        day_index: d.day_index,
      }))
    )
    .select("id, day_index");

  if (dayInsertError) return { error: `Gagal menyimpan hari: ${dayInsertError.message}` };

  // Re-insert round assignments: gabungkan data lama (preserved by day_index)
  // dengan data baru dari form (round_assign_count, ra_round_N, ra_day_index_N)
  const roundAssignCount = Number(formData.get("round_assign_count") ?? 0);
  const newRoundToDayIndex = new Map<number, number>();

  // Data dari form (jika user mengubah assignment di ScheduleEditor)
  if (Number.isFinite(roundAssignCount) && roundAssignCount > 0) {
    for (let i = 0; i < roundAssignCount; i++) {
      const roundNum = Number(formData.get(`ra_round_${i}`));
      const dayIdx = Number(formData.get(`ra_day_index_${i}`));
      if (Number.isFinite(roundNum) && Number.isFinite(dayIdx) && dayIdx >= 0 && dayIdx < scheduleDays.length) {
        newRoundToDayIndex.set(roundNum, dayIdx);
      }
    }
  }

  // Fallback: jika tidak ada data form, gunakan data lama yang di-preserve
  if (newRoundToDayIndex.size === 0 && oldRoundToDayIndex.size > 0) {
    for (const [roundNum, dayIdx] of oldRoundToDayIndex) {
      // Hanya preserve jika day_index masih valid (dalam rentang scheduleDays baru)
      if (dayIdx < scheduleDays.length) {
        newRoundToDayIndex.set(roundNum, dayIdx);
      }
    }
  }

  // Auto-distribusi default: jika tidak ada assignment manual maupun
  // data lama, dan ada lebih dari 1 hari, distribusikan semua babak
  // ke hari secara otomatis — babak awal di hari awal, dst.
  if (newRoundToDayIndex.size === 0 && scheduleDays.length > 1) {
    const { data: existingMatchesForRounds } = await supabase
      .from("matches")
      .select("round_number")
      .eq("bracket_id", bracketId)
      .order("round_number");

    if (existingMatchesForRounds && existingMatchesForRounds.length > 0) {
      const totalRounds = Math.max(...existingMatchesForRounds.map((m) => m.round_number));
      let dayIdx = 0;
      for (let r = 1; r <= totalRounds; r++) {
        newRoundToDayIndex.set(r, dayIdx % scheduleDays.length);
        dayIdx++;
      }
    }
  }

  // Insert round assignments dengan new day IDs
  if (insertedDays && newRoundToDayIndex.size > 0) {
    const newDayIdByIndex = new Map<number, string>();
    for (const d of insertedDays) {
      newDayIdByIndex.set(d.day_index, d.id);
    }

    const assignmentsToInsert: { bracket_id: string; round_number: number; schedule_day_id: string }[] = [];
    for (const [roundNum, dayIdx] of newRoundToDayIndex) {
      const newDayId = newDayIdByIndex.get(dayIdx);
      if (newDayId) {
        assignmentsToInsert.push({
          bracket_id: bracketId,
          round_number: roundNum,
          schedule_day_id: newDayId,
        });
      }
    }

    if (assignmentsToInsert.length > 0) {
      await supabase.from("round_schedule_assignments").insert(assignmentsToInsert);
    }
  }

  // Replace break times
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

  await logActivity("update_schedule", `Update jadwal bracket ${bracketId}`);

  // === Auto-update match times if bracket already has matches ===
  const { data: existingMatches } = await supabase
    .from("matches")
    .select("id, round_number, match_index")
    .eq("bracket_id", bracketId)
    .order("round_number")
    .order("match_index");

  if (existingMatches && existingMatches.length > 0) {
    // Ambil schedule days & round assignments terkini
    const { data: currentDays } = await supabase
      .from("schedule_days")
      .select("id, date, start_time_str, end_time_str, day_index")
      .eq("bracket_id", bracketId)
      .order("day_index");

    const { data: currentAssignments } = await supabase
      .from("round_schedule_assignments")
      .select("round_number, schedule_day_id")
      .eq("bracket_id", bracketId);

    const updatedTimes = recomputeMatchTimes(
      {
        start_time: startTime.toISOString(),
        match_duration_minutes: matchDuration,
        rest_duration_minutes: restDuration,
        courts_count: courtsCount,
      },
      existingMatches,
      breakTimes,
      currentDays ?? [],
      currentAssignments ?? []
    );

    const updatePromises = Array.from(updatedTimes.entries()).map(([matchId, times]) =>
      supabase.from("matches").update({ start_time: times.start_time, end_time: times.end_time }).eq("id", matchId)
    );
    await Promise.all(updatePromises);

    // Auto-save round assignments yang belum di-assign (dari auto-distribute)
    if ((currentDays ?? []).length > 0) {
      const assignedRounds = new Set((currentAssignments ?? []).map((ra) => ra.round_number));
      const dayByDate = new Map<string, string>();
      for (const sd of (currentDays ?? [])) {
        dayByDate.set(sd.date, sd.id);
      }

      const newAssignments: { bracket_id: string; round_number: number; schedule_day_id: string }[] = [];
      const seenRounds = new Set<number>();

      for (const m of existingMatches) {
        if (seenRounds.has(m.round_number)) continue;
        if (assignedRounds.has(m.round_number)) continue;
        seenRounds.add(m.round_number);

        const times = updatedTimes.get(m.id);
        const matchDate = times?.start_time?.slice(0, 10);
        const dayId = matchDate ? dayByDate.get(matchDate) : undefined;
        if (dayId) {
          newAssignments.push({
            bracket_id: bracketId,
            round_number: m.round_number,
            schedule_day_id: dayId,
          });
        }
      }

      if (newAssignments.length > 0) {
        await supabase.from("round_schedule_assignments").insert(newAssignments);
      }
    }
  }

  revalidatePath(`/brackets/${bracketId}`);
  return { success: "Jadwal dan waktu pertandingan berhasil diperbarui." };
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

  await logActivity("update_bracket_name", `Ubah nama bracket ${bracketId} menjadi "${name}"`);
  revalidatePath(`/brackets/${bracketId}`);
  revalidatePath("/dashboard");
  return { success: "Nama turnamen berhasil diperbarui." };
}

export async function deleteAllParticipantsAction(bracketId: string) {
  await requireAuth();
  const supabase = getSupabaseServer();

  // Hapus semua pertandingan terlebih dahulu (karena mereferensikan participants)
  const { error: deleteMatchesError } = await supabase
    .from("matches")
    .delete()
    .eq("bracket_id", bracketId);

  if (deleteMatchesError) throw new Error(deleteMatchesError.message);

  // Hapus semua peserta
  const { error: deleteParticipantsError } = await supabase
    .from("participants")
    .delete()
    .eq("bracket_id", bracketId);

  if (deleteParticipantsError) throw new Error(deleteParticipantsError.message);

  // Reset status bracket ke draft
  await supabase.from("brackets").update({ status: "draft" }).eq("id", bracketId);

  await logActivity("delete_all_participants", `Menghapus semua peserta dari bracket ${bracketId}`);
  revalidatePath(`/brackets/${bracketId}`);
}

/**
 * Menyimpan assignment babak ke hari pelaksanaan.
 * Menerima JSON body: { assignments: { round_number: number; schedule_day_id: string }[] }
 */
export async function updateRoundAssignmentsAction(
  bracketId: string,
  assignments: { round_number: number; schedule_day_id: string }[]
): Promise<{ error?: string; success?: string }> {
  await requireAuth();
  const supabase = getSupabaseServer();

  // Hapus semua assignment lama untuk bracket ini
  await supabase
    .from("round_schedule_assignments")
    .delete()
    .eq("bracket_id", bracketId);

  if (assignments.length > 0) {
    const { error } = await supabase.from("round_schedule_assignments").insert(
      assignments.map((a) => ({
        bracket_id: bracketId,
        round_number: a.round_number,
        schedule_day_id: a.schedule_day_id,
      }))
    );
    if (error) return { error: error.message };
  }

  // Recompute match times dengan assignments baru
  const { data: bracket } = await supabase
    .from("brackets")
    .select("*")
    .eq("id", bracketId)
    .single<Bracket>();

  if (!bracket) return { error: "Bracket tidak ditemukan." };

  const { data: existingMatches } = await supabase
    .from("matches")
    .select("id, round_number, match_index")
    .eq("bracket_id", bracketId)
    .order("round_number")
    .order("match_index");

  if (existingMatches && existingMatches.length > 0) {
    const { data: breakTimes } = await supabase
      .from("break_times")
      .select("start_time_str, end_time_str")
      .eq("bracket_id", bracketId);

    const { data: scheduleDays } = await supabase
      .from("schedule_days")
      .select("id, date, start_time_str, end_time_str, day_index")
      .eq("bracket_id", bracketId)
      .order("day_index");

    const updatedTimes = recomputeMatchTimes(
      {
        start_time: bracket.start_time,
        match_duration_minutes: bracket.match_duration_minutes,
        rest_duration_minutes: bracket.rest_duration_minutes,
        courts_count: bracket.courts_count,
      },
      existingMatches,
      breakTimes ?? [],
      scheduleDays ?? [],
      assignments
    );

    const updatePromises = Array.from(updatedTimes.entries()).map(([matchId, times]) =>
      supabase.from("matches").update({ start_time: times.start_time, end_time: times.end_time }).eq("id", matchId)
    );
    await Promise.all(updatePromises);
  }

  await logActivity("update_round_assignments", `Update assignment babak untuk bracket ${bracketId}`);
  revalidatePath(`/brackets/${bracketId}`);
  return { success: "Penugasan babak ke hari berhasil disimpan." };
}
