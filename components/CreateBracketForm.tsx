"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { createBracketAction } from "@/app/brackets/new/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/DatePicker";
import { TimePicker } from "@/components/TimePicker";

export default function CreateBracketForm({
  defaultMatchDuration,
  defaultRestDuration,
}: {
  defaultMatchDuration: number;
  defaultRestDuration: number;
}) {
  const [state, formAction, pending] = useActionState(createBracketAction, undefined);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  const today = new Date();
  const defaultDate = today.toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <Label htmlFor="name" className="mb-1.5 block text-ink-700">
          Nama Turnamen
        </Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Contoh: Turnamen Kemerdekaan RW 4 - Tunggal Putra"
          className="bg-court-50"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-1.5 block text-ink-700">Tanggal Mulai</Label>
          <DatePicker name="date" defaultValue={defaultDate} />
        </div>
        <div>
          <Label className="mb-1.5 block text-ink-700">Jam Mulai (Babak 1)</Label>
          <TimePicker name="time" defaultValue="08:00" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="match_duration_minutes" className="mb-1.5 block text-ink-700">
            Durasi tiap Babak (menit)
          </Label>
          <Input
            id="match_duration_minutes"
            name="match_duration_minutes"
            type="number"
            min={1}
            required
            defaultValue={defaultMatchDuration}
            className="bg-court-50"
          />
        </div>
        <div>
          <Label htmlFor="rest_duration_minutes" className="mb-1.5 block text-ink-700">
            Istirahat antar Babak (menit)
          </Label>
          <Input
            id="rest_duration_minutes"
            name="rest_duration_minutes"
            type="number"
            min={0}
            required
            defaultValue={defaultRestDuration}
            className="bg-court-50"
          />
        </div>
      </div>

      <p className="rounded-xl border border-court-100 bg-court-50 px-4 py-3 text-xs text-ink-500">
        Jam setiap babak berikutnya akan dihitung otomatis: jam selesai babak sebelumnya + durasi
        istirahat. Anda bisa menambahkan pasangan peserta dan mengacak bagan setelah bracket ini
        dibuat.
      </p>

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? "Menyimpan..." : "Buat Bracket"}
      </Button>
    </form>
  );
}
