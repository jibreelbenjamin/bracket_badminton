import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { AppSettings } from "@/lib/types";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
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
      <h1 className="text-2xl font-display font-bold text-court-900 mt-3 mb-6">Pengaturan</h1>

      <div className="bg-white shadow-sm rounded-2xl border border-court-100 p-6">
        {settings ? (
          <SettingsForm settings={settings} />
        ) : (
          <p className="text-sm text-red-600">
            Data pengaturan tidak ditemukan. Pastikan skema database (supabase/schema.sql) sudah
            dijalankan.
          </p>
        )}
      </div>
    </main>
  );
}
