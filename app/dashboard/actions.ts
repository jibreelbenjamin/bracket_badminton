"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";

export async function deleteBracketAction(bracketId: string) {
  await requireAuth();
  const supabase = getSupabaseServer();
  const { error } = await supabase.from("brackets").delete().eq("id", bracketId);
  if (error) throw new Error(error.message);
  await logActivity("delete_bracket", `Menghapus bracket ${bracketId}`);
  revalidatePath("/dashboard");
}
