"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { loginAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DIGIT_COUNT = 4;

export default function PinForm() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  const [digits, setDigits] = useState<string[]>(Array(DIGIT_COUNT).fill(""));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.error) {
      toast.error(state.error);
      setDigits(Array(DIGIT_COUNT).fill(""));
      inputRefs.current[0]?.focus();
    }
  }, [state]);

  function applyDigits(index: number, cleaned: string) {
    if (!cleaned) return;
    const chars = cleaned.split("");
    setDigits((prev) => {
      const next = [...prev];
      let i = index;
      for (const ch of chars) {
        if (i >= DIGIT_COUNT) break;
        next[i] = ch;
        i++;
      }
      return next;
    });

    const lastFilledIndex = Math.min(index + chars.length, DIGIT_COUNT) - 1;
    if (lastFilledIndex >= DIGIT_COUNT - 1) {
      requestAnimationFrame(() => formRef.current?.requestSubmit());
    } else {
      const nextIndex = lastFilledIndex + 1;
      requestAnimationFrame(() => inputRefs.current[nextIndex]?.focus());
    }
  }

  function handleChange(index: number, value: string) {
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }
    applyDigits(index, cleaned);
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, DIGIT_COUNT);
    if (pasted) applyDigits(0, pasted);
  }

  const pin = digits.join("");

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <input type="hidden" name="pin" value={pin} />

      <div className="flex justify-center gap-3">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            aria-label={`Digit PIN ke-${i + 1}`}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            value={digit}
            autoFocus={i === 0}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={cn(
              "h-14 w-14 rounded-xl border border-input bg-court-50 text-center text-2xl font-display font-bold text-court-900 shadow-sm transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            )}
          />
        ))}
      </div>

      <Button type="submit" disabled={pending || pin.length < DIGIT_COUNT} className="w-full" size="lg">
        {pending ? "Memeriksa..." : "Masuk"}
      </Button>
    </form>
  );
}
