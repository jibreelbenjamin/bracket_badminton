"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteBracketAction } from "@/app/dashboard/actions";
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

export default function DeleteBracketButton({
  bracketId,
  bracketName,
  onDeletingChange,
}: {
  bracketId: string;
  bracketName: string;
  onDeletingChange?: (deleting: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    onDeletingChange?.(true);
    startTransition(async () => {
      try {
        await deleteBracketAction(bracketId);
        toast.success(`Bracket "${bracketName}" berhasil dihapus.`);
        router.refresh();
      } catch (err) {
        onDeletingChange?.(false);
        toast.error(err instanceof Error ? err.message : "Gagal menghapus bracket.");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          disabled={isPending}
          className="text-xs text-ink-300 transition-colors hover:text-red-600 disabled:opacity-50"
          title="Hapus bracket"
        >
          {isPending ? "Menghapus..." : "Hapus"}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus bracket ini?</AlertDialogTitle>
          <AlertDialogDescription>
            Bracket &ldquo;{bracketName}&rdquo; beserta seluruh pasangan peserta dan data
            pertandingan akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.
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
