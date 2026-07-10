"use client";

import * as React from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Date picker terintegrasi dengan <form action={...}> biasa: nilai tanggal
 * yang dipilih dikirim lewat hidden input bernama `name`, format yyyy-MM-dd
 * (sama seperti <input type="date"> native).
 */
export function DatePicker({
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
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState<Date | undefined>(
    defaultValue ? parseIsoDate(defaultValue) : undefined
  );

  const isoValue = date ? formatIsoDate(date) : "";

  return (
    <Popover open={disabled ? false : open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={isoValue} autoComplete="off" />
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start bg-court-50 text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          {date ? format(date, "d MMMM yyyy", { locale: localeId }) : "Pilih tanggal"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(value) => {
            setDate(value);
            setOpen(false);
          }}
          defaultMonth={date}
          locale={localeId}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function parseIsoDate(value: string): Date | undefined {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
