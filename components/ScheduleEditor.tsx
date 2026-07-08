"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { updateBracketScheduleAction } from "@/app/brackets/[id]/actions";
import type { Bracket } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/DatePicker";
import { TimePicker } from "@/components/TimePicker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function ScheduleEditor({ bracket }: { bracket: Bracket }) {
  const [open, setOpen] = useState(false);
  const boundAction = updateBracketScheduleAction.bind(null, bracket.id);
  const [state, formAction, pending] = useActionState(boundAction, undefined);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  const start = new Date(bracket.start_time);
  const defaultDate = start.toISOString().slice(0, 10);
  const defaultTime = start.toTimeString().slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-xs text-ink-500 underline underline-offset-2 hover:text-court-700">
          Ubah jadwal
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah Jadwal Turnamen</DialogTitle>
          <DialogDescription>
            Perubahan jadwal baru akan terlihat di bagan setelah Anda menekan tombol acak ulang.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs text-ink-700">Tanggal Mulai</Label>
              <DatePicker name="date" defaultValue={defaultDate} />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-ink-700">Jam Mulai</Label>
              <TimePicker name="time" defaultValue={defaultTime} />
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
                className="bg-court-50"
              />
            </div>
          </div>

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
