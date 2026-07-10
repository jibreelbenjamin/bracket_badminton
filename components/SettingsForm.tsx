"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateSettingsAction } from "@/app/settings/actions";
import type { AppSettings } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, formAction, pending] = useActionState(updateSettingsAction, undefined);
  const [pin, setPin] = useState(settings.pin);
  const [matchDuration, setMatchDuration] = useState(String(settings.default_match_duration_minutes));
  const [restDuration, setRestDuration] = useState(String(settings.default_rest_duration_minutes));
  const [courtsCount, setCourtsCount] = useState(String(settings.default_courts_count));

  useEffect(() => {
    if (state?.success) toast.success(state.success);
    else if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="pin" className="mb-1.5 block text-ink-700">
          PIN Aplikasi (4 digit)
        </Label>
        <Input
          id="pin"
          name="pin"
          type="text"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          required
          disabled={pending}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full max-w-[160px] bg-court-50 text-center font-display text-xl font-bold tracking-[0.4em]"
        />
        <p className="mt-1.5 text-xs text-ink-500">
          PIN ini dipakai semua orang yang perlu mengelola aplikasi. Bagikan hanya ke panitia yang
          berwenang.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label
            htmlFor="default_match_duration_minutes"
            className="mb-1.5 block text-ink-700"
          >
            Default Durasi/Babak (menit)
          </Label>
          <Input
            id="default_match_duration_minutes"
            name="default_match_duration_minutes"
            type="number"
            min={1}
            required
            disabled={pending}
            value={matchDuration}
            onChange={(e) => setMatchDuration(e.target.value)}
            className="bg-court-50"
          />
        </div>
        <div>
          <Label
            htmlFor="default_rest_duration_minutes"
            className="mb-1.5 block text-ink-700"
          >
            Default Istirahat (menit)
          </Label>
          <Input
            id="default_rest_duration_minutes"
            name="default_rest_duration_minutes"
            type="number"
            min={0}
            required
            disabled={pending}
            value={restDuration}
            onChange={(e) => setRestDuration(e.target.value)}
            className="bg-court-50"
          />
        </div>
        <div>
          <Label
            htmlFor="default_courts_count"
            className="mb-1.5 block text-ink-700"
          >
            Default Lapangan Tersedia
          </Label>
          <Input
            id="default_courts_count"
            name="default_courts_count"
            type="number"
            min={1}
            required
            disabled={pending}
            value={courtsCount}
            onChange={(e) => setCourtsCount(e.target.value)}
            className="bg-court-50"
          />
        </div>
      </div>
      <p className="text-xs text-ink-500">
        Nilai default ini hanya dipakai untuk mengisi form saat membuat bracket baru — tidak
        mengubah bracket yang sudah ada.
      </p>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan Pengaturan"}
      </Button>
    </form>
  );
}
