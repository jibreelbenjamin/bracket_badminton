"use client";

import { useEffect, useState } from "react";
import { Info, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  bracketId: string;
  scheduleDayCount: number;
  hasMatches: boolean;
  hasUnassignedRounds: boolean;
};

const STORAGE_KEY_PREFIX = "schedule-reminder-dismissed-";

export default function ScheduleReminderAlert({
  bracketId,
  scheduleDayCount,
  hasMatches,
  hasUnassignedRounds,
}: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const key = STORAGE_KEY_PREFIX + bracketId;
    const stored = localStorage.getItem(key);
    setDismissed(stored === "true");
  }, [bracketId]);

  // Jangan tampilkan jika tidak ada bagan, hari hanya 1, atau sudah dismissed
  if (!hasMatches || scheduleDayCount < 2 || dismissed) return null;

  function handleDismiss() {
    const key = STORAGE_KEY_PREFIX + bracketId;
    localStorage.setItem(key, "true");
    setDismissed(true);
  }

  function handleOpenSchedule() {
    // Klik tombol "Ubah jadwal" untuk membuka dialog
    const trigger = document.getElementById("schedule-dialog-trigger");
    if (trigger) {
      trigger.click();
    }
    // Scroll ke section penugasan babak setelah dialog terbuka
    setTimeout(() => {
      const section = document.getElementById("round-assignment-section");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-blue-300 bg-blue-50 p-4 shadow-sm">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-blue-800">
          Atur Babak per Hari
        </p>
        <p className="mt-0.5 text-sm text-blue-700">
          Bagan sudah diacak! Kamu bisa menentukan babak mana yang dimainkan di setiap hari
          pelaksanaan.
          {hasUnassignedRounds && (
            <> Saat ini beberapa babak masih didistribusikan secara otomatis.</>
          )}
        </p>

        <Button
          onClick={handleOpenSchedule}
          size="sm"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          <Settings className="h-3.5 w-3.5" />
          Atur Babak per Hari
        </Button>
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded-lg p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-600 transition-colors"
        aria-label="Tutup notifikasi"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

