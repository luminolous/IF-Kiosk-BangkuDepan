# Handoff: IF-Kiosk, akhir Oktober 2026

Catatan peralihan dari sesi Claude Code di cloud ke sesi di Claude Desktop (komputer Hadziq).
Isinya: keadaan proyek sekarang, keputusan yang sudah diambil, dan hal yang masih terbuka.
Butir pekerjaan dari peralihan ini sudah tuntas atau sengaja ditunda; lihat [Masih terbuka](#masih-terbuka).

**Pembaca berikutnya (Claude):** baca seluruh file ini dan `README.md` sebelum mulai.

## Keadaan sekarang

Semua yang di bawah ini sudah di `master`, sudah di-deploy, dan sudah diuji.

| | |
|---|---|
| Situs publik | https://hadziq.github.io/IF-Kiosk/ (GitHub Pages, di-deploy oleh `.github/workflows/pages.yml` setiap push ke `master`) |
| Relay ponsel | `wss://if-kiosk-relay.labgigaits.workers.dev`: Cloudflare Worker + Durable Object di akun Cloudflare lab GIGA (`labgigaits@gmail.com`), di-deploy oleh `.github/workflows/relay.yml` |
| Data | `data/*.csv` → `frontend/scripts/build-data.js` (validasi) → `frontend/public/data/kiosk.json` saat build |
| Jadwal | Gasal 2026/27, dari sheet JADWAL di spreadsheet resmi https://its.id/if-jadwal-gasal-2627 |
| Tes | `npm test` di root: tes frontend (`node:test`), tes protokol relay terhadap relay lokal dan terhadap Worker di `wrangler dev`; berjalan di Linux (CI) maupun Windows |

Pairing ponsel sudah dicoba Hadziq di situs publik dan berhasil.

### Riwayat PR

| PR | Isi |
|---|---|
| [#1](https://github.com/hadziq/IF-Kiosk/pull/1) | Fase 0+1: data dari PostgreSQL ke CSV berkunci kode dosen, frontend statis, GitHub Pages. Admin, REST API, reservasi, dan PostgreSQL dihapus. |
| [#2](https://github.com/hadziq/IF-Kiosk/pull/2) | Fase 2: relay di Cloudflare. Protokol bertambah ping/pong dan `session ended`. |
| [#3](https://github.com/hadziq/IF-Kiosk/pull/3) | Gestur sentuh gaya peta (default), skema lama di balik `?gestures=orbit`. |
| [#5](https://github.com/hadziq/IF-Kiosk/pull/5) | Jadwal Gasal 2026/27; `npm test` bisa jalan di Windows. |
| [#6](https://github.com/hadziq/IF-Kiosk/pull/6) | Foto `BJ`, `IG`, `MN`; peringatan dosen yang mengajar di dua ruangan pada jam yang sama; penghuni IF_235 dan Lounge. |

### Keputusan yang sudah diambil

- **Hosting statis di GitHub Pages**, domain `hadziq.github.io/IF-Kiosk/`, karena ITS tidak mengizinkan pembuatan subdomain sembarangan.
- **Data diedit sebagai CSV** (bisa dengan Excel; pemisah `;` juga diterima). Belum ada antarmuka admin, dan memang belum diperlukan.
- **Reservasi ruangan tidak ditangani kiosk**, karena sudah dikelola sistem lain.
- **Dosen dirujuk dengan kode** (`HF`, `RJ`, …) di semua CSV, dan foto dinamai `<kode>.webp`.
- **Kode dosen yang dikonfirmasi Hadziq:** `AZ` (Agus Zainal Arifin), `AV` (Amitava Datta), `MN` (Abdul Munif). Entri "Pak Daniel" dihapus karena duplikat `DO` (Daniel Oranova).
  Bu Adhatus tetap `AL`: spreadsheet jadwal resmi konsisten memakai kode itu.
- **Akun Cloudflare** memakai akun lab GIGA. Secret `CLOUDFLARE_API_TOKEN` dan `CLOUDFLARE_ACCOUNT_ID` sudah diisi di GitHub.
- **Jam jadwal** mengikuti sesi di spreadsheet (07:00, 09:40, 12:30, 15:30, 18:30), masing-masing 150 menit.
  Sesuai catatan di spreadsheet, MK 2 SKS mulai di jam sesi dan selesai 100 menit kemudian.
- **Kelas di ruangan tanpa mesh dilewati:** TIF-109A/B/C (di dalam R.110), TIF-306, TIF-309A, RBTC (IF-114), dan kolom SKPB.
  Ruangan itu baru bisa tampil setelah dimodelkan di `Lantai N.obj`.
- **Foto `AV` tidak disediakan;** kiosk menampilkan inisial, dan itu disetujui Hadziq.
- **Kedua skema gestur dibiarkan live** seperti sekarang; belum ada rencana memilih salah satunya.

## Masih terbuka

- **Spreadsheet jadwal tidak bisa diunduh atau disalin.** Gasal 2026/27 dibaca sel per sel lewat tangkapan layar di Claude in Chrome.
  Untuk semester berikutnya, minta ekspor CSV/XLSX dari pemilik file dulu; dengan ekspor itu, skrip impor ke `jadwal.csv` layak dibuat.
- **Dosen yang tercatat di dua ruangan pada jam yang sama** kini muncul sebagai peringatan di `npm run data:check`.
  Di Gasal 2026/27 ada `AF`/`NZ` (Selasa 15:30), `TA` (Kamis 07:00), dan `HS` (agenda tesis Jumat). Semuanya memang begitu di spreadsheet sumbernya.
- **Skema gestur:** kalau suatu saat dipilih, hapus skema yang kalah: `GESTURES` di `frontend/src/lib/config.js` dan cabang-cabangnya di `useThreeScene.js`, `useWebSocket.js` (parameter di QR), `Kiosk.jsx` (`ground`), dan `MobileControl.jsx`.
  Perbarui juga paragraf "Touch gestures" di `README.md` dan tes di `frontend/tests/cameraMoves.test.js`.

## Hal teknis yang perlu diketahui

- **Identitas commit:** `Hadziq Fabroyir <3130749+hadziq@users.noreply.github.com>`. **Jangan** tambahkan trailer `Co-Authored-By`/`Claude-Session` atau sebutan Claude di pesan commit, dan **jangan** beri footer "Generated with Claude Code" di PR (aturan di CLAUDE.md pribadi Hadziq).
- **Bahasa:** Hadziq menulis dalam bahasa Indonesia. Kode, komentar, pesan commit, dan PR memakai bahasa Inggris. Pesan galat dan peringatan untuk pengedit CSV memakai bahasa Indonesia.
- **Branch kerja dari sesi cloud:** `master-4eke1u`, sekarang sama dengan `master`. Sesi baru boleh memakai branch lain.
- **npm workspaces:** `backend`, `frontend`, dan `relay` berbagi satu `package-lock.json` di root. Jalankan `npm install` hanya dari root.
- **Lint** sudah memuat temuan lama (`react-hooks/refs`, `set-state-in-effect`) sejak sebelum migrasi. Bandingkan dengan `master` supaya hanya temuan baru yang diperbaiki.
- **`wrangler`** membawa tiga temuan audit di `undici`. Itu alat dev/CI saja dan tidak ikut ter-deploy.
- **Relay di `wrangler dev`:** saat relay menutup koneksi, klien Node `ws` baru melaporkan penutupan sekitar 10 detik kemudian; Chromium langsung. Tes "ends the phone's session" memberi batas waktu 15 detik karena itu. Ini bukan bug.
- **Kiosk memuat ulang sendiri** setiap 10 menit kalau `kiosk.json` berubah, dan hanya ketika tidak ada ponsel terhubung. Perubahan yang hanya menyangkut kode tidak memicunya.
- **Copilot** otomatis mereview setiap PR. Temuannya selama ini layak ditindaklanjuti; balas dan tutup thread-nya setelah diperbaiki.
