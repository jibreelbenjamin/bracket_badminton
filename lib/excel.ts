import "server-only";
import * as XLSX from "xlsx";

export type ParsedParticipant = { name: string; club_name: string };

const NAME_KEYS = ["nama", "name", "nama peserta", "nama pemain"];
const CLUB_KEYS = ["nama pb", "pb", "klub", "club", "nama klub", "nama pb/klub"];

function findKey(row: Record<string, unknown>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const found = keys.find((k) => k.trim().toLowerCase() === candidate);
    if (found) return found;
  }
  return null;
}

/**
 * Parsing file Excel peserta. Kolom yang dicari (tidak case-sensitive):
 * - Nama  (atau: Name, Nama Peserta, Nama Pemain)
 * - Nama PB (atau: PB, Klub, Club, Nama Klub)
 *
 * Baris tanpa nama akan diabaikan.
 */
export function parseParticipantsExcel(buffer: ArrayBuffer): ParsedParticipant[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const result: ParsedParticipant[] = [];
  for (const row of rows) {
    const nameKey = findKey(row, NAME_KEYS);
    const clubKey = findKey(row, CLUB_KEYS);

    const name = nameKey ? String(row[nameKey]).trim() : "";
    const club = clubKey ? String(row[clubKey]).trim() : "";

    if (name) result.push({ name, club_name: club });
  }

  return result;
}
