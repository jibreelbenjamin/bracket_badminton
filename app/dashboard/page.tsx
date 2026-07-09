import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Bracket } from "@/lib/types";
import LogoutButton from "@/components/LogoutButton";
import BracketList from "@/components/BracketList";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireAuth();
  const supabase = getSupabaseServer();
  const { data: brackets } = await supabase
    .from("brackets")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Bracket[]>();

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-court-900">Daftar Bracket</h1>
          <p className="text-sm text-ink-500 mt-1">Kelola seluruh bagan turnamen badminton Anda.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/settings" className="text-sm text-ink-500 hover:text-court-700 transition-colors">
            Pengaturan
          </Link>
          <LogoutButton />
        </div>
      </div>

      <Link
        href="/brackets/new"
        className="inline-flex items-center gap-2 mb-8 bg-court-700 hover:bg-court-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
      >
        <span className="text-lg leading-none">+</span> Buat Bracket Baru
      </Link>

      <BracketList brackets={brackets ?? []} />
    </main>
  );
}
