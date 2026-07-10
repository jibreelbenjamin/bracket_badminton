"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { updateBracketScheduleAction } from "@/app/brackets/[id]/actions";
import type { Bracket, BreakTime, ScheduleDay, RoundAssignment, MatchRow } from "@/lib/types";
import { roundLabel } from "@/lib/bracket-logic";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type BreakEntry = { id: number };
type DayEntry = { id: number };

let breakIdCounter = 0;
function nextBreakId() {
  return ++breakIdCounter;
}

let dayIdCounter = 0;
function nextDayId() {
  return ++dayIdCounter;
}

function formatDateStr(isoDateStr: string): string {
  // isoDateStr could be YYYY-MM-DD or full ISO. Extract YYYY-MM-DD.
  return isoDateStr.slice(0, 10);
}

function formatDisplayDate(isoDateStr: string): string {
  const [y, m, d] = isoDateStr.split("-").map(Number);
  if (!y || !m || !d) return isoDateStr;
  return format(new Date(y, m - 1, d), "d MMM", { locale: localeId });
}

export default function ScheduleEditor({
  bracket,
  breakTimes,
  scheduleDays,
  roundAssignments,
  matches,
}: {
  bracket: Bracket;
  breakTimes: BreakTime[];
  scheduleDays: ScheduleDay[];
  roundAssignments: RoundAssignment[];
  matches: MatchRow[];
}) {
  const today = new Date();
  const defaultDate = today.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

  const [open, setOpen] = useState(false);
  const boundAction = updateBracketScheduleAction.bind(null, bracket.id);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const { setBracketLoading } = useBracketLoading();

  const [breaks, setBreaks] = useState<BreakEntry[]>(() =>
    breakTimes.map((_, i) => ({ id: nextBreakId() }))
  );

  const [days, setDays] = useState<DayEntry[]>(() =>
    scheduleDays.length > 0
      ? scheduleDays.map(() => ({ id: nextDayId() }))
      : [{ id: nextDayId() }]
  );

  // Round assignment state: round_number → day_index
  const [roundAssignMap, setRoundAssignMap] = useState<Map<number, number>>(() => {
    const map = new Map<number, number>();
    for (const ra of roundAssignments) {
      const dayIdx = scheduleDays.findIndex((sd) => sd.id === ra.schedule_day_id);
      if (dayIdx >= 0) {
        map.set(ra.round_number, dayIdx);
      }
    }
    return map;
  });

  // Track current date/start/end times for each day (for display in round assignment dropdown)
  const [dayInfo, setDayInfo] = useState<{ date: string; start: string; end: string }[]>(() =>
    scheduleDays.length > 0
      ? scheduleDays.map((sd) => ({ date: formatDateStr(sd.date), start: sd.start_time_str, end: sd.end_time_str }))
      : [{ date: defaultDate, start: "08:00", end: "21:00" }]
  );

  // Sync local state with props when dialog opens, so old values are preserved
  // and not replaced by automatic defaults.
  useEffect(() => {
    if (open) {
      setBreaks(breakTimes.map((_, i) => ({ id: nextBreakId() })));
      setDays(
        scheduleDays.length > 0
          ? scheduleDays.map(() => ({ id: nextDayId() }))
          : [{ id: nextDayId() }]
      );
      setDayInfo(
        scheduleDays.length > 0
          ? scheduleDays.map((sd) => ({ date: formatDateStr(sd.date), start: sd.start_time_str, end: sd.end_time_str }))
          : [{ date: defaultDate, start: "08:00", end: "21:00" }]
      );
      const map = new Map<number, number>();
      for (const ra of roundAssignments) {
        const dayIdx = scheduleDays.findIndex((sd) => sd.id === ra.schedule_day_id);
        if (dayIdx >= 0) {
          map.set(ra.round_number, dayIdx);
        }
      }
      setRoundAssignMap(map);
    }
  }, [open, breakTimes, scheduleDays, roundAssignments]);

  // Compute unique rounds from matches
  const rounds = Array.from(new Set(matches.map((m) => m.round_number))).sort((a, b) => a - b);
  const totalRounds = rounds.length > 0 ? Math.max(...rounds) : 0;

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

  useEffect(() => {
    setBracketLoading(pending);
  }, [pending, setBracketLoading]);

  function addBreak() {
    setBreaks((prev) => [...prev, { id: nextBreakId() }]);
  }

  function removeBreak(id: number) {
    setBreaks((prev) => prev.filter((b) => b.id !== id));
  }

  function addDay() {
    setDays((prev) => [...prev, { id: nextDayId() }]);
    setDayInfo((prev) => [...prev, { date: defaultDate, start: "08:00", end: "21:00" }]);
  }

  function removeDay(id: number) {
    if (days.length <= 1) return;
    const idx = days.findIndex((d) => d.id === id);
    setDays((prev) => prev.filter((d) => d.id !== id));
    setDayInfo((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateDayDate(index: number, value: string) {
    setDayInfo((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], date: value };
      return next;
    });
  }

  function updateDayStart(index: number, value: string) {
    setDayInfo((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], start: value };
      return next;
    });
  }

  function updateDayEnd(index: number, value: string) {
    setDayInfo((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], end: value };
      return next;
    });
  }

  function handleRoundAssignment(roundNumber: number, dayIndex: number) {
    const newMap = new Map(roundAssignMap);
    newMap.set(roundNumber, dayIndex);
    setRoundAssignMap(newMap);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          id="schedule-dialog-trigger"
          className="text-xs text-ink-500 underline underline-offset-2 hover:text-court-700"
        >
          Ubah jadwal
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[85vh] !flex !flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
          <DialogTitle>Ubah Jadwal Turnamen</DialogTitle>
          <DialogDescription>
            Atur hari pelaksanaan, jam, durasi, dan penugasan babak ke setiap hari.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="contents">
          <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1 min-h-0">
          {/* Multi-Day Schedule */}
          <div className="rounded-lg border border-court-100 bg-court-50/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-ink-700 font-medium">Hari Pelaksanaan</Label>
              <Button type="button" variant="outline" size="sm" onClick={addDay} className="gap-1 text-xs h-7">
                <Plus className="w-3 h-3" />
                Tambah Hari
              </Button>
            </div>
            <p className="text-[10px] text-ink-400 mb-2">
              Atur tanggal, jam mulai, dan jam selesai untuk setiap hari turnamen.
            </p>

            <div className="space-y-2">
              {days.map((d, i) => {
                const existingDay = scheduleDays[i] ?? null;
                return (
                  <div key={d.id} className="flex items-start gap-1.5 p-2 bg-white rounded-md border border-court-100">
                    <div className="flex-1 flex flex-col gap-1.5">
                      <div>
                        <Label className="mb-0.5 block text-[10px] text-ink-500">
                          Tanggal {days.length > 1 ? `(Hari ${i + 1})` : ""}
                        </Label>
                        <DatePicker
                          name={`day_date_${i}`}
                          defaultValue={existingDay ? formatDateStr(existingDay.date) : defaultDate}
                          disabled={pending}
                          onChange={(val) => updateDayDate(i, val)}
                        />
                      </div>
                      <div>
                        <Label className="mb-0.5 block text-[10px] text-ink-500">Mulai</Label>
                        <TimePicker
                          name={`day_start_${i}`}
                          defaultValue={existingDay?.start_time_str ?? "08:00"}
                          disabled={pending}
                          onChange={(val) => updateDayStart(i, val)}
                        />
                      </div>
                      <div>
                        <Label className="mb-0.5 block text-[10px] text-ink-500">Selesai</Label>
                        <TimePicker
                          name={`day_end_${i}`}
                          defaultValue={existingDay?.end_time_str ?? "21:00"}
                          disabled={pending}
                          onChange={(val) => updateDayEnd(i, val)}
                        />
                      </div>
                    </div>
                    {days.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-ink-400 hover:text-red-500 shrink-0 mt-5"
                        onClick={() => removeDay(d.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <input type="hidden" name="day_count" value={days.length} autoComplete="off" />

          {/* Round-to-Day Assignment */}
          {rounds.length > 0 && days.length > 1 && (
            <div
              id="round-assignment-section"
              className="rounded-lg border border-court-100 bg-court-50/50 p-3"
            >
              <Label className="text-xs text-ink-700 font-medium block mb-2">
                Penugasan Babak ke Hari
              </Label>
              <p className="text-[10px] text-ink-400 mb-2">
                Pilih hari pelaksanaan untuk setiap babak. Babak yang tidak ditugaskan akan
                didistribusikan otomatis.
              </p>
              <div className="space-y-1.5">
                {rounds.map((roundNum) => {
                  const currentDayIndex = roundAssignMap.get(roundNum);
                  return (
                    <div key={roundNum} className="flex items-center gap-2">
                      <span className="text-xs text-ink-700 w-24 shrink-0 font-medium">
                        {roundLabel(roundNum, totalRounds)}
                      </span>
                      <Select
                        value={currentDayIndex !== undefined ? String(currentDayIndex) : "auto"}
                        onValueChange={(val) => {
                          if (val !== "auto") {
                            handleRoundAssignment(roundNum, Number(val));
                          } else {
                            const newMap = new Map(roundAssignMap);
                            newMap.delete(roundNum);
                            setRoundAssignMap(newMap);
                          }
                        }}
                        disabled={pending}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Otomatis" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Otomatis</SelectItem>
                          {days.map((_, idx) => {
                            const di = dayInfo[idx] ?? { date: defaultDate, start: "08:00", end: "21:00" };
                            const dateLabel = formatDisplayDate(di.date);
                            return (
                              <SelectItem key={idx} value={String(idx)}>
                                Hari ke-{idx + 1}, {dateLabel} {di.start}–{di.end}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Durasi, Istirahat, Lapangan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="match_duration_minutes" className="mb-1 block text-xs text-ink-700">
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
                Durasi Istirahat (menit)
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
            <div>
              <Label htmlFor="courts_count" className="mb-1 block text-xs text-ink-700">
                Jumlah Lapangan
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
                    <div className="flex-1 flex flex-col gap-1.5">
                      <div>
                        <Label className="mb-0.5 block text-[10px] text-ink-500">Label</Label>
                        <Input
                          name={`break_label_${i}`}
                          placeholder="cth: Dzuhur"
                          defaultValue={existing?.label ?? ""}
                          disabled={pending}
                          className="bg-white text-xs h-8"
                        />
                      </div>
                      <div>
                        <Label className="mb-0.5 block text-[10px] text-ink-500">Mulai</Label>
                        <TimePicker
                          name={`break_start_${i}`}
                          defaultValue={existing?.start_time_str ?? "12:00"}
                          disabled={pending}
                        />
                      </div>
                      <div>
                        <Label className="mb-0.5 block text-[10px] text-ink-500">Selesai</Label>
                        <TimePicker
                          name={`break_end_${i}`}
                          defaultValue={existing?.end_time_str ?? "13:00"}
                          disabled={pending}
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

          {/* Round assignment hidden fields */}
          <input type="hidden" name="round_assign_count" value={roundAssignMap.size} autoComplete="off" />
          {Array.from(roundAssignMap.entries()).map(([roundNum, dayIdx], idx) => (
            <div key={`ra-${roundNum}`}>
              <input type="hidden" name={`ra_round_${idx}`} value={roundNum} autoComplete="off" />
              <input type="hidden" name={`ra_day_index_${idx}`} value={dayIdx} autoComplete="off" />
            </div>
          ))}

          </div>

          <DialogFooter className="px-6 py-4 border-t border-court-100 bg-white shrink-0 rounded-b-lg">
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan Jadwal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
