"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Link2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateShareTokenAction,
  regenerateShareTokenAction,
  revokeShareTokenAction,
} from "@/app/brackets/[id]/share-actions";
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
  currentShareToken: string | null;
};

export default function ShareBracketButton({ bracketId, currentShareToken }: Props) {
  const [isPending, startTransition] = useTransition();
  const [origin, setOrigin] = useState<string>("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();

  // Dapatkan origin hanya di client-side
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Set shareUrl saat origin atau token berubah
  useEffect(() => {
    if (origin && currentShareToken) {
      setShareUrl(`${origin}/share/${currentShareToken}`);
    }
  }, [origin, currentShareToken]);

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateShareTokenAction(bracketId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.shareUrl) {
        setShareUrl(result.shareUrl);
        router.refresh();
      }
    });
  }

  function handleRegenerate() {
    startTransition(async () => {
      const result = await regenerateShareTokenAction(bracketId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.shareUrl) {
        setShareUrl(result.shareUrl);
        toast.success("Link share baru berhasil dibuat.");
        router.refresh();
      }
    });
  }

  function handleRevoke() {
    startTransition(async () => {
      const result = await revokeShareTokenAction(bracketId);
      if (result.error) {
        toast.error(result.error);
      } else {
        setShareUrl(null);
        setDialogOpen(false);
        toast.success("Link share telah dinonaktifkan.");
        router.refresh();
      }
    });
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link disalin ke clipboard!");
    } catch {
      toast.error("Gagal menyalin link.");
    }
  }

  return (
    <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          <Link2 className="h-4 w-4" />
          Bagikan
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Bagikan Bracket</AlertDialogTitle>
          <AlertDialogDescription>
            Siapapun yang memiliki link ini dapat melihat bracket tanpa perlu memasukkan PIN aplikasi.
            Mereka hanya bisa melihat, tidak bisa mengubah apapun.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {shareUrl ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-court-200 bg-court-50 p-3">
              <code className="flex-1 text-xs text-ink-700 break-all select-all">{shareUrl}</code>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8"
                onClick={handleCopy}
                title="Salin link"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={isPending}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Buat Link Baru
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevoke}
                disabled={isPending}
                className="gap-1.5 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
              >
                <X className="h-3.5 w-3.5" />
                Nonaktifkan
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-500">
              Bracket ini belum memiliki link share. Klik tombol di bawah untuk membuatnya.
            </p>
            <Button
              onClick={handleGenerate}
              disabled={isPending}
              className="w-full gap-1.5"
            >
              <Link2 className="h-4 w-4" />
              {isPending ? "Membuat..." : "Buat Link Share"}
            </Button>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Tutup</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
