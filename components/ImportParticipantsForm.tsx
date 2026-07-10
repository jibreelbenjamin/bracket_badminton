"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Download } from "lucide-react";
import { importParticipantsAction } from "@/app/brackets/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function ImportParticipantsForm({ bracketId }: { bracketId: string }) {
  const [open, setOpen] = useState(false);
  const boundAction = importParticipantsAction.bind(null, bracketId);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      formRef.current?.reset();
      setOpen(false);
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state]);

  async function handleDownloadTemplate() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet([
      { Nama: "Contoh Pasangan A", "Nama PB": "PB Contoh" },
      { Nama: "Contoh Pasangan B", "Nama PB": "PB Lainnya" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pasangan Peserta");
    XLSX.writeFile(wb, "template_pasangan_peserta.xlsx");
  }

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-court-100 bg-white p-5 shadow-sm">
      <div>
        <h2 className="mb-1 font-semibold text-ink-900">Import Pasangan Peserta</h2>
        <p className="mb-4 text-sm text-ink-500">
          Tambahkan banyak pasangan peserta sekaligus dari file Excel (.xlsx) dengan kolom{" "}
          <b>Nama</b> dan <b>Nama PB</b>.
        </p>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="mb-4 flex w-fit items-center gap-1.5 text-xs text-court-700 underline underline-offset-2 hover:text-court-800"
        >
          <Download className="h-3.5 w-3.5" />
          Unduh Template Excel
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <FileUp className="h-4 w-4" />
            Import dari Excel
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Pasangan Peserta</DialogTitle>
            <DialogDescription>
              File harus memiliki baris header dengan kolom <b>Nama</b> dan <b>Nama PB</b>.
            </DialogDescription>
          </DialogHeader>

          <form ref={formRef} action={formAction} className="space-y-4">
            <Input type="file" name="file" accept=".xlsx,.xls" required disabled={pending} className="bg-court-50" />

            <DialogFooter>
              <Button type="submit" disabled={pending} className="w-full sm:w-auto">
                {pending ? "Mengunggah..." : "Import Pasangan Peserta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
