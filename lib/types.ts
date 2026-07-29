export type AppSettings = {
  id: number;
  pin: string;
  default_match_duration_minutes: number;
  default_rest_duration_minutes: number;
  default_courts_count: number;
};

export type Bracket = {
  id: string;
  name: string;
  start_time: string; // ISO timestamp
  match_duration_minutes: number;
  rest_duration_minutes: number;
  courts_count: number;
  third_place_gap_minutes: number;
  status: "draft" | "generated";
  share_token: string | null;
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
  is_third_place: boolean;
  created_at: string;
};

export type MatchInsert = Omit<MatchRow, "id" | "created_at">;

export type BreakTime = {
  id: string;
  bracket_id: string;
  label: string;
  start_time_str: string; // HH:mm
  end_time_str: string;   // HH:mm
  created_at: string;
};

export type BreakTimeInsert = {
  label: string;
  start_time_str: string;
  end_time_str: string;
};

export type ScheduleDay = {
  id: string;
  bracket_id: string;
  date: string; // YYYY-MM-DD
  start_time_str: string; // HH:mm
  end_time_str: string;   // HH:mm
  day_index: number;
  created_at: string;
};

export type ScheduleDayInsert = {
  date: string;
  start_time_str: string;
  end_time_str: string;
  day_index: number;
};

export type RoundAssignment = {
  id: string;
  bracket_id: string;
  round_number: number;
  schedule_day_id: string;
  created_at: string;
};

export type BracketStyle = {
  title: string;
  matchboxBg: string;
  matchboxBorder: string;
  lineColor: string;
  fontColorPrimary: string;
  fontColorSecondary: string;
  fontColorAccent: string;
  bgColor: string;
  courtTextColor: string;
  roundTitleColor: string;
  roundTimeColor: string;
};

export const DEFAULT_BRACKET_STYLE: BracketStyle = {
  title: "",
  matchboxBg: "#f2f9f7",
  matchboxBorder: "#dbeee9",
  lineColor: "#bfe0d8",
  fontColorPrimary: "#16221f",
  fontColorSecondary: "#5b6b67",
  fontColorAccent: "#185f52",
  bgColor: "#ffffff",
  courtTextColor: "#9c6708",
  roundTitleColor: "#185f52",
  roundTimeColor: "#185f52",
};

export type ActionState = { error?: string; success?: string } | undefined;
