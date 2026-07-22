import type { Bracket, BreakTime, MatchInsert, Participant, ScheduleDay, RoundAssignment } from "@/lib/types";

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

/** WIB offset in minutes (Asia/Jakarta = UTC+7). */
const WIB_OFFSET_MINUTES = 7 * 60;

/**
 * Dapatkan menit sejak tengah malam dalam zona WIB (Asia/Jakarta)
 * dari sebuah objek Date, terlepas dari timezone server.
 */
function getWIBMinutes(date: Date): number {
  const wibTime = date.getTime() + WIB_OFFSET_MINUTES * 60_000;
  const totalMinutes = Math.floor(wibTime / 60_000);
  return totalMinutes % (24 * 60);
}

/**
 * Set jam dan menit pada Date dalam zona WIB, mengembalikan Date baru.
 */
function setWIBTime(date: Date, hours: number, minutes: number, seconds: number, ms: number): Date {
  const targetWIBMinutes = hours * 60 + minutes;
  const utcTargetMinutes = targetWIBMinutes - WIB_OFFSET_MINUTES;
  const normalizedMinutes = ((utcTargetMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const newDate = new Date(date);
  newDate.setUTCHours(Math.floor(normalizedMinutes / 60), normalizedMinutes % 60, seconds, ms);
  return newDate;
}

/**
 * Cek apakah sebuah titik waktu (Date) berada di dalam rentang break_time
 * tertentu (berdasarkan jam-menit dalam sehari). Jika ya, kembalikan Date
 * baru yang sudah maju ke akhir break_time tersebut. Jika tidak, kembalikan
 * Date asli.
 */
function skipBreakIfInside(cursor: Date, breaks: { startMin: number; endMin: number }[]): Date {
  const cursorMin = getWIBMinutes(cursor);
  for (const b of breaks) {
    if (cursorMin >= b.startMin && cursorMin < b.endMin) {
      // Maju ke akhir break (dalam WIB)
      return setWIBTime(cursor, Math.floor(b.endMin / 60), b.endMin % 60, 0, 0);
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
  const startMin = getWIBMinutes(startDate);
  const endMin = startMin + durationMinutes;

  for (const b of breaks) {
    // Apakah rentang pertandingan tumpang-tindih dengan break?
    if (startMin < b.endMin && endMin > b.startMin) {
      // Mulai pertandingan setelah break selesai (dalam WIB)
      return setWIBTime(startDate, Math.floor(b.endMin / 60), b.endMin % 60, 0, 0);
    }
  }
  return startDate;
}

/**
 * Menghitung waktu mulai untuk setiap gelombang (wave) dalam satu babak,
 * dengan memperhitungkan waktu istirahat khusus di antara gelombang.
 *
 * Jika sebuah gelombang akan tumpang-tindih dengan break time (misalnya
 * jam istirahat khusus 17:30-18:00), gelombang tersebut dan gelombang
 * berikutnya DIMUNDURKAN hingga setelah break selesai — BUKAN seluruh babak.
 *
 * Contoh dengan 3 lapangan, durasi 25 menit, istirahat 5 menit:
 *   Wave 0: 16:00-16:25
 *   Wave 1: 16:30-16:55
 *   Wave 2: 17:00-17:25
 *   -- istirahat khusus 17:30-18:00 --
 *   Wave 3: 18:00-18:25  (dimundurkan)
 *   Wave 4: 18:30-18:55
 *
 * @returns Array waktu mulai untuk setiap gelombang (indeks 0 = wave pertama)
 */
function computeWaveStartTimes(
  startTime: Date,
  waves: number,
  matchDurationMinutes: number,
  restDurationMinutes: number,
  breaks: { startMin: number; endMin: number }[]
): Date[] {
  const waveStarts: Date[] = [];
  let cursor = new Date(startTime);

  for (let w = 0; w < waves; w++) {
    // Lewati break time jika cursor jatuh di dalamnya
    cursor = skipBreakIfInside(cursor, breaks);

    // Cek apakah gelombang ini (cursor → cursor+durasi) tumpang-tindih dengan break
    let adjusted = avoidBreakOverlap(cursor, matchDurationMinutes, breaks);
    while (adjusted.getTime() !== cursor.getTime()) {
      cursor = adjusted;
      adjusted = avoidBreakOverlap(cursor, matchDurationMinutes, breaks);
    }

    waveStarts.push(new Date(cursor));

    // Maju ke gelombang berikutnya: durasi pertandingan + durasi istirahat
    cursor = new Date(cursor.getTime() + (matchDurationMinutes + restDurationMinutes) * 60_000);
  }

  return waveStarts;
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
 * Setiap GELOMBANG (bukan babak) diperiksa terhadap break time. Jika
 * sebuah gelombang bentrok dengan break time, hanya gelombang itu yang
 * dimundurkan — gelombang sebelumnya tetap jalan seperti biasa.
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

    // Hitung jumlah pertandingan & gelombang di babak ini
    const matchesInRound = Math.floor(bracketSize / Math.pow(2, r));
    const courts = Math.max(1, bracket.courts_count);
    const waves = Math.ceil(matchesInRound / courts);

    // Hitung waktu mulai setiap gelombang dengan memperhitungkan break time
    // di antara gelombang (bukan di level babak)
    const waveStarts = computeWaveStartTimes(
      cursor,
      waves,
      bracket.match_duration_minutes,
      bracket.rest_duration_minutes,
      breaks
    );

    const start = waveStarts[0];
    const lastWaveStart = waveStarts[waves - 1];
    const end = new Date(lastWaveStart.getTime() + bracket.match_duration_minutes * 60_000);

    schedule.push({ round: r, start, end });
    cursor = end;
  }

  return schedule;
}

/**
 * Menghitung jadwal babak dengan dukungan multi-hari (schedule_days).
 *
 * Jika `scheduleDays` dan `roundAssignments` disediakan, setiap babak
 * dijadwalkan pada hari yang ditentukan. Babak yang tidak memiliki
 * assignment akan didistribusikan otomatis ke hari yang masih ada slot.
 *
 * Jika `scheduleDays` kosong, fallback ke `computeRoundSchedule` (single day).
 */
export function computeRoundScheduleMultiDay(
  bracket: Pick<Bracket, "start_time" | "match_duration_minutes" | "rest_duration_minutes" | "courts_count">,
  totalRounds: number,
  bracketSize: number,
  scheduleDays: Pick<ScheduleDay, "id" | "date" | "start_time_str" | "end_time_str" | "day_index">[],
  roundAssignments: Pick<RoundAssignment, "round_number" | "schedule_day_id">[],
  breakTimes: Pick<BreakTime, "start_time_str" | "end_time_str">[] = []
): RoundSchedule[] {
  // Fallback ke single-day jika tidak ada schedule_days
  if (!scheduleDays || scheduleDays.length === 0) {
    return computeRoundSchedule(bracket, totalRounds, bracketSize, breakTimes);
  }

  const breaks = breakTimes.map((b) => ({
    startMin: timeStrToMinutes(b.start_time_str),
    endMin: timeStrToMinutes(b.end_time_str),
  }));

  // Buat map: round_number → schedule_day_id
  const roundToDay = new Map<number, string>();
  for (const ra of roundAssignments) {
    roundToDay.set(ra.round_number, ra.schedule_day_id);
  }

  // Buat map: schedule_day_id → day info
  const dayMap = new Map(scheduleDays.map((d) => [d.id, d]));

  // Urutkan hari berdasarkan day_index
  const sortedDays = [...scheduleDays].sort((a, b) => a.day_index - b.day_index);

  // Buat map: schedule_day_id → daftar round_number yang ditugaskan
  const dayRounds = new Map<string, number[]>();
  for (const d of sortedDays) {
    dayRounds.set(d.id, []);
  }

  // Distribusi babak: yang sudah di-assign ke hari tertentu, sisanya auto-distribute
  const assignedRounds = new Set<number>();
  for (let r = 1; r <= totalRounds; r++) {
    const dayId = roundToDay.get(r);
    if (dayId && dayRounds.has(dayId)) {
      dayRounds.get(dayId)!.push(r);
      assignedRounds.add(r);
    }
  }

  // Auto-distribute babak yang belum di-assign: isi hari pertama sampai
  // jam-nya penuh (tidak muat babak berikutnya), baru lanjut ke hari berikutnya.
  let currentDayIdx = 0;
  for (let r = 1; r <= totalRounds; r++) {
    if (assignedRounds.has(r)) continue;

    // Cari hari yang masih cukup untuk menampung babak ini
    let placed = false;
    for (let attempt = 0; attempt < sortedDays.length; attempt++) {
      const candidateDay = sortedDays[(currentDayIdx + attempt) % sortedDays.length];
      const existingRounds = dayRounds.get(candidateDay.id) ?? [];

      if (existingRounds.length === 0) {
        // Hari kosong → pasti muat (minimal 1 babak)
        existingRounds.push(r);
        dayRounds.set(candidateDay.id, existingRounds);
        currentDayIdx = (currentDayIdx + attempt) % sortedDays.length;
        placed = true;
        break;
      }

      // Simulasikan: apakah babak r muat di hari ini setelah babak terakhir yang sudah dijadwalkan?
      const dayEndMin = timeStrToMinutes(candidateDay.end_time_str);

      // Hitung estimasi waktu selesai babak r jika ditaruh setelah babak terakhir hari ini
      const lastRound = existingRounds[existingRounds.length - 1];
      const matchesInLastRound = Math.floor(bracketSize / Math.pow(2, lastRound));
      const courts = Math.max(1, bracket.courts_count);
      const wavesLastRound = Math.ceil(matchesInLastRound / courts);
      const lastRoundDuration = wavesLastRound * bracket.match_duration_minutes
        + Math.max(0, wavesLastRound - 1) * bracket.rest_duration_minutes;

      // Estimasi: mulai setelah babak terakhir + istirahat
      const dayStartMin = timeStrToMinutes(candidateDay.start_time_str);
      let estimatedStartMin = dayStartMin;
      for (const er of existingRounds) {
        const matchesER = Math.floor(bracketSize / Math.pow(2, er));
        const wavesER = Math.ceil(matchesER / courts);
        const durationER = wavesER * bracket.match_duration_minutes
          + Math.max(0, wavesER - 1) * bracket.rest_duration_minutes;
        estimatedStartMin += durationER;
        if (er !== existingRounds[existingRounds.length - 1]) {
          estimatedStartMin += bracket.rest_duration_minutes;
        }
      }
      estimatedStartMin += bracket.rest_duration_minutes; // istirahat antar babak

      // Estimasi durasi babak r
      const matchesR = Math.floor(bracketSize / Math.pow(2, r));
      const wavesR = Math.ceil(matchesR / courts);
      const durationR = wavesR * bracket.match_duration_minutes
        + Math.max(0, wavesR - 1) * bracket.rest_duration_minutes;
      const estimatedEndMin = estimatedStartMin + durationR;

      if (estimatedEndMin <= dayEndMin) {
        // Muat! Taruh di hari ini
        existingRounds.push(r);
        dayRounds.set(candidateDay.id, existingRounds);
        currentDayIdx = (currentDayIdx + attempt) % sortedDays.length;
        placed = true;
        break;
      }
      // Tidak muat, coba hari berikutnya
    }

    // Fallback: jika tidak ada hari yang muat (seharusnya jarang), taruh di hari terakhir
    if (!placed) {
      const lastDay = sortedDays[currentDayIdx % sortedDays.length];
      const existingRounds = dayRounds.get(lastDay.id) ?? [];
      existingRounds.push(r);
      dayRounds.set(lastDay.id, existingRounds);
    }
  }

  // Urutkan babak dalam setiap hari berdasarkan round_number
  for (const rounds of dayRounds.values()) {
    rounds.sort((a, b) => a - b);
  }

  const schedule: RoundSchedule[] = [];
  const courts = Math.max(1, bracket.courts_count);
  const matchDuration = bracket.match_duration_minutes;
  const restDuration = bracket.rest_duration_minutes;

  for (const day of sortedDays) {
    const rounds = dayRounds.get(day.id) ?? [];
    if (rounds.length === 0) continue;

    // Waktu mulai hari ini: date + start_time_str
    const [startH, startM] = day.start_time_str.split(":").map(Number);
    const [endH, endM] = day.end_time_str.split(":").map(Number);
    const dayEndMin = endH * 60 + endM;

    let cursor = new Date(`${day.date}T${day.start_time_str}:00+07:00`);

    for (const roundNum of rounds) {
      const matchesInRound = Math.floor(bracketSize / Math.pow(2, roundNum));
      const waves = Math.ceil(matchesInRound / courts);

      // Hitung waktu mulai setiap gelombang dengan memperhitungkan break time
      // di antara gelombang (bukan di level babak)
      const waveStarts = computeWaveStartTimes(
        cursor,
        waves,
        matchDuration,
        restDuration,
        breaks
      );

      const start = waveStarts[0];
      const lastWaveStart = waveStarts[waves - 1];
      const end = new Date(lastWaveStart.getTime() + matchDuration * 60_000);

      // Cek apakah babak masih muat di hari ini (sebelum end_time_str)
      const endMin = getWIBMinutes(end);
      if (endMin > dayEndMin && typeof window === "undefined") {
        const roundDuration = endMin - getWIBMinutes(start);
        const cursorMin = getWIBMinutes(start);
        console.warn(
          `Babak ${roundNum} pada hari ${day.date} melebihi jam selesai (${day.end_time_str}). ` +
          `Dibutuhkan ${roundDuration} menit, hanya tersisa ${dayEndMin - cursorMin} menit.`
        );
      }

      schedule.push({ round: roundNum, start, end });
      cursor = end;

      // Istirahat antar babak
      if (rounds.indexOf(roundNum) < rounds.length - 1) {
        cursor = new Date(cursor.getTime() + restDuration * 60_000);
      }
    }
  }

  // Urutkan schedule berdasarkan round_number untuk konsistensi
  schedule.sort((a, b) => a.round - b.round);
  return schedule;
}

/**
 * Menghasilkan seluruh baris `matches` untuk sebuah bracket:
 * - Babak 1 diisi peserta hasil pengacakan (anti sesama-PB) + BYE otomatis menang.
 * - Babak selanjutnya dibuat KOSONG (garis-garis, menunggu pemenang babak sebelumnya),
 *   kecuali slot yang sudah pasti terisi karena BYE di babak 1.
 * - Jadwal jam tiap babak langsung dihitung di awal.
 * - Mendukung multi-hari (schedule_days + round_assignments) jika disediakan.
 */
export function generateMatchesForBracket(
  bracket: Bracket,
  participants: Participant[],
  breakTimes: Pick<BreakTime, "start_time_str" | "end_time_str">[] = [],
  scheduleDays: Pick<ScheduleDay, "id" | "date" | "start_time_str" | "end_time_str" | "day_index">[] = [],
  roundAssignments: Pick<RoundAssignment, "round_number" | "schedule_day_id">[] = []
): { matches: MatchInsert[]; totalRounds: number; bracketSize: number; remainingCollisions: number } {
  const bracketSize = nextPowerOfTwo(participants.length);
  const totalRounds = Math.log2(bracketSize);
  const { slots, remainingCollisions } = arrangeSlotsAvoidingSameClub(participants, bracketSize);

  // Gunakan multi-day schedule jika tersedia, jika tidak fallback ke single-day
  const schedule =
    scheduleDays.length > 0
      ? computeRoundScheduleMultiDay(bracket, totalRounds, bracketSize, scheduleDays, roundAssignments, breakTimes)
      : computeRoundSchedule(bracket, totalRounds, bracketSize, breakTimes);

  const matches: MatchInsert[] = [];

  // currentSlots: peserta yang MASUK ke babak ini di tiap posisi slot.
  let currentSlots: Slot[] = slots;
  let currentIsBye: boolean[] = slots.map((s) => s === null);

  for (let r = 1; r <= totalRounds; r++) {
    const matchesInRound = currentSlots.length / 2;
    const courts = Math.max(1, bracket.courts_count);
    const waves = Math.ceil(matchesInRound / courts);
    const nextSlots: Slot[] = [];

    // Konversi breakTimes ke format menit untuk computeWaveStartTimes
    const breakMins = breakTimes.map((b) => ({
      startMin: timeStrToMinutes(b.start_time_str),
      endMin: timeStrToMinutes(b.end_time_str),
    }));

    // Hitung waktu mulai aktual setiap gelombang (sudah memperhitungkan break time)
    const waveStartTimes = computeWaveStartTimes(
      schedule[r - 1].start,
      waves,
      bracket.match_duration_minutes,
      bracket.rest_duration_minutes,
      breakMins
    );

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

      // Gunakan waktu mulai gelombang yang sudah disesuaikan dengan break time
      const wave = Math.floor(m / courts);
      let waveStart = waveStartTimes[wave];
      let waveEnd = new Date(waveStart.getTime() + bracket.match_duration_minutes * 60_000);

      // Jika ini babak final DAN ada pertandingan juara 3,
      // geser final mundur setelah juara 3 selesai
      if (r === totalRounds && totalRounds >= 2) {
        // Juara 3 dimulai bersamaan dengan jadwal final asli
        // Final dimundurkan: juara 3 + rest + final
        const thirdPlaceShift =
          bracket.match_duration_minutes + bracket.rest_duration_minutes;
        waveStart = new Date(waveStart.getTime() + thirdPlaceShift * 60_000);
        waveEnd = new Date(waveEnd.getTime() + thirdPlaceShift * 60_000);
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
        start_time: waveStart.toISOString(),
        end_time: waveEnd.toISOString(),
        is_third_place: false,
      });

      // Untuk babak selanjutnya: hanya terisi jika pemenang sudah pasti
      // (karena BYE). Jika belum pasti, tetap null -> tampil sebagai garis kosong.
      nextSlots.push(winner);
    }

    currentSlots = nextSlots;
    currentIsBye = new Array(currentSlots.length).fill(false);
  }

  // Tambah pertandingan perebutan juara 3 (jika minimal ada semifinal)
  if (totalRounds >= 2) {
    const semiSchedule = schedule[totalRounds - 2]; // jadwal semifinal
    const finalSchedule = schedule[totalRounds - 1]; // jadwal final asli

    // Juara 3 dimulai di waktu yang sama dengan jadwal final asli
    const thirdPlaceStart = new Date(finalSchedule.start);
    const thirdPlaceEnd = new Date(
      thirdPlaceStart.getTime() + bracket.match_duration_minutes * 60_000
    );

    matches.push({
      bracket_id: bracket.id,
      round_number: totalRounds,
      match_index: 1,
      participant1_id: null,
      participant2_id: null,
      participant1_is_bye: false,
      participant2_is_bye: false,
      winner_id: null,
      start_time: thirdPlaceStart.toISOString(),
      end_time: thirdPlaceEnd.toISOString(),
      is_third_place: true,
    });
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
 * Mendukung multi-hari (schedule_days + round_assignments) jika disediakan.
 */
export function recomputeMatchTimes(
  bracket: Pick<Bracket, "start_time" | "match_duration_minutes" | "rest_duration_minutes" | "courts_count">,
  matches: { id: string; round_number: number; match_index: number }[],
  breakTimes: Pick<BreakTime, "start_time_str" | "end_time_str">[] = [],
  scheduleDays: Pick<ScheduleDay, "id" | "date" | "start_time_str" | "end_time_str" | "day_index">[] = [],
  roundAssignments: Pick<RoundAssignment, "round_number" | "schedule_day_id">[] = []
): Map<string, { start_time: string; end_time: string }> {
  const totalRounds = Math.max(...matches.map((m) => m.round_number), 1);
  const bracketSize = Math.pow(2, totalRounds);

  const schedule =
    scheduleDays.length > 0
      ? computeRoundScheduleMultiDay(bracket, totalRounds, bracketSize, scheduleDays, roundAssignments, breakTimes)
      : computeRoundSchedule(bracket, totalRounds, bracketSize, breakTimes);

  // Buat lookup schedule per round
  const roundScheduleMap = new Map<number, RoundSchedule>();
  for (const rs of schedule) {
    roundScheduleMap.set(rs.round, rs);
  }

  const courts = Math.max(1, bracket.courts_count);

  const result = new Map<string, { start_time: string; end_time: string }>();

  // Konversi breakTimes ke format menit untuk computeWaveStartTimes
  const breakMins = breakTimes.map((b) => ({
    startMin: timeStrToMinutes(b.start_time_str),
    endMin: timeStrToMinutes(b.end_time_str),
  }));

  // Group matches by round
  const byRound = new Map<number, typeof matches>();
  for (const m of matches) {
    if (!byRound.has(m.round_number)) byRound.set(m.round_number, []);
    byRound.get(m.round_number)!.push(m);
  }

  for (const [roundNum, roundMatches] of byRound) {
    const roundSchedule = roundScheduleMap.get(roundNum);
    if (!roundSchedule) continue;

    // Pisahkan pertandingan juara 3 dari pertandingan babak reguler
    // Juara 3 = match_index 1 di babak final (totalRounds), jika ada > 1 match di babak itu
    const isFinalRound = roundNum === totalRounds;
    const thirdPlaceMatches = isFinalRound
      ? roundMatches.filter((m) => m.match_index === 1)
      : [];
    const regularMatches = isFinalRound
      ? roundMatches.filter((m) => m.match_index === 0)
      : roundMatches;

    // Hitung jumlah gelombang untuk pertandingan reguler di babak ini
    const regularWaves = Math.ceil(regularMatches.length / courts);

    // Jika ada juara 3, final dimundurkan: juara 3 mulai duluan, final setelahnya
    const hasThirdPlace = thirdPlaceMatches.length > 0;
    const finalShift = hasThirdPlace
      ? bracket.match_duration_minutes + bracket.rest_duration_minutes
      : 0;

    // Hitung waktu mulai aktual setiap gelombang reguler
    const waveStartTimes = computeWaveStartTimes(
      new Date(roundSchedule.start.getTime() + finalShift * 60_000),
      regularWaves,
      bracket.match_duration_minutes,
      bracket.rest_duration_minutes,
      breakMins
    );

    for (const match of regularMatches) {
      const wave = Math.floor(match.match_index / courts);
      const waveStart = waveStartTimes[wave];
      const waveEnd = new Date(waveStart.getTime() + bracket.match_duration_minutes * 60_000);

      result.set(match.id, {
        start_time: waveStart.toISOString(),
        end_time: waveEnd.toISOString(),
      });
    }

    // Pertandingan juara 3: dijadwalkan di awal slot babak final
    for (const match of thirdPlaceMatches) {
      const thirdPlaceStart = new Date(roundSchedule.start);
      const thirdPlaceEnd = new Date(
        thirdPlaceStart.getTime() + bracket.match_duration_minutes * 60_000
      );
      result.set(match.id, {
        start_time: thirdPlaceStart.toISOString(),
        end_time: thirdPlaceEnd.toISOString(),
      });
    }
  }

  return result;
}
