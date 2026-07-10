"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setWinnerAction } from "@/app/brackets/[id]/actions";
import type { MatchRow, Participant } from "@/lib/types";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  });
}

export default function MatchBox({
  bracketId,
  match,
  p1,
  p2,
  style,
  readonly = false,
}: {
  bracketId: string;
  match: MatchRow;
  p1: Participant | null;
  p2: Participant | null;
  style: React.CSSProperties;
  readonly?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const router = useRouter();

  const canPick =
    !readonly &&
    !isPending &&
    (!!p1 || !!p2) &&
    !match.participant1_is_bye &&
    !match.participant2_is_bye;

  function pick(winnerId: string) {
    if (!canPick) return;
    setProcessingId(winnerId);
    startTransition(async () => {
      try {
        await setWinnerAction(bracketId, match.id, winnerId);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menetapkan pemenang.");
      } finally {
        setProcessingId(null);
      }
    });
  }

  return (
    <div
      className={`match-box${isPending ? " match-box--loading" : ""}`}
      style={style}
      data-testid="match-box"
    >
      <div className="match-time">
        {match.start_time && match.end_time
          ? `${formatDate(match.start_time)},  ${formatTime(match.start_time)} - ${formatTime(match.end_time)}`
          : ""}
      </div>
      {isPending && (
        <div className="match-box__loading-overlay">
          <span className="match-box__spinner" />
          <span className="match-box__loading-text">Memproses...</span>
        </div>
      )}
      <PlayerRow
        participant={p1}
        isBye={match.participant1_is_bye}
        isWinner={!!match.winner_id && match.winner_id === p1?.id}
        clickable={canPick}
        isLoading={processingId === p1?.id}
        onClick={() => p1 && pick(p1.id)}
      />
      <PlayerRow
        participant={p2}
        isBye={match.participant2_is_bye}
        isWinner={!!match.winner_id && match.winner_id === p2?.id}
        clickable={canPick}
        isLoading={processingId === p2?.id}
        onClick={() => p2 && pick(p2.id)}
      />
    </div>
  );
}

function PlayerRow({
  participant,
  isBye,
  isWinner,
  clickable,
  isLoading,
  onClick,
}: {
  participant: Participant | null;
  isBye: boolean;
  isWinner: boolean;
  clickable: boolean;
  isLoading: boolean;
  onClick: () => void;
}) {
  if (isBye) {
    return (
      <div className="player-row bye">
        <span className="player-name">BYE</span>
      </div>
    );
  }

  if (!participant) {
    return <div className="player-row placeholder" />;
  }

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={`player-row${isWinner ? " winner" : ""}${isLoading ? " player-row--loading" : ""}`}
      title={
        isLoading
          ? "Memproses..."
          : clickable
            ? isWinner
              ? "Klik untuk membatalkan kemenangan"
              : "Klik untuk menetapkan sebagai pemenang"
            : undefined
      }
    >
      <span className="player-name">{participant.name}</span>
      {participant.club_name && <span className="player-club">{participant.club_name}</span>}
    </button>
  );
}
