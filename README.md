# 🏸 Bracket Badminton

Aplikasi web untuk mengelola bagan (bracket) turnamen badminton: import peserta dari Excel,
pengacakan otomatis (anti sesama PB di babak 1), penjadwalan jam otomatis per babak, dukungan
multi-lapangan, waktu istirahat khusus (misal: sholat), pencatatan hasil pertandingan, efek
confetti saat final, dan unduh bagan sebagai gambar resolusi tinggi. Dibangun dengan **Next.js**
(App Router) dan **Supabase** (Postgres) sebagai database. Tanpa sistem login rumit — cukup PIN
4 digit.

---

## ✨ Fitur

- **Banyak bracket** — buat turnamen sebanyak yang Anda mau, masing-masing berdiri sendiri.
- **Import peserta via Excel** — cukup kolom **Nama** dan **Nama PB**. Tambah manual satu-satu
  juga bisa lewat form.
- **Edit nama bracket** — klik ikon pensil di halaman detail bracket untuk mengganti nama
  turnamen kapan saja.
- **Pengacakan pintar** — di babak 1, sistem berusaha keras supaya dua peserta dari **PB yang
  sama tidak bertemu**. Kalau ada satu PB yang jumlah pesertanya sangat dominan (lebih dari
  separuh total slot), sistem tetap membuat bagan sebaik mungkin dan memberi peringatan jika
  ada pertemuan sesama PB yang benar-benar tidak terhindarkan secara matematis.
- **BYE otomatis** — kalau jumlah peserta bukan kelipatan 2 (misal 6, 11, 13 peserta), slot
  kosong (BYE) dibagikan otomatis dan pemenangnya langsung maju ke babak berikutnya.
- **Jadwal jam otomatis** — Anda hanya mengisi jam mulai turnamen, durasi tiap babak, dan waktu
  istirahat antar babak. Jam seluruh babak (termasuk babak yang pesertanya belum diketahui)
  langsung dihitung di awal.
- **Dukungan multi-lapangan** — tentukan jumlah lapangan yang tersedia, penjadwalan otomatis
  akan mendistribusikan pertandingan ke seluruh lapangan secara paralel.
- **Waktu istirahat khusus** — bisa menambahkan rentang waktu istirahat (contoh: waktu sholat
  Jumat pukul 11:45–13:00) yang akan dihindari sistem saat menghitung jadwal pertandingan.
  Istirahat ini berlaku berulang setiap hari selama turnamen berlangsung.
- **Editor jadwal lengkap** — ubah jam mulai, durasi, jumlah lapangan, dan waktu istirahat
  kapan saja dari halaman detail bracket melalui dialog yang mudah digunakan.
- **Babak berikutnya tampil kosong ("—Menunggu—")** sampai pemenang babak sebelumnya dipilih;
  begitu diklik, otomatis maju ke kotak berikutnya.
- **Efek confetti** 🎉 — saat pemenang final dipilih, efek confetti otomatis muncul sebagai
  perayaan!
- **Unduh gambar HD** — bagan lengkap bisa diunduh sebagai PNG resolusi tinggi (3x), siap
  dicetak atau dibagikan di grup WhatsApp.
- **Log aktivitas server-side** — setiap aksi penting (login, buat/hapus bracket, generate
  bagan, dll.) dicatat di database lengkap dengan IP, negara, dan browser. Log ini hanya
  bisa diakses langsung dari Supabase, tidak ditampilkan di UI.
- **Autentikasi PIN 4 digit** (bukan login akun) — PIN disimpan di database, bisa diganti dari
  halaman Pengaturan.

---

## 🧱 Teknologi

- [Next.js 16](https://nextjs.org) (App Router, Server Actions, TypeScript)
- [Supabase](https://supabase.com) (Postgres) — diakses lewat **Service Role Key** di server saja
- [Tailwind CSS v4](https://tailwindcss.com)
- [Radix UI](https://www.radix-ui.com) — komponen dialog, alert dialog, select, popover, label
- [Lucide React](https://lucide.dev) — ikon
- [xlsx (SheetJS)](https://www.npmjs.com/package/xlsx) untuk membaca file Excel
- [html-to-image](https://github.com/bubkoo/html-to-image) untuk ekspor bagan ke PNG
- [canvas-confetti](https://www.npmjs.com/package/canvas-confetti) untuk efek confetti 🎉
- [date-fns](https://date-fns.org) untuk manipulasi tanggal
- [Sonner](https://sonner.emilkowal.ski) untuk toast notification

---

## 🚀 Cara Menjalankan

### 1. Buat proyek Supabase

1. Buat proyek baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, tempel seluruh isi file [`supabase/schema.sql`](./supabase/schema.sql),
   lalu jalankan (Run). Ini akan membuat tabel `app_settings`, `brackets`, `participants`,
   `matches`, `break_times`, dan `activity_logs`, sekaligus mengisi PIN default `8888`.
3. Buka **Project Settings → API**, catat:
   - **Project URL**
   - **service_role secret** (⚠️ bukan `anon` key — aplikasi ini sengaja hanya memakai
     service role key di server, supaya tidak perlu login Supabase Auth di browser)

### 2. Siapkan environment variables

Salin `.env.example` (jika ada) atau buat file `.env.local`:

```bash
cp .env.example .env.local
```

Isi `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=isi-dengan-service-role-key-anda
APP_SESSION_SECRET=isi-dengan-string-acak-panjang
```

Untuk membuat `APP_SESSION_SECRET` acak, jalankan:

```bash
openssl rand -hex 32
```

### 3. Install dependency & jalankan

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) → akan diarahkan ke halaman login → masukkan
PIN default **8888**.

### 4. Deploy (opsional)

Aplikasi ini adalah aplikasi Next.js standar, bisa di-deploy ke [Vercel](https://vercel.com) atau
platform Node.js lain. Jangan lupa set ketiga environment variable di atas pada pengaturan
deployment.

---

## 📋 Format Excel Import Peserta

Sheet pertama pada file harus punya baris header dengan minimal 2 kolom (urutan bebas, nama
kolom tidak case-sensitive):

| Nama            | Nama PB       |
|-----------------|---------------|
| Andi Saputra    | PB Garuda     |
| Budi Santoso    | PB Elang Mas  |
| Citra Wulandari | PB Garuda     |

Nama kolom yang juga dikenali otomatis: `Name`, `Nama Peserta`, `Nama Pemain` (untuk nama), dan
`PB`, `Klub`, `Club`, `Nama Klub` (untuk PB/klub). Baris tanpa nama akan diabaikan. Anda juga
bisa menambah peserta satu-satu lewat form di halaman detail bracket.

---

## 🔐 Tentang Autentikasi PIN

Aplikasi ini **tidak** memakai sistem login/akun. Sebagai gantinya:

- Semua orang yang tahu PIN 4 digit bisa mengelola aplikasi (cocok untuk dipakai bersama panitia
  di satu perangkat/laptop panitia turnamen).
- PIN diverifikasi di server terhadap tabel `app_settings`, lalu sesi disimpan di **cookie
  httpOnly yang ditandatangani (HMAC-SHA256)** memakai `APP_SESSION_SECRET` — cookie ini tidak
  bisa dipalsukan tanpa mengetahui secret tersebut, dan kedaluwarsa otomatis setelah 12 jam.
  Tidak ada tabel sesi terpisah di database.
- Ganti PIN kapan saja dari halaman **Pengaturan** (`/settings`).
- **Service Role Key** Supabase hanya pernah dipakai di kode server (Server Component / Server
  Action) dan tidak pernah dikirim ke browser, jadi aman dari sisi client meskipun tidak memakai
  Supabase Auth / Row Level Security policy publik.

---

## 🧮 Cara Kerja Pengacakan & Penjadwalan

1. Jumlah peserta dibulatkan ke atas ke pangkat 2 terdekat (misal 11 peserta → bagan 16 slot,
   5 slot sisanya jadi BYE).
2. Sistem mencoba ratusan kombinasi acak untuk susunan babak 1, memilih yang paling sedikit
   (idealnya nol) mempertemukan dua peserta dari PB yang sama, lalu melakukan penukaran lokal
   tambahan untuk membereskan sisa bentrokan yang mungkin masih ada.
3. Peserta yang mendapat BYE otomatis dianggap menang dan langsung mengisi slot di babak
   berikutnya. Pertandingan lain di babak berikutnya tetap tampil kosong ("— Menunggu —") sampai
   hasil pertandingan sebenarnya dicatat.
4. Jadwal jam **dihitung sekali di awal** berdasarkan jam mulai, durasi per babak, waktu
   istirahat, dan **jumlah lapangan** — pertandingan dalam satu babak didistribusikan secara
   paralel ke seluruh lapangan yang tersedia. Waktu istirahat khusus (seperti sholat) juga
   otomatis dihindari. Ini supaya panitia punya jadwal pasti dari awal untuk diumumkan ke
   peserta.
5. Menekan tombol **"Acak Ulang Bagan"** akan menghapus seluruh hasil pertandingan yang sudah
   tercatat dan membuat susunan baru — gunakan dengan hati-hati.

---

## ⚠️ Catatan & Batasan yang Perlu Diketahui

- Paket `xlsx` yang dipakai (versi dari registry npm publik) punya beberapa kerentanan keamanan
  yang sudah diketahui (lihat hasil `npm audit`). Karena file yang diproses hanya diunggah oleh
  panitia yang sudah masuk lewat PIN (bukan input publik), risikonya rendah untuk pemakaian
  normal. Jika ingin versi terbaru, SheetJS menyarankan install langsung dari CDN mereka:
  ```bash
  npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
  ```
  (perlu koneksi internet ke `cdn.sheetjs.com` saat instalasi).
- Format bagan yang didukung adalah **gugur tunggal (single elimination)** — format paling umum
  untuk turnamen badminton komunitas/RW. Format lain (round robin, double elimination) belum
  didukung.
- Mengubah pemenang suatu pertandingan yang babak setelahnya sudah berjalan akan otomatis
  mengosongkan kembali hasil di babak-babak setelah itu yang bergantung padanya.
- Belum ada fitur multi-kategori dalam satu turnamen (mis. tunggal putra & ganda putri) — untuk
  itu, buat bracket terpisah untuk tiap kategori (aplikasi memang didesain untuk mendukung banyak
  bracket sekaligus).

---

## 📁 Struktur Proyek

```
app/
  login/               Halaman & aksi verifikasi PIN
  logout/              Aksi logout
  dashboard/           Daftar semua bracket
  brackets/new/        Form buat bracket baru
  brackets/[id]/       Detail bracket: peserta, pengacakan, editor jadwal, tampilan bagan
  settings/            Ganti PIN & nilai default (durasi, jumlah lapangan)
components/
  ui/                  Komponen UI dasar (button, dialog, input, select, dll.)
  BracketBoard.tsx     Papan bagan utama dengan ekspor PNG
  BracketList.tsx      Daftar bracket di dashboard
  BracketNameEditor.tsx  Dialog ganti nama bracket
  CreateBracketForm.tsx  Form buat bracket baru
  AddParticipantForm.tsx      Form tambah peserta manual
  ImportParticipantsForm.tsx  Form import peserta dari Excel
  ParticipantsTable.tsx       Tabel daftar peserta
  GenerateBracketButton.tsx   Tombol generate bagan
  ScheduleEditor.tsx          Dialog editor jadwal (jam mulai, durasi, lapangan, istirahat)
  DeleteBracketButton.tsx     Tombol hapus bracket
  MatchBox.tsx                Kotak pertandingan individual di bagan
  WinnerDialog.tsx            Dialog konfirmasi pemenang + efek confetti
  ParticipantChangeAlert.tsx  Alert saat peserta berubah setelah bagan sudah jadi
  NavigationProgress.tsx      Indikator progress langkah (peserta → jadwal → bagan)
  DatePicker.tsx / TimePicker.tsx  Komponen input tanggal & jam
  PinForm.tsx / LogoutButton.tsx    Komponen autentikasi
lib/
  bracket-logic.ts    Algoritma inti: pengacakan anti-sesama-PB, BYE, penjadwalan multi-lapangan
  excel.ts            Parser file Excel peserta
  auth.ts             Manajemen sesi PIN (cookie bertanda tangan HMAC-SHA256)
  activity-log.ts     Pencatatan log aktivitas server-side (IP, negara, browser)
  types.ts            Definisi tipe TypeScript
  utils.ts            Fungsi-fungsi utility
  supabase/server.ts  Klien Supabase (service role, server-only)
supabase/schema.sql   Skema database — jalankan ini di Supabase SQL Editor
```
