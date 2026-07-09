import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Bracket, BreakTime, MatchRow, Participant } from "@/lib/types";
import ImportParticipantsForm from "@/components/ImportParticipantsForm";
import ParticipantsTable from "@/components/ParticipantsTable";
import GenerateBracketButton from "@/components/GenerateBracketButton";
import BracketBoard from "@/components/BracketBoard";
import ScheduleEditor from "@/components/ScheduleEditor";
import BracketNameEditor from "@/components/BracketNameEditor";

export const dynamic = "force-dynamic";

export default async function BracketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const supabase = getSupabaseServer();

  const { data: bracket } = await supabase
    .from("brackets")
    .select("*")
    .eq("id", id)
    .single<Bracket>();

  if (!bracket) notFound();

  const [{ data: participants }, { data: matches }, { data: breakTimes }] = await Promise.all([
    supabase.from("participants").select("*").eq("bracket_id", id).order("name").returns<Participant[]>(),
    supabase
      .from("matches")
      .select("*")
      .eq("bracket_id", id)
      .order("round_number")
      .order("match_index")
      .returns<MatchRow[]>(),
    supabase
      .from("break_times")
      .select("*")
      .eq("bracket_id", id)
      .order("created_at")
      .returns<BreakTime[]>(),
  ]);

  const participantList = participants ?? [];
  const matchList = matches ?? [];
  const breakTimeList = breakTimes ?? [];

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <Link href="/dashboard" className="text-sm text-ink-500 hover:text-court-700 transition-colors">
        &larr; Kembali ke daftar bracket
      </Link>

      <div className="flex flex-wrap justify-between items-start gap-4 mt-3 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-bold text-court-900">{bracket.name}</h1>
            <BracketNameEditor bracketId={bracket.id} currentName={bracket.name} />
          </div>
          <p className="text-sm text-ink-500 mt-1">
            Mulai{" "}
            {new Date(bracket.start_time).toLocaleString("id-ID", {
              dateStyle: "full",
              timeStyle: "short",
            })}{" "}
            &middot; {bracket.match_duration_minutes} menit/babak &middot; istirahat{" "}
            {bracket.rest_duration_minutes} menit &middot; {bracket.courts_count ?? 1} lapangan
          </p>
          {breakTimeList.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {breakTimeList.map((bt) => (
                <span
                  key={bt.id}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700"
                >
                  {bt.label || `${bt.start_time_str}–${bt.end_time_str}`}
                  {bt.label && ` (${bt.start_time_str}–${bt.end_time_str})`}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1">
            <ScheduleEditor bracket={bracket} breakTimes={breakTimeList} />
          </div>
        </div>
        <GenerateBracketButton
          bracketId={bracket.id}
          hasMatches={matchList.length > 0}
          participantCount={participantList.length}
        />
      </div>

      <section className="grid md:grid-cols-2 gap-6 mb-10">
        <ImportParticipantsForm bracketId={bracket.id} />
        <ParticipantsTable bracketId={bracket.id} participants={participantList} />
      </section>

      {matchList.length > 0 ? (
        <BracketBoard bracket={bracket} matches={matchList} participants={participantList} />
      ) : (
        <div className="text-center py-16 border-2 border-dashed border-court-200 rounded-2xl">
          <p className="text-ink-500 text-sm">
            Bagan belum dibuat. Tambahkan minimal 2 pasangan peserta lalu tekan &ldquo;Acak &amp;
            Buat Bagan&rdquo; di atas.
          </p>
        </div>
      )}
    </main>
  );
}
