-- =========================================================
-- Skema database untuk aplikasi Bracket Badminton
-- Jalankan seluruh file ini di Supabase Dashboard -> SQL Editor
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- app_settings: satu baris konfigurasi aplikasi (PIN, default durasi)
-- ---------------------------------------------------------
create table if not exists app_settings (
  id int primary key default 1,
  pin text not null default '8888',
  default_match_duration_minutes int not null default 20,
  default_rest_duration_minutes int not null default 15,
  default_courts_count int not null default 1,
  updated_at timestamptz not null default now(),
  constraint app_settings_single_row check (id = 1)
);

insert into app_settings (id, pin)
values (1, '8888')
on conflict (id) do nothing;

-- ---------------------------------------------------------
-- brackets: satu turnamen/bagan
-- ---------------------------------------------------------
create table if not exists brackets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time timestamptz not null,
  match_duration_minutes int not null default 20,
  rest_duration_minutes int not null default 15,
  courts_count int not null default 1,
  status text not null default 'draft', -- draft | generated
  share_token uuid unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create index if not exists brackets_share_token_idx on brackets(share_token);

-- ---------------------------------------------------------
-- participants: peserta dalam sebuah bracket
-- ---------------------------------------------------------
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references brackets(id) on delete cascade,
  name text not null,
  club_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists participants_bracket_id_idx on participants(bracket_id);

-- ---------------------------------------------------------
-- matches: setiap kotak pertandingan di bagan
-- ---------------------------------------------------------
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references brackets(id) on delete cascade,
  round_number int not null,
  match_index int not null,
  participant1_id uuid references participants(id) on delete set null,
  participant2_id uuid references participants(id) on delete set null,
  participant1_is_bye boolean not null default false,
  participant2_is_bye boolean not null default false,
  winner_id uuid references participants(id) on delete set null,
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz not null default now(),
  unique (bracket_id, round_number, match_index)
);

create index if not exists matches_bracket_id_idx on matches(bracket_id);

-- ---------------------------------------------------------
-- break_times: rentang waktu istirahat khusus per bracket
-- (misal: waktu sholat). Disimpan dalam format HH:mm (waktu
-- dalam sehari) dan berlaku berulang setiap hari selama
-- turnamen berlangsung.
-- ---------------------------------------------------------
create table if not exists break_times (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references brackets(id) on delete cascade,
  label text not null default '',
  start_time_str text not null, -- format HH:mm
  end_time_str text not null,   -- format HH:mm
  created_at timestamptz not null default now()
);

create index if not exists break_times_bracket_id_idx on break_times(bracket_id);

-- ---------------------------------------------------------
-- schedule_days: hari pelaksanaan turnamen (bisa 1 atau lebih)
-- Setiap hari punya tanggal, jam mulai, dan jam selesai.
-- ---------------------------------------------------------
create table if not exists schedule_days (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references brackets(id) on delete cascade,
  date date not null,
  start_time_str text not null, -- format HH:mm
  end_time_str text not null,   -- format HH:mm
  day_index int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists schedule_days_bracket_id_idx on schedule_days(bracket_id);

-- ---------------------------------------------------------
-- round_schedule_assignments: menetapkan babak ke hari tertentu
-- Setiap babak (round_number) ditugaskan ke satu schedule_day.
-- ---------------------------------------------------------
create table if not exists round_schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references brackets(id) on delete cascade,
  round_number int not null,
  schedule_day_id uuid references schedule_days(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (bracket_id, round_number)
);

create index if not exists round_schedule_assignments_bracket_id_idx on round_schedule_assignments(bracket_id);

-- ---------------------------------------------------------
-- activity_logs: log aktivitas pengguna (hanya server-side, tidak
-- ditampilkan di client). Menyimpan IP, negara, browser, dan aksi.
-- ---------------------------------------------------------
create table if not exists activity_logs (
  id bigint generated by default as identity primary key,
  action text not null,
  ip_address text,
  country text,
  browser text,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_at_idx on activity_logs(created_at desc);

-- ---------------------------------------------------------
-- Row Level Security
-- Aplikasi ini TIDAK memakai Supabase Auth / anon key di browser.
-- Semua akses dilakukan lewat server (Next.js Server Actions) memakai
-- SERVICE ROLE KEY, yang otomatis melewati RLS. Maka RLS diaktifkan
-- tanpa policy sama sekali, supaya key publik (anon) tidak bisa
-- membaca/menulis apa pun jika suatu saat tidak sengaja terekspos.
-- ---------------------------------------------------------
alter table app_settings enable row level security;
alter table brackets enable row level security;
alter table participants enable row level security;
alter table matches enable row level security;
alter table break_times enable row level security;
alter table schedule_days enable row level security;
alter table round_schedule_assignments enable row level security;
alter table activity_logs enable row level security;

-- ---------------------------------------------------------
-- MIGRASI: Jika database sudah ada sebelum fitur share ditambahkan,
-- jalankan SQL berikut untuk menambahkan kolom share_token:
-- ---------------------------------------------------------
-- alter table brackets add column if not exists share_token uuid unique default gen_random_uuid();
-- create index if not exists brackets_share_token_idx on brackets(share_token);
