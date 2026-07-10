"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generateBracketAction } from "@/app/brackets/[id]/actions";
import { Button } from "@/components/ui/button";
import { useBracketLoading } from "@/components/BracketLoadingProvider";
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

export default function GenerateBracketButton({
  bracketId,
  hasMatches,
  participantCount,
}: {
  bracketId: string;
  hasMatches: boolean;
  participantCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { setBracketLoading } = useBracketLoading();

  function runGenerate() {
    setBracketLoading(true);
    startTransition(async () => {
      try {
        const result = await generateBracketAction(bracketId);
        if (result.error) {
          toast.error(result.error);
        } else if (result.warning) {
          toast.warning(result.warning);
        } else {
          toast.success(hasMatches ? "Bagan berhasil diacak ulang." : "Bagan berhasil dibuat.");
        }
        router.refresh();
      } finally {
        setBracketLoading(false);
      }
    });
  }

  const label = isPending ? "Mengacak..." : hasMatches ? "Acak Ulang Bagan" : "Acak & Buat Bagan";
  const disabled = isPending || participantCount < 2;

  return (
    <div>
      {hasMatches ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={disabled} size="lg" className="bg-cork-500 hover:bg-cork-600">
              {label}
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
      ) : (
        <Button
          onClick={runGenerate}
          disabled={disabled}
          size="lg"
          className="bg-cork-500 hover:bg-cork-600"
        >
          {label}
        </Button>
      )}
      {participantCount < 2 && (
        <p className="text-xs text-ink-500 mt-2">Minimal 2 pasangan peserta diperlukan.</p>
      )}
    </div>
  );
}
