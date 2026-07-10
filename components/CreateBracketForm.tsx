"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { createBracketAction } from "@/app/brackets/new/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/DatePicker";
import { TimePicker } from "@/components/TimePicker";

type BreakEntry = { id: number };

let breakIdCounter = 0;
function nextBreakId() {
  return ++breakIdCounter;
}

export default function CreateBracketForm({
  defaultMatchDuration,
  defaultRestDuration,
  defaultCourtsCount,
}: {
  defaultMatchDuration: number;
  defaultRestDuration: number;
  defaultCourtsCount: number;
}) {
  const [state, formAction, pending] = useActionState(createBracketAction, undefined);
  const [breaks, setBreaks] = useState<BreakEntry[]>([]);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  const today = new Date();
  const defaultDate = today.toISOString().slice(0, 10);

  function addBreak() {
    setBreaks((prev) => [...prev, { id: nextBreakId() }]);
  }

  function removeBreak(id: number) {
    setBreaks((prev) => prev.filter((b) => b.id !== id));
  }

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
          disabled={pending}
          placeholder="Contoh: Turnamen Kemerdekaan"
          className="bg-court-50"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-1.5 block text-ink-700">Tanggal Mulai</Label>
          <DatePicker name="date" defaultValue={defaultDate} disabled={pending} />
        </div>
        <div>
          <Label className="mb-1.5 block text-ink-700">Jam Mulai (Babak 1)</Label>
          <TimePicker name="time" defaultValue="08:00" disabled={pending} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
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
            disabled={pending}
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
            disabled={pending}
            defaultValue={defaultRestDuration}
            className="bg-court-50"
          />
        </div>
        <div>
          <Label htmlFor="courts_count" className="mb-1.5 block text-ink-700">
            Jumlah Lapangan Tersedia
          </Label>
          <Input
            id="courts_count"
            name="courts_count"
            type="number"
            min={1}
            required
            disabled={pending}
            defaultValue={defaultCourtsCount}
            className="bg-court-50"
          />
        </div>
      </div>

      {/* Break Times Section */}
      <div className="rounded-xl border border-court-100 bg-court-50/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <Label className="text-ink-700 font-medium">Waktu Istirahat Khusus</Label>
          <Button type="button" variant="outline" size="sm" onClick={addBreak} className="gap-1">
            <Plus className="w-4 h-4" />
            Tambah
          </Button>
        </div>
        <p className="text-xs text-ink-500 mb-3">
          Tambahkan rentang waktu istirahat khusus seperti waktu sholat, makan siang, dll.
          Pertandingan tidak akan dijadwalkan pada rentang waktu ini.
        </p>

        {breaks.length === 0 && (
          <p className="text-xs text-ink-400 italic">Belum ada waktu istirahat khusus.</p>
        )}

        <div className="space-y-3">
          {breaks.map((b, i) => (
            <div key={b.id} className="flex items-end gap-2">
              <div className="flex-1 grid grid-cols-10 gap-2">
                <div className="col-span-4">
                  <Label className="mb-1 block text-xs text-ink-600">Label</Label>
                  <Input
                    name={`break_label_${i}`}
                    placeholder="cth: Maghrib"
                    defaultValue=""
                    disabled={pending}
                    className="bg-white text-xs h-9"
                  />
                </div>
                <div className="col-span-3">
                  <Label className="mb-1 block text-xs text-ink-600">Mulai</Label>
                  <input
                    type="time"
                    name={`break_start_${i}`}
                    defaultValue="12:00"
                    autoComplete="off"
                    disabled={pending}
                    className="flex h-9 w-full rounded-lg border border-court-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-court-400 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="col-span-3">
                  <Label className="mb-1 block text-xs text-ink-600">Selesai</Label>
                  <input
                    type="time"
                    name={`break_end_${i}`}
                    defaultValue="13:00"
                    autoComplete="off"
                    disabled={pending}
                    className="flex h-9 w-full rounded-lg border border-court-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-court-400 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-ink-400 hover:text-red-500 shrink-0 mb-0"
                onClick={() => removeBreak(b.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <input type="hidden" name="break_count" value={breaks.length} autoComplete="off" />

      <p className="rounded-xl border border-court-100 bg-court-50 px-4 py-3 text-xs text-ink-500">
        Jam setiap babak berikutnya akan dihitung otomatis berdasarkan jumlah lapangan: pertandingan
        dibagi menjadi beberapa gelombang jika jumlah pertandingan melebihi lapangan tersedia.
        Waktu istirahat khusus di atas juga akan dihindari dalam penjadwalan.
      </p>

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? "Menyimpan..." : "Buat Bracket"}
      </Button>
    </form>
  );
}
