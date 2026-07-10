import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Bracket, BreakTime, MatchRow, Participant, ScheduleDay, RoundAssignment } from "@/lib/types";
import ImportParticipantsForm from "@/components/ImportParticipantsForm";
import ParticipantsTable from "@/components/ParticipantsTable";
import GenerateBracketButton from "@/components/GenerateBracketButton";
import BracketBoard from "@/components/BracketBoard";
import ScheduleEditor from "@/components/ScheduleEditor";
import BracketNameEditor from "@/components/BracketNameEditor";
import ParticipantChangeAlert from "@/components/ParticipantChangeAlert";
import ScheduleReminderAlert from "@/components/ScheduleReminderAlert";
import { BracketLoadingProvider } from "@/components/BracketLoadingProvider";
import BracketLoadingOverlay from "@/components/BracketLoadingOverlay";

export const dynamic = "force-dynamic";

/** Deteksi perubahan peserta vs isi bagan */
function detectParticipantChanges(
  participants: Participant[],
  matches: MatchRow[]
): { newCount: number; removedCount: number } {
  if (matches.length === 0) return { newCount: 0, removedCount: 0 };

  const currentIds = new Set(participants.map((p) => p.id));
  const matchIds = new Set<string>();
  for (const m of matches) {
    if (m.participant1_id) matchIds.add(m.participant1_id);
    if (m.participant2_id) matchIds.add(m.participant2_id);
    if (m.winner_id) matchIds.add(m.winner_id);
  }

  let newCount = 0;
  let removedCount = 0;

  for (const id of currentIds) {
    if (!matchIds.has(id)) newCount++;
  }
  for (const id of matchIds) {
    if (!currentIds.has(id)) removedCount++;
  }

  return { newCount, removedCount };
}

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

  const [{ data: participants }, { data: matches }, { data: breakTimes }, { data: scheduleDays }, { data: roundAssignments }] = await Promise.all([
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
    supabase
      .from("schedule_days")
      .select("*")
      .eq("bracket_id", id)
      .order("day_index")
      .returns<ScheduleDay[]>(),
    supabase
      .from("round_schedule_assignments")
      .select("*")
      .eq("bracket_id", id)
      .returns<RoundAssignment[]>(),
  ]);

  const participantList = participants ?? [];
  const matchList = matches ?? [];
  const breakTimeList = breakTimes ?? [];
  const scheduleDayList = scheduleDays ?? [];
  const roundAssignmentList = roundAssignments ?? [];

  const participantChanges = detectParticipantChanges(participantList, matchList);

  // Cek apakah ada babak yang belum ditugaskan ke hari tertentu
  const assignedRounds = new Set(roundAssignmentList.map((ra) => ra.round_number));
  const matchRounds = new Set(matchList.map((m) => m.round_number));
  const hasUnassignedRounds = [...matchRounds].some((r) => !assignedRounds.has(r));

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <BracketLoadingProvider>
        <BracketLoadingOverlay />
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
              {scheduleDayList.length > 1 ? (
                <>
                  {scheduleDayList.length} hari pelaksanaan &middot;{" "}
                </>
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
            {/* Schedule days summary */}
            {scheduleDayList.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {scheduleDayList.map((sd, i) => (
                  <span
                    key={sd.id}
                    className="inline-flex items-center gap-1 rounded-full bg-court-50 border border-court-200 px-2 py-0.5 text-xs text-court-700"
                  >
                    Hari {i + 1}: {new Date(sd.date + "T00:00:00").toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      timeZone: "Asia/Jakarta",
                    })} ({sd.start_time_str}–{sd.end_time_str})
                  </span>
                ))}
              </div>
            )}
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
              <ScheduleEditor
                bracket={bracket}
                breakTimes={breakTimeList}
                scheduleDays={scheduleDayList}
                roundAssignments={roundAssignmentList}
                matches={matchList}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GenerateBracketButton
              bracketId={bracket.id}
              hasMatches={matchList.length > 0}
              participantCount={participantList.length}
            />
          </div>
        </div>

        {matchList.length > 0 && (participantChanges.newCount > 0 || participantChanges.removedCount > 0) && (
          <div className="mb-6">
            <ParticipantChangeAlert
              bracketId={bracket.id}
              newCount={participantChanges.newCount}
              removedCount={participantChanges.removedCount}
            />
          </div>
        )}

        {matchList.length > 0 && scheduleDayList.length > 1 && (
          <div className="mb-6">
            <ScheduleReminderAlert
              bracketId={bracket.id}
              scheduleDayCount={scheduleDayList.length}
              hasMatches={matchList.length > 0}
              hasUnassignedRounds={hasUnassignedRounds}
            />
          </div>
        )}

        <section className="grid md:grid-cols-2 gap-6 mb-10">
          <ImportParticipantsForm bracketId={bracket.id} />
          <ParticipantsTable bracketId={bracket.id} participants={participantList} />
        </section>

        {matchList.length > 0 ? (
          <BracketBoard
            bracket={bracket}
            matches={matchList}
            participants={participantList}
            scheduleDays={scheduleDayList}
            roundAssignments={roundAssignmentList}
          />
        ) : (
          <div className="text-center py-16 border-2 border-dashed border-court-200 rounded-2xl">
            <p className="text-ink-500 text-sm">
              Bagan belum dibuat. Tambahkan minimal 2 pasangan peserta lalu tekan &ldquo;Acak &amp;
              Buat Bagan&rdquo; di atas.
            </p>
          </div>
        )}
      </BracketLoadingProvider>
    </main>
  );
}
