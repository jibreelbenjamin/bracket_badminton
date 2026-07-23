"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Loader2, Maximize2, Minimize2, Trophy } from "lucide-react";
import { roundLabel } from "@/lib/bracket-logic";
import type { Bracket, MatchRow, Participant, ScheduleDay, RoundAssignment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import MatchBox from "./MatchBox";
import ShareBracketButton from "./ShareBracketButton";
import WinnerDialog, { type WinnerDialogHandle } from "./WinnerDialog";
import { useBracketLoading } from "./BracketLoadingProvider";

const MATCH_HEIGHT = 96; // jarak vertikal antar pertandingan di babak 1 (px)
const BOX_HEIGHT = 84; // tinggi kotak pertandingan (px)
const COLUMN_WIDTH = 220; // lebar kotak pertandingan (px)
const CONNECTOR_WIDTH = 40; // lebar area garis penghubung antar babak (px)

export default function BracketBoard({
  bracket,
  matches,
  participants,
  scheduleDays = [],
  roundAssignments = [],
  readonly = false,
}: {
  bracket: Bracket;
  matches: MatchRow[];
  participants: Participant[];
  scheduleDays?: ScheduleDay[];
  roundAssignments?: RoundAssignment[];
  readonly?: boolean;
}) {
  const exportRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const winnerDialogRef = useRef<WinnerDialogHandle>(null);
  const [exporting, setExporting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { isBracketLoading } = useBracketLoading();

  // Build round → day lookup: dari explicit assignments + auto-detect dari match time
  const roundDayMap = useMemo(() => {
    const map = new Map<number, ScheduleDay>();
    const dayById = new Map(scheduleDays.map((sd) => [sd.id, sd]));

    // 1. Explicit round assignments
    for (const ra of roundAssignments) {
      const day = dayById.get(ra.schedule_day_id);
      if (day) {
        map.set(ra.round_number, day);
      }
    }

    // 2. Fallback: deteksi hari dari match.start_time (untuk babak auto-distribute)
    // Cari tanggal dari pertandingan pertama setiap babak
    if (scheduleDays.length > 0) {
      const dayByDate = new Map<string, ScheduleDay>();
      for (const sd of scheduleDays) {
        dayByDate.set(sd.date, sd);
      }

      // Group matches by round, ambil start_time match pertama
      const roundsWithoutDay = new Set<number>();
      for (const m of matches) {
        if (!map.has(m.round_number)) {
          roundsWithoutDay.add(m.round_number);
        }
      }

      for (const roundNum of roundsWithoutDay) {
        const firstMatch = matches.find((m) => m.round_number === roundNum && m.start_time);
        if (firstMatch?.start_time) {
          const matchDate = firstMatch.start_time.slice(0, 10); // YYYY-MM-DD
          const day = dayByDate.get(matchDate);
          if (day) {
            map.set(roundNum, day);
          }
        }
      }
    }

    return map;
  }, [scheduleDays, roundAssignments, matches]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === fullscreenRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (fullscreenRef.current) {
        await fullscreenRef.current.requestFullscreen();
      }
    } catch {
      toast.error("Mode layar penuh tidak didukung di perangkat/browser ini.");
    }
  }

  const participantMap = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);

  // Hitung nomor pertandingan global (diurut berdasarkan round_number lalu match_index)
  const matchNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    let counter = 1;
    for (const m of matches) {
      map.set(m.id, counter++);
    }
    return map;
  }, [matches]);

  const roundsMap = useMemo(() => {
    const map = new Map<number, MatchRow[]>();
    for (const m of matches) {
      if (!map.has(m.round_number)) map.set(m.round_number, []);
      map.get(m.round_number)!.push(m);
    }
    for (const list of map.values()) list.sort((a, b) => a.match_index - b.match_index);
    return map;
  }, [matches]);

  const totalRounds = matches.length > 0 ? Math.max(...roundsMap.keys()) : 0;
  const round1Count = roundsMap.get(1)?.length ?? 0;
  const totalHeight = MATCH_HEIGHT * round1Count;

  const finalMatch = roundsMap.get(totalRounds)?.[0];
  const champion =
    finalMatch?.winner_id ? participantMap.get(finalMatch.winner_id) ?? null : null;

  // Cari pertandingan perebutan juara 3
  const thirdPlaceMatch = matches.find((m) => m.is_third_place);
  const thirdPlaceP1 = thirdPlaceMatch?.participant1_id
    ? participantMap.get(thirdPlaceMatch.participant1_id) ?? null
    : null;
  const thirdPlaceP2 = thirdPlaceMatch?.participant2_id
    ? participantMap.get(thirdPlaceMatch.participant2_id) ?? null
    : null;
  const thirdPlaceWinner = thirdPlaceMatch?.winner_id
    ? participantMap.get(thirdPlaceMatch.winner_id) ?? null
    : null;

  async function handleExport() {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 3,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const link = document.createElement("a");
      const safeName = bracket.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
      link.download = `bagan_${safeName || "badminton"}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.error("Gagal membuat gambar. Coba lagi.");
    } finally {
      setExporting(false);
    }
  }

  if (totalRounds === 0) return null;

  return (
    <div
      ref={fullscreenRef}
      className={isFullscreen ? "h-full overflow-auto bg-court-50 p-8" : ""}
    >
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div>
          <h2 className="text-lg font-display font-bold text-court-900">Bagan Pertandingan</h2>
          <p className="text-sm text-ink-500">{bracket.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={toggleFullscreen}>
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            {isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
          </Button>
          {!isFullscreen && !readonly && (
            <ShareBracketButton bracketId={bracket.id} currentShareToken={bracket.share_token} />
          )}
          {!isFullscreen && (
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="bg-court-900 hover:bg-ink-900"
            >
              {exporting ? "Menyiapkan gambar..." : "⬇ Unduh Gambar (HD)"}
            </Button>
          )}
        </div>
      </div>

      {champion && (
        <div className="mb-4 flex items-center gap-3 p-3 bg-court-50 rounded-2xl border border-court-200">
          <div className="flex-1">
            <p className="text-sm font-display font-bold text-court-900">
              Turnamen selesai!
            </p>
            <p className="text-xs text-ink-500">
              Lihat siapa saja pemenangnya.
            </p>
          </div>
          <Button
            onClick={() => winnerDialogRef.current?.show()}
            size="sm"
            className="shrink-0 bg-court-700 hover:bg-court-800 text-white"
          >
            Lihat Pemenang
          </Button>
        </div>
      )}

      <WinnerDialog ref={winnerDialogRef} matches={matches} participants={participants} />

      <div className="relative overflow-x-auto pb-6 -mx-6 px-6">
        {/* Loading overlay */}
        {isBracketLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-lg border border-court-100">
              <Loader2 className="h-8 w-8 animate-spin text-court-700" />
              <p className="text-sm font-medium text-ink-700">Memperbarui bagan...</p>
            </div>
          </div>
        )}

        <div ref={exportRef} className="bracket-export">
          {Array.from({ length: totalRounds }, (_, i) => i + 1).map((roundNum) => {
            const roundMatches = roundsMap.get(roundNum) ?? [];
            const spacing = MATCH_HEIGHT * Math.pow(2, roundNum - 1);
            const isLastRound = roundNum === totalRounds;
            const isSemifinal = roundNum === totalRounds - 1;
            const first = roundMatches[0];
            const last = roundMatches[roundMatches.length - 1];

            return (
              <div
                key={roundNum}
                className="bracket-round"
                style={{ width: isLastRound ? COLUMN_WIDTH : COLUMN_WIDTH + CONNECTOR_WIDTH }}
              >
                <div className="round-header">
                  <div className="round-title">{roundLabel(roundNum, totalRounds)}</div>
                  <div className="round-match-count">{roundMatches.length} pertandingan</div>
                  {first?.start_time && last?.end_time && (
                    <div className="round-time">
                      {formatTime(first.start_time)} - {formatTime(last.end_time)}
                    </div>
                  )}
                  {roundDayMap.has(roundNum) && (
                    <div className="round-day text-[10px] text-court-600 mt-0.5">
                      {new Date(roundDayMap.get(roundNum)!.date + "T00:00:00").toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: "Asia/Jakarta",
                      })}
                    </div>
                  )}
                </div>

                <div className="round-body" style={{ height: totalHeight }}>
                  {roundMatches
                    .filter((m) => !m.is_third_place)
                    .map((match) => {
                    const center = spacing * (match.match_index + 0.5);
                    return (
                      <MatchBox
                        key={match.id}
                        bracketId={bracket.id}
                        match={match}
                        p1={match.participant1_id ? participantMap.get(match.participant1_id) ?? null : null}
                        p2={match.participant2_id ? participantMap.get(match.participant2_id) ?? null : null}
                        style={{ top: center - BOX_HEIGHT / 2, height: BOX_HEIGHT }}
                        readonly={readonly}
                        matchNumber={matchNumberMap.get(match.id)}
                      />
                    );
                  })}

                  {!isLastRound &&
                    pairIndices(roundMatches.length).map(([a, b]) => {
                      const centerA = spacing * (a + 0.5);
                      const centerB = spacing * (b + 0.5);
                      return (
                        <div
                          key={`${roundNum}-${a}`}
                          className="connector"
                          style={{ top: centerA, height: centerB - centerA }}
                        />
                      );
                    })}

                  {/* Pertandingan Perebutan Juara 3 — di atas pertandingan Semifinal */}
                  {isSemifinal && thirdPlaceMatch && (() => {
                    const firstMatchTop = spacing * 0.5 - BOX_HEIGHT / 2;
                    // Posisi dari atas round-body, pastikan tidak negatif
                    const thirdPlaceTop = Math.max(6, firstMatchTop - BOX_HEIGHT - 210);
                    const thirdPlaceBottom = thirdPlaceTop + BOX_HEIGHT;
                    return (
                      <>
                        {/* Garis pemisah putus-putus */}
                        <div
                          className="absolute left-0 right-10 border-t-2 border-dashed border-amber-300/60"
                          style={{ top: Math.max(0, thirdPlaceTop - 35) }}
                        />
                        {/* Label badge */}
                        <div
                          className="absolute left-0 flex justify-center"
                          style={{ top: Math.max(2, thirdPlaceTop - 16) }}
                        >
                          <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-300 rounded-lg px-3 py-0.5 shadow-sm">
                            <span className="text-xs">🥉</span>
                            <span className="text-[10px] font-bold text-amber-800 tracking-wide">
                              Perebutan Juara 3
                            </span>
                          </div>
                        </div>
                        {/* Info waktu */}
                        {/* {thirdPlaceMatch.start_time && thirdPlaceMatch.end_time && (
                          <div
                            className="absolute left-0 right-0 text-center"
                            style={{ top: thirdPlaceTop + 10 }}
                          >
                            <span className="text-[10px] text-ink-400">
                              {formatTime(thirdPlaceMatch.start_time)} – {formatTime(thirdPlaceMatch.end_time)}
                            </span>
                          </div>
                        )} */}
                        {/* Kotak pertandingan */}
                        <MatchBox
                          bracketId={bracket.id}
                          match={thirdPlaceMatch}
                          p1={thirdPlaceP1}
                          p2={thirdPlaceP2}
                          style={{
                            top: thirdPlaceTop + 14,
                            height: BOX_HEIGHT,
                          }}
                          readonly={readonly}
                          matchNumber={undefined}
                        />
                        {/* Label pemenang */}
                        {/* {thirdPlaceWinner && (
                          <div
                            className="absolute left-0 right-0 flex justify-center"
                            style={{ top: thirdPlaceBottom + 4 }}
                          >
                            <div className="inline-flex items-center gap-1 bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-0.5 shadow-sm">
                              <span className="text-[10px]">🥉</span>
                              <span className="text-[10px] font-bold text-amber-800">
                                {thirdPlaceWinner.name}
                              </span>
                              {thirdPlaceWinner.club_name && (
                                <span className="text-[9px] text-ink-400">
                                  · {thirdPlaceWinner.club_name}
                                </span>
                              )}
                            </div>
                          </div>
                        )} */}
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function pairIndices(count: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < count; i += 2) pairs.push([i, i + 1]);
  return pairs;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}
