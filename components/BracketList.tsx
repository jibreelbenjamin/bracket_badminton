"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { emitNavigationStart } from "./NavigationProgress";
import DeleteBracketButton from "./DeleteBracketButton";
import type { Bracket } from "@/lib/types";

export default function BracketList({ brackets }: { brackets: Bracket[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick(id: string) {
    emitNavigationStart();
    startTransition(() => {
      router.push(`/brackets/${id}`);
    });
  }

  return (
    <div className={`grid gap-4${isPending ? " bracket-list--loading" : ""}`}>
      {brackets.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-court-200 rounded-2xl">
          <p className="text-ink-500 text-sm">
            Belum ada bracket. Klik &ldquo;Buat Bracket Baru&rdquo; untuk memulai turnamen pertama Anda.
          </p>
        </div>
      ) : (
        brackets.map((b) => (
        <div
          key={b.id}
          className="bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl border border-court-100 relative cursor-pointer"
          onClick={() => handleClick(b.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleClick(b.id);
          }}
        >
          <div className="block p-5 pointer-events-none">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h2 className="font-semibold text-ink-900">{b.name}</h2>
                <p className="text-sm text-ink-500 mt-0.5">
                  Mulai{" "}
                  {new Date(b.start_time).toLocaleString("id-ID", {
                    dateStyle: "full",
                    timeStyle: "short",
                    timeZone: "Asia/Jakarta",
                  })}
                </p>
                <p className="text-xs text-ink-300 mt-1">
                  Durasi tiap babak {b.match_duration_minutes} menit &middot; Istirahat antar babak{" "}
                  {b.rest_duration_minutes} menit
                </p>
              </div>
              <span
                className={`text-xs uppercase font-semibold px-3 py-1 rounded-full whitespace-nowrap ${
                  b.status === "generated"
                    ? "bg-court-100 text-court-700"
                    : "bg-cork-100 text-cork-600"
                }`}
              >
                {b.status === "generated" ? "Sudah Diacak" : "Draft"}
              </span>
            </div>
          </div>

          <div className="absolute bottom-3 right-4" onClick={(e) => e.stopPropagation()}>
            <DeleteBracketButton bracketId={b.id} bracketName={b.name} />
          </div>
        </div>
        ))
      )}

      {isPending && (
        <div className="bracket-list__loading-overlay">
          <span className="bracket-list__spinner" />
          <span className="bracket-list__loading-text">Membuka bracket...</span>
        </div>
      )}
    </div>
  );
}
