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

## Yang Sudah Diimplementasikan (29 Agustus 2026)
- Login 3 peran + seed users + proteksi brute force (lockout 15 menit setelah 5x gagal)
- Dashboard: stat widgets (Plafon, Realisasi, SLA, Total Kegiatan), daftar kegiatan + filter, grafik Bar & Doughnut
- RAB: form input + kategori manual, tabel grup kategori, inline edit, hapus, total otomatis
- AI Perencanaan: generate KAK 12 bagian dari poin mentah, preview dokumen A4 serif, tabel TTD, cetak (print CSS)
- Realisasi: phone-frame OCR (upload foto → AI ekstrak → edit → simpan), tabel rekap CRUD, lihat nota
- AI Laporan: nomor indeks, upload referensi KAK, generate LPJ (BAB I-IV), lampiran (MOCKED upload state), submit ke verifikator
- Persetujuan: antrean approval, tombol Sahkan (status → Diverifikasi)
- Aplikasi Relawan (/relawan): mobile-native look, stat personal, scan nota OCR, riwayat, bottom nav

## Verifikasi
- curl: login/me, stats, projects, rab CRUD, realisasi, approve, ai/kak (12 seksi OK), ai/ocr (nota uji terbaca akurat: TOKO BERKAH JAYA / 275000 / 24/08/2026)
- Screenshot e2e: login → dashboard → RAB → Realisasi → AI KAK generate → relawan app (home + scan)
- Belum diverifikasi di browser: upload foto nota langsung di UI (endpoint OCR sudah terbukti via curl), export PDF/Excel (mock toast)

## Backlog Prioritas
- P0: Aplikasi mobile native (Expo/React Native) di atas API yang ada; upload lampiran asli (object storage); ekspor RAB/KAK PDF-Excel nyata
- P1: Notifikasi SLA otomatis, manajemen pengguna oleh admin, edit profil, filter/cari realisasi
- P2: Offline queue PWA untuk blank spot, tanda tangan digital, multi-kegiatan per RAB
