import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Bracket, BreakTime, MatchRow, Participant, ScheduleDay, RoundAssignment } from "@/lib/types";
import BracketBoard from "@/components/BracketBoard";

export const dynamic = "force-dynamic";

export default async function SharedBracketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = getSupabaseServer();

  // Cari bracket berdasarkan share_token — TANPA otentikasi PIN
  const { data: bracket, error } = await supabase
    .from("brackets")
    .select("*")
    .eq("share_token", token)
    .single<Bracket>();

  if (error || !bracket) {
    notFound();
  }

  const [{ data: participants }, { data: matches }, { data: breakTimes }, { data: scheduleDays }, { data: roundAssignments }] = await Promise.all([
    supabase.from("participants").select("*").eq("bracket_id", bracket.id).order("name").returns<Participant[]>(),
    supabase
      .from("matches")
      .select("*")
      .eq("bracket_id", bracket.id)
      .order("round_number")
      .order("match_index")
      .returns<MatchRow[]>(),
    supabase
      .from("break_times")
      .select("*")
      .eq("bracket_id", bracket.id)
      .order("created_at")
      .returns<BreakTime[]>(),
    supabase
      .from("schedule_days")
      .select("*")
      .eq("bracket_id", bracket.id)
      .order("day_index")
      .returns<ScheduleDay[]>(),
    supabase
      .from("round_schedule_assignments")
      .select("*")
      .eq("bracket_id", bracket.id)
      .returns<RoundAssignment[]>(),
  ]);

  const participantList = participants ?? [];
  const matchList = matches ?? [];
  const breakTimeList = breakTimes ?? [];
  const scheduleDayList = scheduleDays ?? [];
  const roundAssignmentList = roundAssignments ?? [];

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
  
        <h1 className="text-2xl font-display font-bold text-court-900 mt-1">{bracket.name}</h1>
        <p className="text-sm text-ink-500 mt-1">
          {scheduleDayList.length > 1 ? (
            <>{scheduleDayList.length} hari pelaksanaan &middot; </>
          ) : (
            <>
              Mulai{" "}
              {new Date(bracket.start_time).toLocaleString("id-ID", {
                dateStyle: "full",
                timeStyle: "short",
                timeZone: "Asia/Jakarta",
              })}{" "}
            </>
          )}
          {bracket.match_duration_minutes} menit/babak &middot; istirahat{" "}
          {bracket.rest_duration_minutes} menit &middot; {bracket.courts_count ?? 1} lapangan
        </p>
        {scheduleDayList.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {scheduleDayList.map((sd, i) => (
              <span
                key={sd.id}
                className="inline-flex items-center gap-1 rounded-full bg-court-50 border border-court-200 px-2 py-0.5 text-xs text-court-700"
              >
                Hari {i + 1}: {new Date(sd.date + "T00:00:00").toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  timeZone: "Asia/Jakarta",
                })} ({sd.start_time_str}–{sd.end_time_str})
              </span>
            ))}
          </div>
        )}
        {breakTimeList.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
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
      </div>

      {matchList.length > 0 ? (
        <BracketBoard
          bracket={bracket}
          matches={matchList}
          participants={participantList}
          scheduleDays={scheduleDayList}
          roundAssignments={roundAssignmentList}
          readonly
        />
      ) : (
        <div className="text-center py-16 border-2 border-dashed border-court-200 rounded-2xl">
          <p className="text-ink-500 text-sm">
            Bagan belum dibuat untuk bracket ini.
          </p>
        </div>
      )}

      <div className="mt-10 pt-6 border-t border-court-200 text-center">
        <p className="text-xs text-ink-300">
          Dibagikan melalui{" "}
          <Link href="/" className="underline hover:text-court-700 transition-colors">
            Bracket Badminton
          </Link>
        </p>
      </div>
    </main>
  );
}
