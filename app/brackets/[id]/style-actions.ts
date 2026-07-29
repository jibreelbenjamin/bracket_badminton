"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { BracketStyle } from "@/lib/types";

type DbStyle = {
  id: string;
  name: string;
  matchbox_bg: string;
  matchbox_border: string;
  line_color: string;
  font_color_primary: string;
  font_color_secondary: string;
  font_color_accent: string;
  bg_color: string;
  court_text_color: string;
  round_title_color: string;
  round_time_color: string;
  created_at: string;
};

function toDb(style: BracketStyle, name: string) {
  return {
    name,
    matchbox_bg: style.matchboxBg,
    matchbox_border: style.matchboxBorder,
    line_color: style.lineColor,
    font_color_primary: style.fontColorPrimary,
    font_color_secondary: style.fontColorSecondary,
    font_color_accent: style.fontColorAccent,
    bg_color: style.bgColor,
    court_text_color: style.courtTextColor,
    round_title_color: style.roundTitleColor,
    round_time_color: style.roundTimeColor,
  };
}

function fromDb(row: DbStyle) {
  return {
    id: row.id,
    name: row.name,
    matchboxBg: row.matchbox_bg,
    matchboxBorder: row.matchbox_border,
    lineColor: row.line_color,
    fontColorPrimary: row.font_color_primary,
    fontColorSecondary: row.font_color_secondary,
    fontColorAccent: row.font_color_accent,
    bgColor: row.bg_color,
    courtTextColor: row.court_text_color,
    roundTitleColor: row.round_title_color,
    roundTimeColor: row.round_time_color,
  };
}

export type StoredStyle = ReturnType<typeof fromDb>;

export async function listStylesAction(): Promise<{ data: StoredStyle[]; error?: string }> {
  try {
    await requireAuth();
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("bracket_styles")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<DbStyle[]>();

    if (error) return { data: [], error: error.message };
    return { data: (data ?? []).map(fromDb) };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : "Gagal memuat template." };
  }
}

export async function saveStyleAction(
  name: string,
  style: BracketStyle
): Promise<{ data?: StoredStyle; error?: string }> {
  try {
    await requireAuth();
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("bracket_styles")
      .insert(toDb(style, name))
      .select()
      .single();

    if (error) return { error: error.message };
    revalidatePath("/brackets/[id]");
    return { data: fromDb(data) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menyimpan template." };
  }
}

export async function deleteStyleAction(id: string): Promise<{ error?: string }> {
  try {
    await requireAuth();
    const supabase = getSupabaseServer();
    const { error } = await supabase.from("bracket_styles").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/brackets/[id]");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menghapus template." };
  }
}
