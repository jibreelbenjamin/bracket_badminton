"use client";

import { useState, useCallback, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Palette, Save, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import type { BracketStyle } from "@/lib/types";
import {
  listStylesAction,
  saveStyleAction,
  deleteStyleAction,
  type StoredStyle,
} from "@/app/brackets/[id]/style-actions";

type Props = {
  style: BracketStyle;
  onApply: (style: BracketStyle) => void;
};

type Preset = {
  matchboxBg: string;
  matchboxBorder: string;
  lineColor: string;
  fontColorPrimary: string;
  fontColorSecondary: string;
  fontColorAccent: string;
  bgColor: string;
  courtTextColor: string;
  roundTitleColor: string;
  roundTimeColor: string;
  label: string;
};

const COLOR_PRESETS: Preset[] = [
  // Hijau (default)
  { matchboxBg: "#f2f9f7", matchboxBorder: "#dbeee9", lineColor: "#bfe0d8", fontColorPrimary: "#16221f", fontColorSecondary: "#5b6b67", fontColorAccent: "#185f52", bgColor: "#ffffff", courtTextColor: "#9c6708", roundTitleColor: "#185f52", roundTimeColor: "#185f52", label: "Hijau" },
  // Biru
  { matchboxBg: "#eff6ff", matchboxBorder: "#dbeafe", lineColor: "#bfdbfe", fontColorPrimary: "#172554", fontColorSecondary: "#4b5563", fontColorAccent: "#1d4ed8", bgColor: "#ffffff", courtTextColor: "#9c6708", roundTitleColor: "#1d4ed8", roundTimeColor: "#1d4ed8", label: "Biru" },
  // Ungu
  { matchboxBg: "#faf5ff", matchboxBorder: "#e9d5ff", lineColor: "#d8b4fe", fontColorPrimary: "#2e1065", fontColorSecondary: "#6b5563", fontColorAccent: "#7c3aed", bgColor: "#ffffff", courtTextColor: "#9c6708", roundTitleColor: "#7c3aed", roundTimeColor: "#7c3aed", label: "Ungu" },
  // Orange
  { matchboxBg: "#fff7ed", matchboxBorder: "#ffedd5", lineColor: "#fed7aa", fontColorPrimary: "#431407", fontColorSecondary: "#6b5b4f", fontColorAccent: "#ea580c", bgColor: "#ffffff", courtTextColor: "#9c6708", roundTitleColor: "#ea580c", roundTimeColor: "#ea580c", label: "Orange" },
  // Kuning
  { matchboxBg: "#fefce8", matchboxBorder: "#fef08a", lineColor: "#fde047", fontColorPrimary: "#422006", fontColorSecondary: "#713f12", fontColorAccent: "#a16207", bgColor: "#ffffff", courtTextColor: "#9c6708", roundTitleColor: "#a16207", roundTimeColor: "#a16207", label: "Kuning" },
  // Abu-abu
  { matchboxBg: "#f9fafb", matchboxBorder: "#e5e7eb", lineColor: "#d1d5db", fontColorPrimary: "#111827", fontColorSecondary: "#6b7280", fontColorAccent: "#374151", bgColor: "#ffffff", courtTextColor: "#9c6708", roundTitleColor: "#374151", roundTimeColor: "#374151", label: "Abu-abu" },
];

export default function BracketStyleDialog({ style, onApply }: Props) {
  const [local, setLocal] = useState<BracketStyle>({ ...style });
  const [open, setOpen] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<StoredStyle[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [isPending, startTransition] = useTransition();

  // Load custom templates from database
  const loadTemplates = useCallback(() => {
    startTransition(async () => {
      const result = await listStylesAction();
      if (!result.error) {
        setCustomTemplates(result.data);
      }
    });
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setOpen(open);
      if (open) {
        setLocal({ ...style });
        loadTemplates();
      }
    },
    [style, loadTemplates]
  );

  // Load on mount so data is ready when dialog opens
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const update = (key: keyof BracketStyle, value: string) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: Preset | StoredStyle) => {
    setLocal((prev) => ({
      ...prev,
      matchboxBg: preset.matchboxBg,
      matchboxBorder: preset.matchboxBorder,
      lineColor: preset.lineColor,
      fontColorPrimary: preset.fontColorPrimary,
      fontColorSecondary: preset.fontColorSecondary,
      fontColorAccent: preset.fontColorAccent,
      bgColor: preset.bgColor,
      courtTextColor: preset.courtTextColor,
      roundTitleColor: preset.roundTitleColor,
      roundTimeColor: preset.roundTimeColor,
    }));
  };

  const handleSaveTemplate = () => {
    const name = templateName.trim();
    if (!name || isPending) return;
    startTransition(async () => {
      const result = await saveStyleAction(name, local);
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        setCustomTemplates((prev) => [result.data!, ...prev]);
        setTemplateName("");
        toast.success(`Template "${name}" berhasil disimpan.`);
      }
    });
  };

  const handleDeleteTemplate = (id: string) => {
    if (isPending) return;
    startTransition(async () => {
      const result = await deleteStyleAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
        toast.success("Template berhasil dihapus.");
      }
    });
  };

  const handleReset = () => {
    setLocal({
      title: local.title, // Pertahankan title
      matchboxBg: "#f2f9f7",
      matchboxBorder: "#dbeee9",
      lineColor: "#bfe0d8",
      fontColorPrimary: "#16221f",
      fontColorSecondary: "#5b6b67",
      fontColorAccent: "#185f52",
      bgColor: "#ffffff",
      courtTextColor: "#9c6708",
      roundTitleColor: "#185f52",
      roundTimeColor: "#185f52",
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          <Palette className="h-4 w-4" />
          Kustomisasi
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] gap-0! grid-rows-[auto_1fr_auto] p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Kustomisasi Tampilan Bracket</DialogTitle>
          <DialogDescription>
            Sesuaikan warna dan judul bracket sebelum mengekspor ke gambar.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-2 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="bracket-title">Judul Bracket</Label>
            <Input
              id="bracket-title"
              placeholder="Misal: Kejuaraan Bulutangkis 2026"
              value={local.title}
              onChange={(e) => update("title", e.target.value)}
            />
          </div>

          {/* Preset warna */}
          <div className="space-y-2">
            <Label>Warna Preset</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="flex items-center gap-2 rounded-xl border border-court-200 px-3 py-2 text-xs font-medium text-ink-700 transition-colors hover:bg-court-50 active:scale-95"
                >
                  <span
                    className="inline-block h-5 w-5 rounded-full border border-court-200"
                    style={{
                      background: `linear-gradient(135deg, ${preset.matchboxBg} 50%, ${preset.lineColor} 50%)`,
                    }}
                  />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* --- Template Kustom --- */}
          {customTemplates.length > 0 && (
            <div className="space-y-2">
              <Label>Template Tersimpan</Label>
              {isPending && (
                <div className="flex items-center gap-2 text-xs text-ink-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Memuat...
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {customTemplates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="group flex items-center gap-1.5 rounded-xl border border-court-200 pr-1.5 pl-3 py-1.5 text-xs font-medium text-ink-700 bg-white transition-colors hover:bg-court-50"
                  >
                    <button
                      type="button"
                      onClick={() => applyPreset(tmpl)}
                      className="flex items-center gap-1.5"
                    >
                      <span
                        className="inline-block h-5 w-5 rounded-full border border-court-200 shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${tmpl.matchboxBg} 50%, ${tmpl.lineColor} 50%)`,
                        }}
                      />
                      <span>{tmpl.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(tmpl.id)}
                      disabled={isPending}
                      className="ml-0.5 rounded-md p-1 text-ink-300 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all disabled:opacity-30"
                      title="Hapus template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- Simpan Template Baru --- */}
          <div className="space-y-2">
            <Label>Simpan Sebagai Template</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nama template kustom"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTemplate();
                }}
                className="flex-1 h-9 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || isPending}
                className="gap-1 shrink-0"
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Simpan
              </Button>
            </div>
          </div>

          {/* --- Latar Belakang --- */}
          <div>
            <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">
              Latar Belakang
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ColorField
                label="Background Bracket"
                value={local.bgColor}
                onChange={(v) => update("bgColor", v)}
              />
            </div>
          </div>

          {/* --- Kotak & Garis --- */}
          <div>
            <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">
              Kotak &amp; Garis
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ColorField
                label="Background Kotak"
                value={local.matchboxBg}
                onChange={(v) => update("matchboxBg", v)}
              />
              <ColorField
                label="Border Kotak"
                value={local.matchboxBorder}
                onChange={(v) => update("matchboxBorder", v)}
              />
              <ColorField
                label="Warna Garis"
                value={local.lineColor}
                onChange={(v) => update("lineColor", v)}
              />
            </div>
          </div>

          {/* --- Teks --- */}
          <div>
            <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">
              Teks
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ColorField
                label="Nama Pemain"
                value={local.fontColorPrimary}
                onChange={(v) => update("fontColorPrimary", v)}
              />
              <ColorField
                label="Klub / Info Sekunder"
                value={local.fontColorSecondary}
                onChange={(v) => update("fontColorSecondary", v)}
              />
              <ColorField
                label="Teks Lapangan"
                value={local.courtTextColor}
                onChange={(v) => update("courtTextColor", v)}
              />
              <ColorField
                label="Judul Babak"
                value={local.roundTitleColor}
                onChange={(v) => update("roundTitleColor", v)}
              />
              <ColorField
                label="Waktu Babak"
                value={local.roundTimeColor}
                onChange={(v) => update("roundTimeColor", v)}
              />
              <ColorField
                label="Aksen (Pemenang dll)"
                value={local.fontColorAccent}
                onChange={(v) => update("fontColorAccent", v)}
              />
            </div>
          </div>

          {/* Preview — persis seperti MatchBox asli */}
          <div>
            <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-2">Pratinjau</h3>
            <div
              className="rounded-xl p-4 flex flex-col items-center gap-4"
              style={{ background: local.bgColor, border: "1.5px solid", borderColor: local.matchboxBorder }}
            >
              {/* Contoh Round Header */}
              <div className="text-center">
                <p className="font-display font-bold uppercase text-[13px] tracking-wider" style={{ color: local.roundTitleColor }}>
                  Semifinal
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: local.fontColorSecondary, opacity: 0.75 }}>
                  2 pertandingan
                </p>
              </div>

              {/* MatchBox tiruan */}
              <div
                style={{
                  width: 220,
                  height: 84,
                  background: local.matchboxBg,
                  border: "1.5px solid",
                  borderColor: local.matchboxBorder,
                  borderRadius: 10,
                  overflow: "hidden",
                  flex: "none",
                }}
              >
                {/* match-time */}
                <div
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 11,
                    color: local.roundTimeColor,
                    background: local.matchboxBorder,
                    padding: "3px 10px",
                    textAlign: "center",
                    letterSpacing: "0.02em",
                    height: 18,
                    lineHeight: "12px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  <span style={{ fontWeight: 800 }}>#1</span>
                  <span className="font-bold" style={{ color: local.courtTextColor }}> L1</span>
                  <span style={{ margin: "0 2px" }}>·</span>
                  12 Jul, 08:00-08:30
                </div>

                {/* player-row 1 */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    height: 33,
                    padding: "0 12px",
                    borderTop: "1px solid",
                    borderTopColor: local.matchboxBorder,
                    borderLeft: "none",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: local.fontColorPrimary,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Pemain A
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      marginTop: -4,
                      color: local.fontColorSecondary,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Klub A
                  </span>
                </div>

                {/* player-row 2 (winner) */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    height: 33,
                    padding: "0 12px",
                    borderTop: "1px solid",
                    borderTopColor: local.matchboxBorder,
                    borderLeft: "none",
                    textAlign: "left",
                    background: "#fdecc4",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: local.fontColorAccent,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Pemain B 🏆
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      marginTop: -4,
                      color: local.fontColorSecondary,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Klub B
                  </span>
                </div>
              </div>

              {/* Connector line */}
              <div
                style={{
                  width: 40,
                  height: 2,
                  background: local.lineColor,
                  borderRadius: 1,
                  marginTop: -8,
                }}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between px-6 pb-6 pt-2 shrink-0">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              Reset Warna
            </Button>
          </div>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Batal
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button
                size="sm"
                className="bg-court-900 hover:bg-ink-900"
                onClick={() => onApply(local)}
              >
                Terapkan
              </Button>
            </DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-ink-500">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded-md border border-court-200 bg-white p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 font-mono text-xs"
          placeholder="#hex"
        />
      </div>
    </div>
  );
}
