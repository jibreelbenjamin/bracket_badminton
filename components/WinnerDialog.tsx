"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Trophy, Medal, X } from "lucide-react";
import type { MatchRow, Participant } from "@/lib/types";

export interface WinnerDialogHandle {
  show: () => void;
}

interface WinnerData {
  first: Participant | null;
  second: Participant | null;
  third: Participant[];
}

function determineWinners(
  matches: MatchRow[],
  participantMap: Map<string, Participant>
): WinnerData | null {
  if (matches.length === 0) return null;

  const totalRounds = Math.max(...matches.map((m) => m.round_number));
  if (totalRounds < 2) return null;

  const finalMatch = matches.find(
    (m) => m.round_number === totalRounds && m.match_index === 0 && !m.is_third_place
  );
  if (!finalMatch || !finalMatch.winner_id) return null;

  const first = participantMap.get(finalMatch.winner_id) ?? null;
  if (!first) return null;

  const finalLoserId =
    finalMatch.participant1_id === finalMatch.winner_id
      ? finalMatch.participant2_id
      : finalMatch.participant1_id;
  const second = finalLoserId ? participantMap.get(finalLoserId) ?? null : null;

  // Cari pertandingan juara 3 yang sebenarnya
  const thirdPlaceMatch = matches.find((m) => m.is_third_place);

  let third: Participant[] = [];

  if (thirdPlaceMatch && thirdPlaceMatch.winner_id) {
    // Ada pertandingan juara 3 & sudah ada pemenangnya
    const tpWinner = participantMap.get(thirdPlaceMatch.winner_id) ?? null;
    if (tpWinner) third = [tpWinner];
  } else {
    // Fallback: tentukan dari loser semifinal (cara lama)
    const semifinalMatches = matches.filter(
      (m) => m.round_number === totalRounds - 1
    );
    const finalistIds = new Set([
      finalMatch.participant1_id,
      finalMatch.participant2_id,
    ]);

    for (const sm of semifinalMatches) {
      if (!sm.winner_id) continue;
      const loserId =
        sm.participant1_id === sm.winner_id
          ? sm.participant2_id
          : sm.participant1_id;
      if (loserId && !finalistIds.has(loserId)) {
        const p = participantMap.get(loserId);
        if (p) third.push(p);
      }
    }
  }

  return { first, second, third };
}

function fireConfetti() {
  const duration = 3 * 1000;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ["#FFD700", "#C0C0C0", "#CD7F32"],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ["#FFD700", "#C0C0C0", "#CD7F32"],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();

  confetti({
    particleCount: 100,
    spread: 100,
    origin: { x: 0.5, y: 0.5 },
    colors: ["#FFD700", "#C0C0C0", "#CD7F32", "#185f52", "#fdecc4"],
  });
}

const WinnerDialog = forwardRef<WinnerDialogHandle, {
  matches: MatchRow[];
  participants: Participant[];
}>(function WinnerDialog({ matches, participants }, ref) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const firedRef = useRef(false);

  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.id, p])),
    [participants]
  );

  const winners = useMemo(
    () => determineWinners(matches, participantMap),
    [matches, participantMap]
  );

  const triggerOpen = useCallback(() => {
    setDismissed(false);
    firedRef.current = false;
    setOpen(true);
  }, []);

  useImperativeHandle(ref, () => ({
    show: triggerOpen,
  }), [triggerOpen]);

  // Auto-show saat pemenang pertama kali terdeteksi
  useEffect(() => {
    if (winners && !dismissed) {
      const timer = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(timer);
    }
  }, [winners, dismissed]);

  // Fire confetti saat dialog terbuka
  useEffect(() => {
    if (open && !firedRef.current) {
      firedRef.current = true;
      setTimeout(() => fireConfetti(), 300);
      setTimeout(() => fireConfetti(), 2000);
    }
  }, [open]);

  function handleClose() {
    setOpen(false);
    setDismissed(true);
  }

  if (!winners) return null;

  const { first, second, third } = winners;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm animate-in fade-in-0"
            onClick={handleClose}
          />

          {/* Dialog */}
          <div className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in-0 duration-300">
            {/* Header dengan gradient */}
            <div className="bg-linear-to-br from-court-700 via-court-600 to-court-800 px-8 py-8 text-center text-white">
              <Trophy className="h-12 w-12 mx-auto mb-3 text-yellow-300 drop-shadow-lg" />
              <h2 className="text-2xl font-display font-bold tracking-tight">
                Turnamen Selesai!
              </h2>
              <p className="text-court-100 mt-1 text-sm">
                Selamat kepada para pemenang!
              </p>
            </div>

            {/* Body */}
            <div className="px-8 py-6 space-y-5">
              {/* Juara 1 */}
              <div className="flex items-center gap-4 p-4 bg-linear-to-r from-yellow-50 to-amber-50 rounded-2xl border border-yellow-200">
                <div className="shrink-0 w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center text-white shadow-lg shadow-yellow-300/40">
                  {/* <Trophy className="h-6 w-6" /> */}
                  <p className="text-2xl">🥇</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wider">
                    Juara 1
                  </p>
                  <p className="text-lg font-display font-bold text-ink-900 truncate">
                    {first?.name ?? "—"}
                  </p>
                  {first?.club_name && (
                    <p className="text-sm text-ink-500 truncate">{first.club_name}</p>
                  )}
                </div>
              </div>

              {/* Juara 2 */}
              <div className="flex items-center gap-4 p-4 bg-linear-to-r from-gray-50 to-slate-50 rounded-2xl border border-gray-200">
                <div className="shrink-0 w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-white shadow-lg shadow-gray-300/40">
                  <p className="text-2xl">🥈</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Juara 2
                  </p>
                  <p className="text-lg font-display font-bold text-ink-900 truncate">
                    {second?.name ?? "—"}
                  </p>
                  {second?.club_name && (
                    <p className="text-sm text-ink-500 truncate">{second.club_name}</p>
                  )}
                </div>
              </div>

              {/* Juara 3 */}
              {third.length > 0 && (
                <div className="flex items-center gap-4 p-4 bg-linear-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-200">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-orange-400 flex items-center justify-center text-white shadow-lg shadow-orange-300/40">
                    <p className="text-2xl">🥉</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider">
                      Juara 3
                    </p>
                    {third.map((p, i) => (
                      <div key={p.id} className={i > 0 ? "mt-1" : ""}>
                        <p className="text-sm font-display font-bold text-ink-900 truncate">
                          {p.name}
                        </p>
                        {p.club_name && (
                          <p className="text-xs text-ink-500 truncate">{p.club_name}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
});

export default WinnerDialog;
