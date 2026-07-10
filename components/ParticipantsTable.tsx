"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { deleteParticipantAction, deleteAllParticipantsAction, updateParticipantAction } from "@/app/brackets/[id]/actions";
import type { Participant } from "@/lib/types";
import AddParticipantForm from "./AddParticipantForm";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ParticipantsTable({
  bracketId,
  participants,
}: {
  bracketId: string;
  participants: Participant[];
}) {
  const clubCounts = new Map<string, number>();
  for (const p of participants) {
    const key = p.club_name || "(tanpa PB)";
    clubCounts.set(key, (clubCounts.get(key) ?? 0) + 1);
  }

  return (
    <div className="bg-white shadow-sm rounded-2xl border border-court-100 p-5">
      <div className="flex justify-between items-baseline mb-4">
        <h2 className="font-semibold text-ink-900">Daftar Pasangan Peserta</h2>
        <span className="text-sm text-ink-500">{participants.length} pasangan</span>
      </div>

      <div className="mb-4">
        <AddParticipantForm bracketId={bracketId} />
      </div>

      {participants.length > 0 && (
        <div className="text-xs text-ink-500 mb-3 flex flex-wrap gap-x-3 gap-y-1">
          {Array.from(clubCounts.entries()).map(([club, count]) => (
            <span key={club} className="bg-court-50 border border-court-100 rounded-full px-2.5 py-0.5">
              {club}: {count}
            </span>
          ))}
        </div>
      )}

      {participants.length > 0 && (
        <div className="mb-3 flex justify-end">
          <DeleteAllParticipantsButton bracketId={bracketId} participantCount={participants.length} />
        </div>
      )}

      <div className="max-h-80 overflow-y-auto divide-y divide-court-100">
        {participants.map((p) => (
          <div key={p.id} className="flex justify-between items-center py-2 text-sm">
            <div>
              <span className="font-medium text-ink-900">{p.name}</span>
              {p.club_name && <span className="text-ink-500 ml-2">{p.club_name}</span>}
            </div>
            <div className="flex items-center gap-3">
              <EditParticipantButton bracketId={bracketId} participant={p} />
              <DeleteParticipantButton bracketId={bracketId} participant={p} />
            </div>
          </div>
        ))}

        {participants.length === 0 && (
          <p className="text-sm text-ink-500 py-4 text-center">
            Belum ada pasangan peserta. Import dari Excel atau tambah manual di atas.
          </p>
        )}
      </div>
    </div>
  );
}

function EditParticipantButton({
  bracketId,
  participant,
}: {
  bracketId: string;
  participant: Participant;
}) {
  const [open, setOpen] = useState(false);
  const boundAction = updateParticipantAction.bind(null, bracketId, participant.id);
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
          className="inline-flex items-center gap-1 text-xs text-ink-300 transition-colors hover:text-court-700"
          title="Ubah pasangan peserta"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah Pasangan Peserta</DialogTitle>
          <DialogDescription>Perubahan langsung berlaku di bagan yang sudah ada.</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor={`edit-name-${participant.id}`} className="mb-1.5 block text-ink-700">
              Nama Pasangan Peserta
            </Label>
            <Input
              id={`edit-name-${participant.id}`}
              name="name"
              type="text"
              required
              disabled={pending}
              defaultValue={participant.name}
              className="bg-court-50"
            />
          </div>
          <div>
            <Label htmlFor={`edit-club-${participant.id}`} className="mb-1.5 block text-ink-700">
              Nama PB
            </Label>
            <Input
              id={`edit-club-${participant.id}`}
              name="club_name"
              type="text"
              disabled={pending}
              defaultValue={participant.club_name ?? ""}
              className="bg-court-50"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteParticipantButton({
  bracketId,
  participant,
}: {
  bracketId: string;
  participant: Participant;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteParticipantAction(bracketId, participant.id);
        toast.success(`"${participant.name}" dihapus dari daftar pasangan peserta.`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menghapus pasangan peserta.");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          disabled={isPending}
          className="text-xs text-ink-300 hover:text-red-600 transition-colors disabled:opacity-50"
        >
          Hapus
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus pasangan peserta ini?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{participant.name}&rdquo; akan dihapus dari bracket ini. Jika bagan sudah
            dibuat sebelumnya, acak ulang bagan agar perubahan ikut terlihat.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isPending}>
            {isPending ? "Menghapus..." : "Ya, Hapus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteAllParticipantsButton({
  bracketId,
  participantCount,
}: {
  bracketId: string;
  participantCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { setBracketLoading } = useBracketLoading();

  function handleDeleteAll() {
    startTransition(async () => {
      try {
        setBracketLoading(true);
        await deleteAllParticipantsAction(bracketId);
        toast.success(`Semua pasangan peserta (${participantCount}) berhasil dihapus.`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menghapus semua pasangan peserta.");
      } finally {
        setBracketLoading(false);
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          disabled={isPending}
          className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 font-medium"
          title="Hapus semua pasangan peserta"
        >
          {isPending ? "Menghapus..." : "Hapus Semua"}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus semua pasangan peserta?</AlertDialogTitle>
          <AlertDialogDescription>
            Semua {participantCount} pasangan peserta dan seluruh data pertandingan akan ikut
            terhapus. Tindakan ini tidak bisa dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteAll} disabled={isPending}>
            {isPending ? "Menghapus..." : "Ya, Hapus Semua"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
