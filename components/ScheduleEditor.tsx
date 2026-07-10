"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { updateBracketScheduleAction } from "@/app/brackets/[id]/actions";
import type { Bracket, BreakTime } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/DatePicker";
import { TimePicker } from "@/components/TimePicker";
import { useBracketLoading } from "@/components/BracketLoadingProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type BreakEntry = { id: number };

let breakIdCounter = 0;
function nextBreakId() {
  return ++breakIdCounter;
}

export default function ScheduleEditor({
  bracket,
  breakTimes,
}: {
  bracket: Bracket;
  breakTimes: BreakTime[];
}) {
  const [open, setOpen] = useState(false);
  const boundAction = updateBracketScheduleAction.bind(null, bracket.id);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const { setBracketLoading } = useBracketLoading();

  const [breaks, setBreaks] = useState<BreakEntry[]>(() =>
    breakTimes.map((_, i) => ({ id: nextBreakId() }))
  );

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
      setBracketLoading(false);
    } else if (state?.error) {
      toast.error(state.error);
      setBracketLoading(false);
    }
  }, [state, setBracketLoading]);

  // Sync pending state to bracket loading
  useEffect(() => {
    setBracketLoading(pending);
  }, [pending, setBracketLoading]);

  const start = new Date(bracket.start_time);
  const defaultDate = start.toISOString().slice(0, 10);
  const defaultTime = start.toTimeString().slice(0, 5);

  function addBreak() {
    setBreaks((prev) => [...prev, { id: nextBreakId() }]);
  }

  function removeBreak(id: number) {
    setBreaks((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-xs text-ink-500 underline underline-offset-2 hover:text-court-700">
          Ubah jadwal
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ubah Jadwal Turnamen</DialogTitle>
          <DialogDescription>
            Perubahan jadwal akan otomatis memperbarui waktu semua pertandingan di bagan.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="mb-1 block text-xs text-ink-700">Tanggal Mulai</Label>
              <DatePicker name="date" defaultValue={defaultDate} disabled={pending} />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-ink-700">Jam Mulai</Label>
              <TimePicker name="time" defaultValue={defaultTime} disabled={pending} />
            </div>
            <div>
              <Label htmlFor="courts_count" className="mb-1 block text-xs text-ink-700">
                Lapangan
              </Label>
              <Input
                id="courts_count"
                type="number"
                name="courts_count"
                min={1}
                defaultValue={bracket.courts_count ?? 1}
                required
                disabled={pending}
                className="bg-court-50"
              />
            </div>
            <div>
              <Label
                htmlFor="match_duration_minutes"
                className="mb-1 block text-xs text-ink-700"
              >
                Durasi/Babak (menit)
              </Label>
              <Input
                id="match_duration_minutes"
                type="number"
                name="match_duration_minutes"
                min={1}
                defaultValue={bracket.match_duration_minutes}
                required
                disabled={pending}
                className="bg-court-50"
              />
            </div>
            <div>
              <Label htmlFor="rest_duration_minutes" className="mb-1 block text-xs text-ink-700">
                Istirahat (menit)
              </Label>
              <Input
                id="rest_duration_minutes"
                type="number"
                name="rest_duration_minutes"
                min={0}
                defaultValue={bracket.rest_duration_minutes}
                required
                disabled={pending}
                className="bg-court-50"
              />
            </div>
          </div>

          {/* Break Times Section */}
          <div className="rounded-lg border border-court-100 bg-court-50/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-ink-700 font-medium">Waktu Istirahat Khusus</Label>
              <Button type="button" variant="outline" size="sm" onClick={addBreak} className="gap-1 text-xs h-7">
                <Plus className="w-3 h-3" />
                Tambah
              </Button>
            </div>

            {breaks.length === 0 && (
              <p className="text-xs text-ink-400 italic">Tidak ada waktu istirahat khusus.</p>
            )}

            <div className="space-y-2">
              {breaks.map((b, i) => {
                const existing = breakTimes[i] ?? null;
                return (
                  <div key={b.id} className="flex items-end gap-1.5">
                    <div className="flex-1 grid grid-cols-10 gap-1.5">
                      <div className="col-span-4">
                        <Label className="mb-0.5 block text-[10px] text-ink-500">Label</Label>
                        <Input
                          name={`break_label_${i}`}
                          placeholder="cth: Dzuhur"
                          defaultValue={existing?.label ?? ""}
                          disabled={pending}
                          className="bg-white text-xs h-8"
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="mb-0.5 block text-[10px] text-ink-500">Mulai</Label>
                        <input
                          type="time"
                          name={`break_start_${i}`}
                          defaultValue={existing?.start_time_str ?? "12:00"}
                          autoComplete="off"
                          disabled={pending}
                          className="flex h-8 w-full rounded-md border border-court-200 bg-white px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-court-400 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="mb-0.5 block text-[10px] text-ink-500">Selesai</Label>
                        <input
                          type="time"
                          name={`break_end_${i}`}
                          defaultValue={existing?.end_time_str ?? "13:00"}
                          autoComplete="off"
                          disabled={pending}
                          className="flex h-8 w-full rounded-md border border-court-200 bg-white px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-court-400 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-ink-400 hover:text-red-500 shrink-0"
                      onClick={() => removeBreak(b.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <input type="hidden" name="break_count" value={breaks.length} autoComplete="off" />

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan Jadwal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
