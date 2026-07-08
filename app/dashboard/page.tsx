import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Bracket } from "@/lib/types";
import LogoutButton from "@/components/LogoutButton";
import DeleteBracketButton from "@/components/DeleteBracketButton";

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

      <div className="grid gap-4">
        {(brackets ?? []).map((b) => (
          <div
            key={b.id}
            className="bg-white shadow-sm hover:shadow-md transition-shadow rounded-2xl border border-court-100 relative"
          >
            <Link href={`/brackets/${b.id}`} className="block p-5">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="font-semibold text-ink-900">{b.name}</h2>
                  <p className="text-sm text-ink-500 mt-0.5">
                    Mulai{" "}
                    {new Date(b.start_time).toLocaleString("id-ID", {
                      dateStyle: "full",
                      timeStyle: "short",
                    })}
                  </p>
                  <p className="text-xs text-ink-300 mt-1">
                    Durasi tiap babak {b.match_duration_minutes} menit &middot; Istirahat antar babak{" "}
                    {b.rest_duration_minutes} menit
                  </p>
                </div>
                <span
                  className={`text-xs uppercase font-semibold px-3 py-1 rounded-full whitespace-nowrap ${
                    b.status === "generated"
                      ? "bg-court-100 text-court-700"
                      : "bg-cork-100 text-cork-600"
                  }`}
                >
                  {b.status === "generated" ? "Sudah Diacak" : "Draft"}
                </span>
              </div>
            </Link>
            <div className="absolute bottom-3 right-4">
              <DeleteBracketButton bracketId={b.id} bracketName={b.name} />
            </div>
          </div>
        ))}

        {(!brackets || brackets.length === 0) && (
          <div className="text-center py-16 border-2 border-dashed border-court-200 rounded-2xl">
            <p className="text-ink-500 text-sm">
              Belum ada bracket. Klik &ldquo;Buat Bracket Baru&rdquo; untuk memulai turnamen pertama Anda.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
