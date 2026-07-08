export type AppSettings = {
  id: number;
  pin: string;
  default_match_duration_minutes: number;
  default_rest_duration_minutes: number;
};

export type Bracket = {
  id: string;
  name: string;
  start_time: string; // ISO timestamp
  match_duration_minutes: number;
  rest_duration_minutes: number;
  status: "draft" | "generated";
  created_at: string;
};

export type Participant = {
  id: string;
  bracket_id: string;
  name: string;
  club_name: string;
  created_at: string;
};

export type MatchRow = {
  id: string;
  bracket_id: string;
  round_number: number;
  match_index: number;
  participant1_id: string | null;
  participant2_id: string | null;
  participant1_is_bye: boolean;
  participant2_is_bye: boolean;
  winner_id: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
};

export type MatchInsert = Omit<MatchRow, "id" | "created_at">;

export type ActionState = { error?: string; success?: string } | undefined;
