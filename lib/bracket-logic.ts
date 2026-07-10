import type { Bracket, BreakTime, MatchInsert, Participant } from "@/lib/types";

/** Bilangan pangkat 2 terkecil yang >= n (minimal 2). */
export function nextPowerOfTwo(n: number): number {
  if (n <= 2) return 2;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/** Fisher-Yates shuffle, tidak mengubah array asli. */
export function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinal";
  return `Babak ${round}`;
}

type Slot = Participant | null;

/**
 * Menyusun peserta ke dalam slot bagan (ukuran = bracketSize, sudah termasuk
 * slot kosong untuk BYE) sedemikian rupa sehingga dua peserta dari PB/klub
 * yang sama sebisa mungkin TIDAK bertemu di babak 1.
 *
 * Strategi: coba banyak kombinasi acak, ambil yang paling sedikit
 * tabrakan (peserta 1 klub bertemu di babak 1), lalu lakukan perbaikan
 * lokal (tukar posisi) untuk pasangan yang masih bentrok.
 *
 * Catatan: jika satu PB punya peserta lebih dari separuh total peserta,
 * tabrakan sesama PB di babak 1 tidak bisa dihindari sepenuhnya secara
 * matematis. Fungsi ini akan meminimalkan sebisa mungkin.
 */
export function arrangeSlotsAvoidingSameClub(
  participants: Participant[],
  bracketSize: number
): { slots: Slot[]; remainingCollisions: number } {
  const byeCount = bracketSize - participants.length;

  let best: Slot[] | null = null;
  let bestCollisions = Infinity;

  const MAX_ATTEMPTS = 400;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && bestCollisions > 0; attempt++) {
    const shuffledParticipants = shuffle(participants);
    const positions = shuffle(Array.from({ length: bracketSize }, (_, i) => i));
    const byePositions = new Set(positions.slice(0, byeCount));

    const slots: Slot[] = new Array(bracketSize).fill(null);
    let pIndex = 0;
    for (let s = 0; s < bracketSize; s++) {
      slots[s] = byePositions.has(s) ? null : shuffledParticipants[pIndex++];
    }

    const collisions = countCollisions(slots);
    if (collisions < bestCollisions) {
      best = slots;
      bestCollisions = collisions;
    }
  }

  let finalSlots = best ?? new Array(bracketSize).fill(null);
  if (bestCollisions > 0) {
    finalSlots = repairCollisions(finalSlots);
    bestCollisions = countCollisions(finalSlots);
  }

  return { slots: finalSlots, remainingCollisions: bestCollisions };
}

function countCollisions(slots: Slot[]): number {
  let collisions = 0;
  for (let m = 0; m < slots.length; m += 2) {
    const a = slots[m];
    const b = slots[m + 1];
    if (a && b && a.club_name && a.club_name === b.club_name) collisions++;
  }
  return collisions;
}

/** Perbaikan lokal: tukar posisi peserta antar pasangan untuk menghilangkan tabrakan PB. */
function repairCollisions(input: Slot[]): Slot[] {
  const arr = [...input];

  for (let m = 0; m < arr.length; m += 2) {
    const a = arr[m];
    const b = arr[m + 1];
    if (!a || !b || !a.club_name || a.club_name !== b.club_name) continue;

    // Cari slot lain (k) yang aman untuk ditukar dengan b.
    for (let k = 0; k < arr.length; k++) {
      if (k === m || k === m + 1) continue;
      const candidate = arr[k];
      if (!candidate) continue;

      const candidatePairIndex = k % 2 === 0 ? k + 1 : k - 1;
      const candidatePartner = arr[candidatePairIndex];

      const swapCreatesNewCollisionAtM = candidate.club_name === a.club_name;
      const swapCreatesNewCollisionAtK =
        !!candidatePartner && candidatePartner.club_name === b.club_name;

      if (!swapCreatesNewCollisionAtM && !swapCreatesNewCollisionAtK) {
        arr[m + 1] = candidate;
        arr[k] = b;
        break;
      }
    }
  }

  return arr;
}

export type RoundSchedule = { round: number; start: Date; end: Date };

/**
 * Parse HH:mm string ke menit sejak tengah malam (0-1439).
 */
function timeStrToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Cek apakah sebuah titik waktu (Date) berada di dalam rentang break_time
 * tertentu (berdasarkan jam-menit dalam sehari). Jika ya, kembalikan Date
 * baru yang sudah maju ke akhir break_time tersebut. Jika tidak, kembalikan
 * Date asli.
 */
function skipBreakIfInside(cursor: Date, breaks: { startMin: number; endMin: number }[]): Date {
  const cursorMin = cursor.getHours() * 60 + cursor.getMinutes();
  for (const b of breaks) {
    if (cursorMin >= b.startMin && cursorMin < b.endMin) {
      // Maju ke akhir break
      const newDate = new Date(cursor);
      newDate.setHours(Math.floor(b.endMin / 60), b.endMin % 60, 0, 0);
      return newDate;
    }
  }
  return cursor;
}

/**
 * Cek apakah rentang [start, end] (dalam menit) tumpang-tindih dengan
 * break time. Jika ya, kembalikan start baru (setelah break). Asumsi:
 * satu bentrokan saja ditangani per panggilan — pemanggil akan
 * memanggil ulang sampai tidak ada bentrokan.
 */
function avoidBreakOverlap(
  startDate: Date,
  durationMinutes: number,
  breaks: { startMin: number; endMin: number }[]
): Date {
  const startMin = startDate.getHours() * 60 + startDate.getMinutes();
  const endMin = startMin + durationMinutes;

  for (const b of breaks) {
    // Apakah rentang pertandingan tumpang-tindih dengan break?
    if (startMin < b.endMin && endMin > b.startMin) {
      // Mulai pertandingan setelah break selesai
      const newDate = new Date(startDate);
      newDate.setHours(Math.floor(b.endMin / 60), b.endMin % 60, 0, 0);
      return newDate;
    }
  }
  return startDate;
}

/**
 * Menghitung rentang jam (mulai - selesai) untuk setiap babak berdasarkan
 * jam mulai turnamen, durasi pertandingan per babak, waktu istirahat,
 * jumlah lapangan, dan daftar waktu istirahat khusus (break_times seperti
 * waktu sholat).
 *
 * Dengan N lapangan, setiap babak dibagi menjadi beberapa "gelombang"
 * (wave). Misal babak 1 punya 6 pertandingan dan hanya 3 lapangan, maka
 * ada 2 gelombang: 3 pertandingan jalan bersamaan, lalu istirahat, lalu
 * 3 pertandingan berikutnya.
 *
 * Durasi satu babak = waves × match_duration + (waves−1) × rest_duration
 */
export function computeRoundSchedule(
  bracket: Pick<Bracket, "start_time" | "match_duration_minutes" | "rest_duration_minutes" | "courts_count">,
  totalRounds: number,
  bracketSize: number,
  breakTimes: Pick<BreakTime, "start_time_str" | "end_time_str">[] = []
): RoundSchedule[] {
  const breaks = breakTimes.map((b) => ({
    startMin: timeStrToMinutes(b.start_time_str),
    endMin: timeStrToMinutes(b.end_time_str),
  }));

  const schedule: RoundSchedule[] = [];
  let cursor = new Date(bracket.start_time);

  for (let r = 1; r <= totalRounds; r++) {
    if (r > 1) {
      cursor = new Date(cursor.getTime() + bracket.rest_duration_minutes * 60_000);
    }

    // Lewati break time jika cursor jatuh di dalamnya
    cursor = skipBreakIfInside(cursor, breaks);

    // Hitung jumlah pertandingan & gelombang di babak ini
    const matchesInRound = Math.floor(bracketSize / Math.pow(2, r));
    const courts = Math.max(1, bracket.courts_count);
    const waves = Math.ceil(matchesInRound / courts);
    const roundDuration = waves * bracket.match_duration_minutes + Math.max(0, waves - 1) * bracket.rest_duration_minutes;

    // Pastikan seluruh durasi babak tidak tumpang-tindih dengan break time
    // (loop untuk menangani beberapa break berturut-turut)
    let adjusted = avoidBreakOverlap(cursor, roundDuration, breaks);
    while (adjusted.getTime() !== cursor.getTime()) {
      cursor = adjusted;
      adjusted = avoidBreakOverlap(cursor, roundDuration, breaks);
    }

    const start = new Date(cursor);
    const end = new Date(start.getTime() + roundDuration * 60_000);
    schedule.push({ round: r, start, end });
    cursor = end;
  }

  return schedule;
}

/**
 * Menghasilkan seluruh baris `matches` untuk sebuah bracket:
 * - Babak 1 diisi peserta hasil pengacakan (anti sesama-PB) + BYE otomatis menang.
 * - Babak selanjutnya dibuat KOSONG (garis-garis, menunggu pemenang babak sebelumnya),
 *   kecuali slot yang sudah pasti terisi karena BYE di babak 1.
 * - Jadwal jam tiap babak langsung dihitung di awal.
 */
export function generateMatchesForBracket(
  bracket: Bracket,
  participants: Participant[],
  breakTimes: Pick<BreakTime, "start_time_str" | "end_time_str">[] = []
): { matches: MatchInsert[]; totalRounds: number; bracketSize: number; remainingCollisions: number } {
  const bracketSize = nextPowerOfTwo(participants.length);
  const totalRounds = Math.log2(bracketSize);
  const { slots, remainingCollisions } = arrangeSlotsAvoidingSameClub(participants, bracketSize);
  const schedule = computeRoundSchedule(bracket, totalRounds, bracketSize, breakTimes);

  const matches: MatchInsert[] = [];

  // currentSlots: peserta yang MASUK ke babak ini di tiap posisi slot.
  let currentSlots: Slot[] = slots;
  let currentIsBye: boolean[] = slots.map((s) => s === null);

  for (let r = 1; r <= totalRounds; r++) {
    const roundSchedule = schedule[r - 1];
    const matchesInRound = currentSlots.length / 2;
    const courts = Math.max(1, bracket.courts_count);
    const waveSlotMs = (bracket.match_duration_minutes + bracket.rest_duration_minutes) * 60_000;
    const nextSlots: Slot[] = [];

    for (let m = 0; m < matchesInRound; m++) {
      const p1 = currentSlots[m * 2];
      const p2 = currentSlots[m * 2 + 1];
      const isBye1 = r === 1 && currentIsBye[m * 2];
      const isBye2 = r === 1 && currentIsBye[m * 2 + 1];

      let winner: Slot = null;
      if (r === 1) {
        if (isBye1 && p2) winner = p2;
        else if (isBye2 && p1) winner = p1;
      }

      // Hitung waktu per-gelombang (wave)
      const wave = Math.floor(m / courts);
      const waveStart = new Date(roundSchedule.start.getTime() + wave * waveSlotMs);
      const waveEnd = new Date(waveStart.getTime() + bracket.match_duration_minutes * 60_000);

      matches.push({
        bracket_id: bracket.id,
        round_number: r,
        match_index: m,
        participant1_id: p1?.id ?? null,
        participant2_id: p2?.id ?? null,
        participant1_is_bye: isBye1,
        participant2_is_bye: isBye2,
        winner_id: winner?.id ?? null,
        start_time: waveStart.toISOString(),
        end_time: waveEnd.toISOString(),
      });

      // Untuk babak selanjutnya: hanya terisi jika pemenang sudah pasti
      // (karena BYE). Jika belum pasti, tetap null -> tampil sebagai garis kosong.
      nextSlots.push(winner);
    }

    currentSlots = nextSlots;
    currentIsBye = new Array(currentSlots.length).fill(false);
  }

  return { matches, totalRounds, bracketSize, remainingCollisions };
}

/** Menentukan posisi slot pemenang sebuah match di babak berikutnya. */
export function nextRoundTarget(matchIndex: number): {
  nextMatchIndex: number;
  slot: "participant1_id" | "participant2_id";
} {
  return {
    nextMatchIndex: Math.floor(matchIndex / 2),
    slot: matchIndex % 2 === 0 ? "participant1_id" : "participant2_id",
  };
}

/**
 * Menghitung ulang jadwal (start_time, end_time) untuk semua pertandingan
 * berdasarkan konfigurasi bracket terbaru, TANPA mengubah peserta/posisi.
 * Mengembalikan map match_id → { start_time, end_time } yang baru.
 */
export function recomputeMatchTimes(
  bracket: Pick<Bracket, "start_time" | "match_duration_minutes" | "rest_duration_minutes" | "courts_count">,
  matches: { id: string; round_number: number; match_index: number }[],
  breakTimes: Pick<BreakTime, "start_time_str" | "end_time_str">[] = []
): Map<string, { start_time: string; end_time: string }> {
  const totalRounds = Math.max(...matches.map((m) => m.round_number), 1);
  // BracketSize = 2^totalRounds, tapi untuk perhitungan jadwal kita hanya perlu totalRounds
  const bracketSize = Math.pow(2, totalRounds);
  const schedule = computeRoundSchedule(bracket, totalRounds, bracketSize, breakTimes);

  const courts = Math.max(1, bracket.courts_count);
  const waveSlotMs = (bracket.match_duration_minutes + bracket.rest_duration_minutes) * 60_000;

  const result = new Map<string, { start_time: string; end_time: string }>();

  // Group matches by round
  const byRound = new Map<number, typeof matches>();
  for (const m of matches) {
    if (!byRound.has(m.round_number)) byRound.set(m.round_number, []);
    byRound.get(m.round_number)!.push(m);
  }

  for (const [roundNum, roundMatches] of byRound) {
    const roundSchedule = schedule[roundNum - 1];
    if (!roundSchedule) continue;

    for (const match of roundMatches) {
      const wave = Math.floor(match.match_index / courts);
      const waveStart = new Date(roundSchedule.start.getTime() + wave * waveSlotMs);
      const waveEnd = new Date(waveStart.getTime() + bracket.match_duration_minutes * 60_000);

      result.set(match.id, {
        start_time: waveStart.toISOString(),
        end_time: waveEnd.toISOString(),
      });
    }
  }

  return result;
}
