"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { Loader2, Maximize2, Minimize2, Trophy } from "lucide-react";
import { roundLabel } from "@/lib/bracket-logic";
import type { Bracket, MatchRow, Participant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import MatchBox from "./MatchBox";
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
}: {
  bracket: Bracket;
  matches: MatchRow[];
  participants: Participant[];
}) {
  const exportRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const winnerDialogRef = useRef<WinnerDialogHandle>(null);
  const [exporting, setExporting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { isBracketLoading } = useBracketLoading();

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
        <h2 className="text-lg font-display font-bold text-court-900">Bagan Pertandingan</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={toggleFullscreen}>
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            {isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="bg-court-900 hover:bg-ink-900"
          >
            {exporting ? "Menyiapkan gambar..." : "⬇ Unduh Gambar (HD)"}
          </Button>
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
                  {first?.start_time && last?.end_time && (
                    <div className="round-time">
                      {formatTime(first.start_time)} - {formatTime(last.end_time)}
                    </div>
                  )}
                </div>

                <div className="round-body" style={{ height: totalHeight }}>
                  {roundMatches.map((match) => {
                    const center = spacing * (match.match_index + 0.5);
                    return (
                      <MatchBox
                        key={match.id}
                        bracketId={bracket.id}
                        match={match}
                        p1={match.participant1_id ? participantMap.get(match.participant1_id) ?? null : null}
                        p2={match.participant2_id ? participantMap.get(match.participant2_id) ?? null : null}
                        style={{ top: center - BOX_HEIGHT / 2, height: BOX_HEIGHT }}
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
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
