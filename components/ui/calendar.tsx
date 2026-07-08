"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: cn("flex flex-col sm:flex-row gap-2", defaultClassNames.months),
        month: cn("flex flex-col gap-3", defaultClassNames.month),
        month_caption: cn(
          "flex justify-center pt-1 relative items-center w-full",
          defaultClassNames.month_caption
        ),
        caption_label: cn("text-sm font-semibold text-ink-900", defaultClassNames.caption_label),
        nav: cn("flex items-center gap-1 absolute inset-x-0 top-0 justify-between", defaultClassNames.nav),
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent m-3 p-0 z-1 text-ink-500 opacity-80 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent m-3 p-0 z-1 text-ink-500 opacity-80 hover:opacity-100"
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-ink-500 rounded-md w-8 font-normal text-[0.75rem]",
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-1.5", defaultClassNames.week),
        day: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
          defaultClassNames.day
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 font-normal aria-selected:opacity-100 rounded-lg"
        ),
        range_start: "day-range-start",
        range_end: "day-range-end",
        selected: cn(
          "[&>button]:bg-court-700 [&>button]:text-white [&>button]:hover:bg-court-700 [&>button]:hover:text-white [&>button]:focus:bg-court-700 [&>button]:focus:text-white",
          defaultClassNames.selected
        ),
        today: cn("[&>button]:bg-court-100 [&>button]:text-court-900", defaultClassNames.today),
        outside: cn("text-ink-300 opacity-60", defaultClassNames.outside),
        disabled: cn("text-ink-300 opacity-40", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) => {
          if (orientation === "left") return <ChevronLeft className="h-4 w-4" {...rest} />;
          return <ChevronRight className="h-4 w-4" {...rest} />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
