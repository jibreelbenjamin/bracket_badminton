"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import BracketBoard from "@/components/BracketBoard";
import type { Bracket, MatchRow, Participant, ScheduleDay, RoundAssignment } from "@/lib/types";

export const DEFAULT_POLL_INTERVAL_MS = 5000;

type LivePayload = {
  bracket: Bracket;
  participants: Participant[];
  matches: MatchRow[];
  updatedAt: string;
};

function matchesEqual(a: MatchRow[], b: MatchRow[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.participant1_id !== y.participant1_id ||
      x.participant2_id !== y.participant2_id ||
      x.winner_id !== y.winner_id ||
      x.participant1_is_bye !== y.participant1_is_bye ||
      x.participant2_is_bye !== y.participant2_is_bye ||
      x.start_time !== y.start_time ||
      x.end_time !== y.end_time
    ) {
      return false;
    }
  }
  return true;
}

function participantsEqual(a: Participant[], b: Participant[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.id !== y.id || x.name !== y.name || x.club_name !== y.club_name) {
      return false;
    }
  }
  return true;
}

/**
 * BracketLiveView membungkus BracketBoard dengan pembaruan realtime.
 *
 * Data awal diambil dari Server Component (props). Setelah itu komponen
 * ini mem-poll endpoint server yang aman (app/brackets/[id]/live) secara
 * berkala — tanpa memakai anon key Supabase di browser (akses tetap lewat
 * service role di sisi server, sesuai arsitektur & RLS aplikasi). Ketika
 * ada perubahan (mis. pemenang pertandingan diupdate pengguna lain), bagan
 * langsung diperbarui tanpa perlu refresh halaman.
 */
export default function BracketLiveView({
  bracket,
  matches,
  participants,
  scheduleDays = [],
  roundAssignments = [],
  readonly = false,
  liveUrl,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: {
  bracket: Bracket;
  matches: MatchRow[];
  participants: Participant[];
  scheduleDays?: ScheduleDay[];
  roundAssignments?: RoundAssignment[];
  readonly?: boolean;
  /** URL endpoint live yang akan dipoll (sudah termasuk query auth bila perlu). */
  liveUrl: string;
  pollIntervalMs?: number;
}) {
  const [liveMatches, setLiveMatches] = useState<MatchRow[]>(matches);
  const [liveParticipants, setLiveParticipants] = useState<Participant[]>(participants);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [connection, setConnection] = useState<"live" | "connecting" | "offline">("connecting");
  const [changedFlash, setChangedFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef(false);

  // Sinkronkan ulang state lokal bila Server Component mengirim props baru
  // (mis. setelah aksi sendiri yang memanggil router.refresh()).
  useEffect(() => {
    setLiveMatches(matches);
    setLiveParticipants(participants);
  }, [matches, participants]);

  // Ambil data terbaru satu kali.
  const pollOnce = useCallback(
    async function pollOnce() {
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        const res = await fetch(liveUrl, { cache: "no-store" });
        if (!res.ok) {
          setConnection((c) => (c === "live" ? c : "offline"));
          return;
        }
        const payload = (await res.json()) as LivePayload;

        const mChanged = !matchesEqual(payload.matches, liveMatches);
        const pChanged = !participantsEqual(payload.participants, liveParticipants);

        if (mChanged) setLiveMatches(payload.matches);
        if (pChanged) setLiveParticipants(payload.participants);

        if (mChanged || pChanged) {
          // Kilatan halus menandakan bagan diperbarui otomatis.
          setChangedFlash(true);
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setChangedFlash(false), 1500);
        }

        setLastUpdated(new Date(payload.updatedAt));
        setConnection("live");
      } catch {
        setConnection((c) => (c === "live" ? c : "offline"));
      } finally {
        pollingRef.current = false;
      }
    },
    [liveUrl, liveMatches, liveParticipants]
  );

  // Polling berkala.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      await pollOnce();
      if (cancelled) return;
      timer = setTimeout(tick, pollIntervalMs);
    };

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pollOnce, pollIntervalMs]);

  // Poll segera setelah tab terlihat kembali (jeda lama).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        pollOnce();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [pollOnce]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        {changedFlash && (
          <span className="inline-flex items-center rounded-full bg-court-50 border border-court-200 px-2.5 py-1 font-medium text-court-700">
            Bagan diperbarui otomatis
          </span>
        )}
        <div className="flex items-center gap-3 ml-auto">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium transition-colors ${
              connection === "live"
                ? "bg-red-50 text-red-600 border border-red-200"
                : connection === "connecting"
                  ? "bg-ink-50 text-ink-500 border border-ink-200"
                  : "bg-amber-50 text-amber-600 border border-amber-200"
            }`}
            title={
              connection === "live"
                ? "Terhubung ke pembaruan realtime"
                : connection === "connecting"
                  ? "Menghubungkan ke pembaruan realtime…"
                  : "Pembaruan realtime sementara tidak tersedia. Data ditampilkan dari server."
            }
          >
            <Radio className="h-3.5 w-3.5" />
            {connection === "live" ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                LIVE
              </>
            ) : connection === "connecting" ? (
              "Menghubungkan…"
            ) : (
              "Offline"
            )}
          </span>
          {lastUpdated && (
            <span className="text-ink-400">
              Terakhir diperbarui {lastUpdated.toLocaleTimeString("id-ID")}
            </span>
          )}
        </div>
      </div>

      <div className={changedFlash ? "transition-opacity" : undefined}>
        <BracketBoard
          bracket={bracket}
          matches={liveMatches}
          participants={liveParticipants}
          scheduleDays={scheduleDays}
          roundAssignments={roundAssignments}
          readonly={readonly}
        />
      </div>
    </div>
  );
}
