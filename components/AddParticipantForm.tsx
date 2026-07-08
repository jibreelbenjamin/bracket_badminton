"use client";

import { useActionState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { addParticipantAction } from "@/app/brackets/[id]/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AddParticipantForm({ bracketId }: { bracketId: string }) {
  const boundAction = addParticipantAction.bind(null, bracketId);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      formRef.current?.reset();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap gap-2 items-start">
      <Input
        name="name"
        type="text"
        placeholder="Nama pasangan peserta"
        required
        className="flex-1 min-w-[140px] bg-court-50"
      />
      <Input
        name="club_name"
        type="text"
        placeholder="Nama PB"
        className="flex-1 min-w-[120px] bg-court-50"
      />
      <Button type="submit" disabled={pending} variant="secondary">
        {pending ? "..." : "+ Tambah"}
      </Button>
    </form>
  );
}
