"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

/**
 * Time picker terintegrasi dengan <form action={...}> biasa: nilai jam
 * dikirim lewat hidden input bernama `name`, format HH:mm.
 *
 * Responsif: di HP (<640px) dropdown jam & menit stack vertikal;
 * di desktop sejajar dengan pemisah ":".
 */
export function TimePicker({
  name,
  defaultValue,
  disabled,
  className,
}: {
  name: string;
  defaultValue?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [defaultHour, defaultMinute] = (defaultValue ?? "08:00").split(":");
  const [hour, setHour] = React.useState(defaultHour || "08");
  const [minute, setMinute] = React.useState(defaultMinute || "00");

  const value = `${hour}:${minute}`;

  return (
    <div className={className}>
      <input type="hidden" name={name} value={value} autoComplete="off" />
      {/* Mobile: stack vertikal; Desktop: sejajar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
        <Select value={hour} onValueChange={setHour} disabled={disabled}>
          <SelectTrigger className="w-full bg-court-50 h-9 sm:h-10 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((h) => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="hidden sm:inline text-ink-500 text-sm">:</span>
        <Select value={minute} onValueChange={setMinute} disabled={disabled}>
          <SelectTrigger className="w-full bg-court-50 h-9 sm:h-10 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MINUTES.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
