# PRD — Sistem Integrasi Pengelolaan Kegiatan BAZNAS BAZIS DKI

## Problem Statement (asli)
"Saya punya kode aplikasi frontend yang sudah saya buat dalam PDF yang saya upload, tolong buatkan aplikasi samakan frontendnya seperti kode itu dan buatkan backendnya. Saya ingin menggunakan lintas platform mobile app juga untuk pengguna relawan yang mana untuk input laporan nota keuangan."

## Keputusan Pengguna
- AI sungguhan (Emergent LLM Key, OpenAI gpt-5.4 / gpt-5.4-mini) untuk KAK, Laporan, dan OCR nota
- Login email & password dengan 3 peran: Super Admin/Pimpinan, Admin/PIC, Relawan Lapangan
- Mobile: user memilih React Native/Flutter native — lingkungan build hanya mendukung React web; solusi yang dikirim: aplikasi web mobile-first bergaya native (route /relawan), backend API sudah siap untuk aplikasi native di masa depan
- OCR nota: upload foto + AI membaca merchant/nominal/tanggal otomatis

## User Personas
- Super Admin / Pimpinan: dashboard analitik global, pengesahan akhir dokumen
- Admin / PIC Kegiatan: kelola RAB, generate KAK/Laporan AI, verifikasi laporan relawan
- Relawan Lapangan: input realisasi nota keuangan via scan foto + OCR AI

## Arsitektur
- Frontend: React + Tailwind + framer-motion + lenis + recharts (port 3000)
- Backend: FastAPI (port 8001, prefix /api), JWT httpOnly cookie + Bearer
- DB: MongoDB (users, projects, rab_items, realisasi, login_attempts)
- AI: emergentintegrations LlmChat (stream_message), EMERGENT_LLM_KEY di backend/.env
- Files: backend/server.py (seluruh API + seed), frontend/src/pages/{Login,Dashboard,RelawanApp}.jsx, components/tabs/* (DashboardTab, RabTab, KakTab, RealisasiTab, LaporanTab, PersetujuanTab)

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 4) — Pesan Revisi & Edit/Batalkan Lampiran
- Pesan revisi Pimpinan: tab Persetujuan kini memiliki kolom "Pesan Revisi" per kegiatan berstatus Menunggu; pesan dikirim ke endpoint /api/projects/{pid}/revise dan masuk ke notifikasi PIC sebagai poin perbaikan.
- Backend revisi menyimpan revision_message, revision_requested_by, revision_requested_at, mengembalikan status kegiatan ke Perencanaan, dan membatasi pesan maksimal 1000 karakter.
- Lampiran dapat diedit/diganti dan dibatalkan sebelum laporan disubmit melalui ikon unduh, edit, dan batalkan di galeri lampiran; setelah status bukan Perencanaan, kontrol edit/batalkan dikunci.
- Backend file memiliki endpoint DELETE /api/files/{fid} untuk soft-delete dan PUT /api/files/{fid}/replace untuk mengganti file di object storage dengan kontrol akses role/PIC dan status kegiatan.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 3) — Ekspor LPJ, Notif Persetujuan, Galeri, Paket PDF
- Ekspor Laporan Kegiatan (LPJ): PDF & Word dari versi tersimpan terbaru + tombol Google Doc (panduan unggah Word); endpoint /export/report.pdf & report.docx
- Notifikasi persetujuan: Sahkan → notif "DISAHKAN oleh ..." ke PIC pemilik kegiatan; tombol baru "Minta Revisi" di Persetujuan → status kembali Perencanaan + notif revisi ke PIC; lonceng notifikasi dengan badge & panel kini juga ada di header web (Dashboard & Workspace, polling 30 detik)
- Galeri Lampiran: daftar file terunggah per laporan tampil di tab Laporan Kegiatan dengan tombol "Lihat / Unduh" (metadata nama, label, ukuran)
- Ringkasan Cetak Kegiatan: tombol "Unduh Paket PDF" di header workspace — satu PDF berisi Bagian I KAK, II RAB (tabel + total), III Laporan Keuangan (tabel + total), IV Laporan Kegiatan (jika ada)

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 2) — Ekspor, Notifikasi, Progres, Nonaktif Akun
- Ekspor dokumen nyata: RAB → Excel (.xlsx openpyxl, header emerald + total) dan PDF (reportlab landscape) ; KAK → PDF dan Word (.docx python-docx) dari versi KAK tersimpan terbaru; tombol Google Doc mengarahkan unduh Word; endpoint /api/projects/{pid}/export/{rab.xlsx|rab.pdf|kak.pdf|kak.docx}
- Notifikasi relawan: PIC membuat kegiatan → semua relawan aktif milik PIC menerima notifikasi; lonceng + badge unread di header aplikasi relawan, panel bottom-sheet, tandai semua dibaca (koleksi notifications)
- Progres perencanaan: setiap kartu kegiatan menampilkan checklist KAK/RAB/Keuangan/Laporan (✓ hijau jika ada isi, — abu jika belum), dihitung live per proyek di list_projects
- Nonaktifkan akun: Super Admin dapat nonaktifkan/aktifkan PIC & relawan, PIC untuk relawannya; akun nonaktif ditolak saat login (403) dan saat pakai token lama

## Yang Sudah Diimplementasikan (30 Agustus 2026) — Alur Hierarki & Workspace Kegiatan
- Alur lengkap sesuai permintaan: PIC input Kegiatan (tombol "Tambah Kegiatan" di dashboard) → kartu kegiatan bisa diklik membuka Workspace (/kegiatan/:id) berisi 4 sub-tab: KAK, RAB, Laporan Keuangan, Laporan Kegiatan — semua riwayat perencanaan tersimpan per kegiatan
- Hierarki akun: Super Admin membuat akun PIC, PIC membuat akun Relawan (tab "Kelola Akun"); relawan tidak bisa membuat akun (403); email duplikat ditolak (409)
- Scope data: setiap PIC hanya melihat kegiatan, RAB, dan statistik miliknya; relawan hanya melihat kegiatan dari PIC-nya; PIC baru bisa dibuat banyak dan terisolasi satu sama lain
- RelawanApp: beranda menampilkan "Kegiatan untuk Anda" — klik kegiatan langsung masuk mode scan dengan kegiatan terpilih (chip), nota tersimpan dengan project_id
- Laporan keuangan relawan per kegiatan muncul di sub-tab "Laporan Keuangan" milik PIC (edit/hapus/lihat nota + total realisasi)
- KAK & Laporan Kegiatan AI tersimpan per kegiatan (kaks, reports collection) dengan riwayat versi + provider yang dipakai; Laporan Kegiatan terkunci ke nomor indeks kegiatan
- Nomor indeks otomatis (00-26XXXXXX), status kegiatan baru: "Perencanaan" → submit laporan → "Menunggu" → disahkan → "Diverifikasi"
- Migrasi data lama: proyek seed di-assign ke PIC demo (pic@baznas.id), relawan demo di-link ke PIC tersebut, RAB & realisasi lama di-link ke kegiatan terkait

## Yang Sudah Diimplementasikan (29 Agustus 2026)
- File & media storage (Emergent Object Storage): foto nota relawan tersimpan ke cloud storage (bukan base64 di MongoDB), diambil kembali lewat backend; unggahan lampiran laporan (6 jenis) dan referensi KAK TTD kini NYATA tersimpan dengan metadata di MongoDB (soft-delete, is_deleted), bisa di-download ulang via /api/files/{id}/download; status lampiran persisten per nomor indeks
- Integrasi model Gemini berdampingan dengan OpenAI: pemilih model (ModelPicker) di semua fitur AI. Gemini 3.1 Pro Preview untuk KAK/Laporan, Gemini 3.7 Flash untuk OCR nota; OpenAI gpt-5.4 / gpt-5.4-mini tetap tersedia. Backend /ai/kak, /ai/report, /ai/ocr menerima param `provider` (openai|gemini) dengan validasi 400 untuk provider tak dikenal
- Login 3 peran + seed users + proteksi brute force (lockout 15 menit setelah 5x gagal)
- Dashboard: stat widgets (Plafon, Realisasi, SLA, Total Kegiatan), daftar kegiatan + filter, grafik Bar & Doughnut
- RAB: form input + kategori manual, tabel grup kategori, inline edit, hapus, total otomatis
- AI Perencanaan: generate KAK 12 bagian dari poin mentah, preview dokumen A4 serif, tabel TTD, cetak (print CSS)
- Realisasi: phone-frame OCR (upload foto → AI ekstrak → edit → simpan), tabel rekap CRUD, lihat nota
- AI Laporan: nomor indeks, upload referensi KAK (tersimpan nyata), generate LPJ (BAB I-IV), lampiran upload nyata ke cloud storage, submit ke verifikator
- Persetujuan: antrean approval, tombol Sahkan (status → Diverifikasi)
- Aplikasi Relawan (/relawan): mobile-native look, stat personal, scan nota OCR, riwayat, bottom nav

## Verifikasi
- curl: login/me, stats, projects, rab CRUD, realisasi, approve, ai/kak (12 seksi OK), ai/ocr (nota uji terbaca akurat: TOKO BERKAH JAYA / 275000 / 24/08/2026)
- Screenshot e2e: login → dashboard → RAB → Realisasi → AI KAK generate → relawan app (home + scan)
- Belum diverifikasi di browser: upload foto nota langsung di UI (endpoint OCR sudah terbukti via curl), export PDF/Excel (mock toast)
- Sesi 4: py_compile backend OK; yarn build OK dengan warning lama unrelated di KeuanganTab/RabTab/RelawanApp; API e2e OK untuk upload → replace → delete lampiran, submit, revisi dengan pesan, dan notifikasi PIC; screenshot Playwright OK untuk kolom pesan revisi serta ikon unduh/edit/batalkan lampiran.

## Backlog Prioritas
- P0: Tidak ada blocker aktif pada alur utama saat ini.
- P1: Notifikasi Nota Baru ke PIC saat relawan menyimpan nota; Cetak Label Arsip PDF per kegiatan dengan QR code.
- P2: Offline queue PWA untuk blank spot, tanda tangan digital, filter/cari realisasi lanjutan, multi-kegiatan per RAB, opsi mobile native Expo/React Native di atas API yang sudah ada.
