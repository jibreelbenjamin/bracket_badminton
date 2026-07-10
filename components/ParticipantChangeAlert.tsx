"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { generateBracketAction } from "@/app/brackets/[id]/actions";
import { Button } from "@/components/ui/button";
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

type Props = {
  bracketId: string;
  newCount: number; // peserta baru (belum ada di bagan)
  removedCount: number; // peserta dihapus (ada di bagan tapi sudah tidak di daftar)
};

export default function ParticipantChangeAlert({ bracketId, newCount, removedCount }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (newCount === 0 && removedCount === 0) return null;

  const messages: string[] = [];
  if (newCount > 0) {
    messages.push(
      `${newCount} pasangan peserta baru terdeteksi sejak bagan terakhir dibuat.`
    );
  }
  if (removedCount > 0) {
    messages.push(
      `${removedCount} pasangan peserta telah dihapus dari daftar sejak bagan terakhir dibuat.`
    );
  }

  function runGenerate() {
    startTransition(async () => {
      const result = await generateBracketAction(bracketId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success("Bagan berhasil diacak ulang.");
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800">
          Perubahan Peserta Terdeteksi
        </p>
        <p className="mt-0.5 text-sm text-amber-700">
          {messages.join(" ")} Bagan perlu diacak ulang agar peserta terbaru masuk ke dalam bagan pertandingan.
        </p>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              disabled={isPending}
              size="sm"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {isPending ? "Mengacak..." : "Acak Ulang Bagan"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Acak ulang bagan?</AlertDialogTitle>
              <AlertDialogDescription>
                Mengacak ulang akan menghapus seluruh hasil pertandingan yang sudah tercatat di
                bracket ini. Tindakan ini tidak bisa dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={runGenerate} disabled={isPending}>
                {isPending ? "Mengacak..." : "Ya, Acak Ulang"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
