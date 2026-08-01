import { NextResponse } from "next/server";
import { getSessionCookieValue, isSessionValid } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import type { Bracket, MatchRow, Participant } from "@/lib/types";

export const dynamic = "force-dynamic";

export const revalidate = 0;

/**
 * Endpoint realtime — mengembalikan data terbaru bagan (matches + peserta)
 * untuk sebuah bracket. Dipanggil oleh komponen client (BracketLiveView)
 * secara berkala supaya bagan ter-update otomatis tanpa refresh halaman.
 *
 * Akses hanya dibuka lewat salah satu dari dua jalur aman (keduanya tidak
 * memakai anon key; data selalu dibaca lewat server memakai service role):
 *   1. Sesi PIN yang valid (halaman utama bracket).
 *   2. share_token yang valid (halaman public share, readonly).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Bracket ID tidak valid." }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // Ambil bracket dulu untuk validasi akses
  const { data: bracket, error: bracketError } = await supabase
    .from("brackets")
    .select("*")
    .eq("id", id)
    .single<Bracket>();

  if (bracketError || !bracket) {
    return NextResponse.json({ error: "Bracket tidak ditemukan." }, { status: 404 });
  }

  // Auth: terima sesi PIN yang valid ATAU share_token yang benar (readonly).
  const sessionValue = await getSessionCookieValue();
  const hasSession = isSessionValid(sessionValue);

  const url = new URL(_request.url);
  const shareToken = url.searchParams.get("share_token");

  const isPublic = bracket.share_token != null && shareToken === bracket.share_token;

  if (!hasSession && !isPublic) {
    return NextResponse.json({ error: "Tidak berizin mengakses bagan ini." }, { status: 401 });
  }

  // Ambil data bagan yang paling baru
  const [{ data: participants }, { data: matches }] = await Promise.all([
    supabase
      .from("participants")
      .select("*")
      .eq("bracket_id", id)
      .order("name")
      .returns<Participant[]>(),
    supabase
      .from("matches")
      .select("*")
      .eq("bracket_id", id)
      .order("round_number")
      .order("match_index")
      .returns<MatchRow[]>(),
  ]);

  return NextResponse.json({
    bracket,
    participants: participants ?? [],
    matches: matches ?? [],
    updatedAt: new Date().toISOString(),
  });
}
