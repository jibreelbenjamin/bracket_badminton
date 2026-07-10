"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";

/**
 * Generate (atau regenerate) share token untuk sebuah bracket.
 * Memanggil ini akan selalu mengembalikan token yang valid — jika bracket
 * belum punya token, dibuatkan baru; jika sudah punya, yang lama dipakai.
 */
export async function generateShareTokenAction(bracketId: string): Promise<{ shareUrl?: string; error?: string }> {
  await requireAuth();
  const supabase = getSupabaseServer();

  // Cek apakah bracket sudah punya share_token
  const { data: existing } = await supabase
    .from("brackets")
    .select("id, share_token, name")
    .eq("id", bracketId)
    .single();

  if (!existing) return { error: "Bracket tidak ditemukan." };

  let token = existing.share_token as string | null;

  if (!token) {
    // Generate token baru (UUID v4)
    const newToken = crypto.randomUUID();
    const { error: updateError } = await supabase
      .from("brackets")
      .update({ share_token: newToken })
      .eq("id", bracketId);

    if (updateError) return { error: updateError.message };
    token = newToken;
  }

  await logActivity("share_bracket", `Generate share link untuk bracket "${existing.name}"`);

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const shareUrl = `${origin}/share/${token}`;

  return { shareUrl };
}

/**
 * Regenerate share token (ganti token lama dengan yang baru).
 * Berguna jika user ingin membatalkan akses link lama.
 */
export async function regenerateShareTokenAction(bracketId: string): Promise<{ shareUrl?: string; error?: string }> {
  await requireAuth();
  const supabase = getSupabaseServer();

  const newToken = crypto.randomUUID();
  const { error } = await supabase
    .from("brackets")
    .update({ share_token: newToken })
    .eq("id", bracketId);

  if (error) return { error: error.message };

  await logActivity("regenerate_share_link", `Regenerasi share link untuk bracket ${bracketId}`);

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const shareUrl = `${origin}/share/${newToken}`;

  return { shareUrl };
}

/**
 * Revoke share token (hapus, jadi link tidak bisa diakses lagi).
 */
export async function revokeShareTokenAction(bracketId: string): Promise<{ success?: string; error?: string }> {
  await requireAuth();
  const supabase = getSupabaseServer();

  const { error } = await supabase
    .from("brackets")
    .update({ share_token: null })
    .eq("id", bracketId);

  if (error) return { error: error.message };

  await logActivity("revoke_share_link", `Revoke share link untuk bracket ${bracketId}`);
  revalidatePath(`/brackets/${bracketId}`);

  return { success: "Link share telah dinonaktifkan." };
}
