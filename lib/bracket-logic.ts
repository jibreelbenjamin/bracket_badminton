import type { Bracket, MatchInsert, Participant } from "@/lib/types";

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
 * Menghitung rentang jam (mulai - selesai) untuk setiap babak berdasarkan
 * jam mulai turnamen, durasi pertandingan per babak, dan waktu istirahat
 * di antara babak. Dihitung langsung di awal (bukan menunggu hasil
 * pertandingan sebelumnya selesai).
 */
export function computeRoundSchedule(
  bracket: Pick<Bracket, "start_time" | "match_duration_minutes" | "rest_duration_minutes">,
  totalRounds: number
): RoundSchedule[] {
  const schedule: RoundSchedule[] = [];
  let cursor = new Date(bracket.start_time);

  for (let r = 1; r <= totalRounds; r++) {
    if (r > 1) {
      cursor = new Date(cursor.getTime() + bracket.rest_duration_minutes * 60_000);
    }
    const start = new Date(cursor);
    const end = new Date(start.getTime() + bracket.match_duration_minutes * 60_000);
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
  participants: Participant[]
): { matches: MatchInsert[]; totalRounds: number; bracketSize: number; remainingCollisions: number } {
  const bracketSize = nextPowerOfTwo(participants.length);
  const totalRounds = Math.log2(bracketSize);
  const { slots, remainingCollisions } = arrangeSlotsAvoidingSameClub(participants, bracketSize);
  const schedule = computeRoundSchedule(bracket, totalRounds);

  const matches: MatchInsert[] = [];

  // currentSlots: peserta yang MASUK ke babak ini di tiap posisi slot.
  let currentSlots: Slot[] = slots;
  let currentIsBye: boolean[] = slots.map((s) => s === null);

  for (let r = 1; r <= totalRounds; r++) {
    const roundSchedule = schedule[r - 1];
    const matchesInRound = currentSlots.length / 2;
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

      matches.push({
        bracket_id: bracket.id,
        round_number: r,
        match_index: m,
        participant1_id: p1?.id ?? null,
        participant2_id: p2?.id ?? null,
        participant1_is_bye: isBye1,
        participant2_is_bye: isBye2,
        winner_id: winner?.id ?? null,
        start_time: roundSchedule.start.toISOString(),
        end_time: roundSchedule.end.toISOString(),
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
