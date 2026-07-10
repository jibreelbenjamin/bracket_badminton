import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { AppSettings } from "@/lib/types";
import CreateBracketForm from "@/components/CreateBracketForm";

export const dynamic = "force-dynamic";

export default async function NewBracketPage() {
  await requireAuth();
  const supabase = getSupabaseServer();
  const { data: settings } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single<AppSettings>();

  return (
    <main className="max-w-xl mx-auto px-6 py-10">
      <Link href="/dashboard" className="text-sm text-ink-500 hover:text-court-700 transition-colors">
        &larr; Kembali ke daftar bracket
      </Link>
      <h1 className="text-2xl font-display font-bold text-court-900 mt-3 mb-6">Buat Bracket Baru</h1>

      <div className="bg-white shadow-sm rounded-2xl border border-court-100 p-6">
        <CreateBracketForm
          defaultMatchDuration={settings?.default_match_duration_minutes ?? 20}
          defaultRestDuration={settings?.default_rest_duration_minutes ?? 15}
          defaultCourtsCount={settings?.default_courts_count ?? 1}
        />
      </div>
    </main>
  );
}
