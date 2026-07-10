"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateBracketNameAction } from "@/app/brackets/[id]/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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

export default function BracketNameEditor({
  bracketId,
  currentName,
}: {
  bracketId: string;
  currentName: string;
}) {
  const [open, setOpen] = useState(false);
  const boundAction = updateBracketNameAction.bind(null, bracketId);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const { setBracketLoading } = useBracketLoading();

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="inline-flex items-center gap-1 text-ink-300 transition-colors hover:text-court-700"
          title="Ubah nama turnamen"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah Nama Turnamen</DialogTitle>
          <DialogDescription>Nama ini akan tampil di daftar bracket dan bagan.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
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
              defaultValue={currentName}
              className="bg-court-50"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan Nama"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
