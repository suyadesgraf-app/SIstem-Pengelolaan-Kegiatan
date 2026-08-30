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
- Frontend: React + Tailwind + framer-motion + lenis + grafik CSS stabil (port 3000)
- Backend: FastAPI (port 8001, prefix /api), JWT httpOnly cookie + Bearer
- DB: MongoDB (users, projects, activity_ideas, rab_items, realisasi, login_attempts)
- AI: emergentintegrations LlmChat (stream_message), EMERGENT_LLM_KEY di backend/.env
- Files: backend/server.py (seluruh API + seed), frontend/src/pages/{Login,Dashboard,RelawanApp}.jsx, components/tabs/* (DashboardTab, RabTab, KakTab, RealisasiTab, LaporanTab, PersetujuanTab)

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 10) — Tema Putih & Lampiran Chat Ide
- Popup Chat Ide dikembalikan ke tema putih yang menyatu dengan UI workspace BAZNAS, dengan panel pesan abu-abu muda dan aksen emerald.
- Lebar popup diperkecil dari 430px menjadi 300px (sekitar 30%) dan tinggi maksimum diperkecil dari 840px menjadi 756px (sekitar 10%).
- Composer pesan dipadatkan menjadi satu baris; pengguna dapat melampirkan PDF atau foto, melihat nama lampiran, dan membatalkannya sebelum mengirim.
- Lampiran chat disimpan nyata melalui object storage, dibatasi PDF/foto dan 15MB, dicatat pada riwayat percakapan, serta dapat dibuka kembali dari bubble pesan.
- Rekomendasi pertanyaan AI kini dipisahkan dari bubble balasan dan ditampilkan sebagai daftar tombol putih ringkas berbingkai emerald agar teks panjang tetap mudah dibaca.
- Preview KAK dan Laporan Kegiatan kini menangkap roda mouse/touchpad saat kursor berada di panel, dengan scroll lokal, overscroll tertahan, dan scrollbar tipis yang terlihat.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 16) — Header Dashboard Disederhanakan
- Menu/header `Daftar Kegiatan` dihapus sesuai permintaan pengguna, sehingga navigasi atas kini hanya menampilkan Dashboard, notifikasi, identitas pengguna, dan Keluar.
- Verifikasi frontend berhasil: `yarn build` sukses dan smoke test Playwright memastikan teks `Daftar Kegiatan` tidak lagi muncul di header dashboard.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 17) — Menu Daftar Kegiatan Selesai
- Menu/header `Daftar Kegiatan` ditambahkan kembali dan kini membuka tampilan khusus daftar kegiatan yang sudah selesai (`Selesai` atau `Diverifikasi`).
- Dashboard utama kini hanya menampilkan kegiatan yang masih dalam proses, diurutkan dari yang terbaru paling atas, sementara kartu statistik membedakan jumlah Proses dan Selesai dari data yang sedang dimuat.
- Daftar Kegiatan dilengkapi pencarian nama/nomor indeks/lokasi/tanggal/status dan kartu kegiatan reusable agar tampilan dashboard serta arsip selesai tetap konsisten.
- Verifikasi frontend berhasil: `yarn build` sukses; Playwright memastikan menu muncul kembali, Dashboard tidak memuat status selesai, dan Daftar Kegiatan hanya memuat status `Selesai`/`Diverifikasi`.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 18) — Hapus Kegiatan
- PIC/Admin dan Super Admin kini dapat menghapus kegiatan dari header workspace memakai tombol ikon tempat sampah tanpa teks.
- Backend memiliki endpoint `DELETE /api/projects/{pid}` dengan akses terbatas: Super Admin dapat menghapus semua kegiatan, PIC/Admin hanya kegiatan miliknya, Relawan ditolak.
- Penghapusan membersihkan data terkait di MongoDB: ide kegiatan, RAB, KAK, laporan, realisasi/nota, serta menandai lampiran terkait sebagai `is_deleted`.
- Verifikasi berhasil: `py_compile` backend OK, `yarn build` frontend OK, curl hapus sebagai PIC OK, curl hapus sebagai Super Admin OK, dan Playwright memastikan ikon hapus + dialog konfirmasi tampil di workspace.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 19) — Info Pembuat Kegiatan untuk Super Admin
- Kartu kegiatan pada akun Super Admin kini menampilkan informasi `Dibuat oleh` berisi nama dan email pembuat kegiatan.
- Backend `/api/projects` menambahkan metadata `created_by_name` dan `created_by_email` khusus response Super Admin, dengan data user diambil tanpa `_id` MongoDB.
- Tampilan ini hanya muncul untuk Super Admin; akun PIC/Admin tetap melihat daftar kegiatan seperti sebelumnya tanpa info pembuat.
- Verifikasi berhasil: `py_compile` backend OK, `yarn build` frontend OK, curl Super Admin mengembalikan nama/email pembuat, Playwright Super Admin menampilkan info pembuat, dan Playwright PIC memastikan info tersebut tidak muncul.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 20) — Nomor Indeks Diinput Saat Laporan Kegiatan
- Pembuatan kegiatan baru tidak lagi membuat nomor indeks otomatis; nomor indeks disimpan dari tab `Laporan Kegiatan` melalui input `Nomor Indeks Laporan`.
- Dashboard dan header workspace tidak menampilkan nomor indeks otomatis lama untuk kegiatan `Perencanaan` yang belum pernah masuk alur laporan; nomor muncul setelah disimpan dari tab laporan atau saat kegiatan sudah masuk status laporan/approval.
- Backend menambahkan endpoint `PUT /api/projects/{pid}/nomor-indeks`, validasi nomor indeks wajib/unik, migrasi ref lampiran jika nomor diubah, serta submit laporan kini berbasis `project_id` + nomor indeks.
- Generate Laporan AI juga memastikan nomor indeks wajib diisi dan menyimpan nomor tersebut ke proyek sebelum dokumen laporan disimpan.
- Verifikasi berhasil: `py_compile` backend OK, `yarn build` frontend OK, curl membuktikan kegiatan baru dibuat tanpa nomor indeks lalu nomor dapat disimpan dari endpoint laporan, dan Playwright memastikan dashboard/workspace tidak menampilkan nomor otomatis serta input laporan kosong sebelum diisi.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 21) — Penyesuaian Judul Dashboard
- Judul daftar proses di dashboard diubah dari `Kegiatan Dalam Proses Terbaru` menjadi `Kegiatan Dalam Proses` sesuai permintaan pengguna.
- Verifikasi berhasil: `yarn build` sukses dan Playwright memastikan heading dashboard sudah berubah.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 22) — Format Resmi KAK + RAB Otomatis
- Preview KAK di tab `KAK` diubah mengikuti contoh PDF pengguna: header logo BAZNAS, nama kegiatan sebagai judul utama, tabel resmi `NO / KOMPONEN / PENJELASAN`, dan footer tanda tangan.
- RAB yang sudah diinput pada tab `RAB` kini otomatis tampil di bawah KAK dalam tabel `Rencana Anggaran Biaya (RAB)` lengkap dengan Qty, Frek, Harga Satuan, Jumlah, dan Total.
- Export KAK PDF dan Word juga diperbarui agar memakai format tabel resmi KAK serta menyertakan tabel RAB otomatis di bawahnya.
- Verifikasi berhasil: `py_compile` backend OK, `yarn build` frontend OK, Playwright memastikan tabel KAK resmi dan RAB bawah KAK tampil, curl export PDF/Word KAK mengembalikan file valid.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 23) — AI Auto-Input RAB dari Draft Ide
- Tombol `Pakai untuk Form RAB` pada tab RAB kini memakai AI untuk menyusun beberapa item RAB otomatis berdasarkan draft ide kegiatan yang sudah disubmit.
- Backend menambahkan endpoint `POST /api/projects/{pid}/ai/rab` yang membaca draft ide, memanggil LLM nyata, memvalidasi JSON item RAB, lalu menyimpan item langsung ke koleksi `rab_items`.
- Frontend menampilkan model picker ringkas dan state loading `AI mengisi RAB...`; setelah berhasil tabel RAB otomatis reload dan total dihitung dari item baru.
- Verifikasi berhasil: integration playbook AI dicek, `py_compile` backend OK, `yarn build` frontend OK, curl menghasilkan dan menyimpan 6 item RAB dari draft dummy, Playwright klik tombol AI RAB berhasil mengisi 7 row dengan total Rp 28.250.000 pada data uji lalu data uji dibersihkan.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 24) — Acuan Pagu SBM pada Input RAB
- PDF `SK SBM (1).pdf` dianalisis dan beberapa acuan pagu umum diekstrak untuk form RAB: makan peserta, makan/minum, snack/kudapan, honor narasumber, MC/moderator, protokol/humas, security/OB/ME, sewa kendaraan, hotel/penginapan, dan pakaian/seragam.
- Saat pengguna mengetik uraian seperti `Makan peserta`, sistem otomatis mengisi kategori, satuan, dan harga satuan sesuai pagu SBM yang cocok.
- Jika pengguna mengubah harga satuan melebihi pagu, form menampilkan peringatan inline `Melebihi pagu SBM` beserta batas maksimalnya.
- AI Auto-Input RAB juga diberi acuan pagu SBM dan backend menyesuaikan item AI yang cocok agar tidak melebihi pagu.
- Verifikasi berhasil: `py_compile` backend OK, `yarn build` frontend OK, Playwright memastikan input `Makan peserta` otomatis mengisi Rp 50.000 dan warning muncul saat harga diubah menjadi Rp 75.000.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 25) — Nomor Urut RAB Kontinu
- Nomor pada tabel RAB kini mengikuti urutan tampil setelah pengelompokan kategori, sehingga selalu berurutan 1, 2, 3, dan seterusnya meskipun item diinput belakangan.
- Verifikasi berhasil: `yarn build` sukses dan Playwright memastikan nomor baris RAB tampil kontinu.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 26) — Branding Ai dan Persetujuan Generate
- Nama sistem di login, header, dan root API diubah menjadi `Sistem Integrasi Pengelolaan Kegiatan Berbasis Ai`.
- Teks hero login diubah menjadi alur: `Pembuatan Ide/Perencanaan, Rencana Anggaran Kegiatan (RAB), Kerangka Acuan Kegiatan (KAK), Rekapitulasi Keuangan Kegiatan hingga Laporan Kegiatan berbasis Ai dengan CEPAT.`
- Marquee nilai layanan diganti menjadi `CEPAT, CERDAS, EMPATI, PROFESIONAL, AMANAH, TRANSPARAN`.
- Generate KAK, Generate Laporan Kegiatan, dan AI Auto-Input RAB kini meminta persetujuan pengguna melalui dialog konfirmasi sebelum memulai proses AI.
- Verifikasi berhasil: `py_compile` backend OK, `yarn build` frontend OK, Playwright memastikan teks branding baru tampil di login/header dan dialog persetujuan muncul sebelum generate KAK.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 27) — Penyempurnaan Preview dan Export KAK
- Kolom `KOMPONEN` pada preview KAK diperkecil sekitar 30% sehingga kolom `PENJELASAN` lebih lebar dan nyaman dibaca.
- Komponen/baris `Rencana Anggaran Biaya` dihapus dari tabel utama KAK; tabel RAB otomatis tetap berada sebagai bagian terpisah di bawah KAK.
- Preview KAK kini dapat diedit manual langsung pada subjudul dan setiap kolom penjelasan, lalu disimpan ke database agar hasil export PDF/Word mengikuti edit terbaru.
- Backend menambahkan endpoint manual KAK: `POST /api/projects/{pid}/kaks/manual` dan `PUT /api/projects/{pid}/kaks/{kid}` dengan akses terbatas PIC/Admin dan Super Admin.
- Export PDF KAK memakai logo BAZNAS BAZIS dengan rasio proporsional, tidak lagi memaksa tinggi logo yang membuat tampilan tidak simetris.
- Nama file export berubah menjadi `KAK-Nama Kegiatan.pdf` dan `KAK-Nama Kegiatan.docx`.
- Verifikasi berhasil: `py_compile` backend OK, `yarn build` frontend OK, curl export PDF/Word valid dengan nama file kegiatan, Playwright memastikan tabel KAK berisi 11 komponen tanpa baris RAB, serta edit manual preview tersimpan dan terkonfirmasi via API. Data uji sudah dibersihkan.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 28) — Hapus Edit Manual Penjelasan KAK
- Fitur edit manual pada kolom `PENJELASAN` preview KAK dihapus sesuai permintaan pengguna; kolom kembali menjadi teks biasa tanpa textarea/resizer.
- Tombol `Simpan Edit KAK` dan input subjudul manual dihapus dari UI preview KAK.
- Verifikasi berhasil: `yarn build` sukses dan Playwright memastikan preview KAK tidak lagi memiliki textarea maupun tombol simpan edit, serta 11 cell penjelasan tampil sebagai teks.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 11) — RCA Gagal Generate Laporan AI
- Penyebab gagal generate Laporan Kegiatan ditemukan dari log backend: provider AI menolak permintaan karena saldo/budget Universal Key sudah habis (`Budget has been exceeded`), sehingga endpoint `/api/ai/report` sebelumnya mengembalikan error generik 500.
- Backend AI kini mengklasifikasikan error budget menjadi HTTP 402 dengan pesan aksi yang jelas; error rate limit menjadi HTTP 429; error lain tetap memakai pesan fallback sesuai fitur.
- Tab Laporan Kegiatan kini menyimpan dan menampilkan alert permanen `laporan-ai-error`, bukan hanya toast sementara, agar PIC tahu langkah pemulihan.
- Catatan status: integrasi AI tetap NYATA dan tidak dimock; generate Laporan/KAK/OCR/Chat AI baru bisa berjalan lagi setelah saldo AI ditambah atau key AI diganti.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 12) — Powered by Cheng Suya
- Login page kini menampilkan kredit `Powered by Cheng Suya` dengan ikon Instagram yang membuka profil `cheng_suya` di tab baru.
- Header/menu dashboard kini menampilkan kredit yang sama dalam bentuk chip ringkas agar tetap rapi di navigasi utama.
- Komponen kredit dibuat reusable dengan data-testid unik untuk area login dan header.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 13) — Reposisi Branding Powered by
- Branding login dipindahkan ke bagian paling bawah area form dan dipusatkan secara horizontal sesuai arahan terbaru.
- Branding dashboard dipindahkan dari header ke sidebar profil, tepat di bawah blok informasi akun (Email dan Unit).
- Styling chip branding disederhanakan menjadi tampilan abu terang yang lebih dekat dengan referensi visual yang diminta; verifikasi Playwright dan frontend testing agent keduanya lulus.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 14) — Branding Tanpa Kotak
- Branding login direvisi lagi menjadi format polos tanpa kotak/chip: hanya ikon Instagram dan teks `Cheng Suya`, tetap di bagian bawah tengah.
- Branding dashboard dipindahkan ke sisi kiri paling bawah kartu sidebar profil, tetap tanpa background, border, atau padding chip.
- Verifikasi ulang berhasil: `yarn build` sukses, smoke test Playwright PASS, dan frontend testing agent menegaskan posisi kiri-bawah serta tampilan tanpa kotak di kedua lokasi.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 15) — Branding Final `Powered by`
- Branding login kini memakai urutan final `Powered by` + ikon Instagram + `Cheng Suya`, tetap polos tanpa kotak dan tetap berada di bawah tengah area login.
- Branding dashboard direposisi lagi ke center paling bawah kartu sidebar akun, memakai urutan teks yang sama dan tanpa gaya chip/kotak.
- Verifikasi final berhasil: `yarn build` sukses, smoke test Playwright PASS, dan frontend testing agent memastikan posisi center bawah serta urutan elemen sesuai arahan terakhir.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 7) — Chat Ide Otomatis Terbuka
- Saat pengguna membuka sub-tab "Buat Ide Kegiatan", popup Chat AI kini langsung tampil otomatis tanpa perlu tombol "Buka Chat AI".
- Tombol/menu pembuka chat dihapus agar alur ide lebih cepat dan ruang draft tetap bersih.
- Panel isi chat diperkuat untuk gulir alami dengan roda mouse, touchpad, dan sentuhan melalui `overflow-y-auto`, `min-h-0`, dan `WebkitOverflowScrolling`.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 8) — Scroll Chat, Auto-Jump, dan Minimize
- Chat ide kini otomatis melompat ke bagian percakapan terbaru saat balasan AI masuk, sehingga hasil jawaban terbaru langsung terlihat.
- Scroll panel chat diperkuat dengan penanganan roda mouse/touchpad langsung di area pesan dan scrollbar tipis yang terlihat.
- Tombol quick reply kini langsung mengirim pesan ke AI, serta tombol minimize/restore pada popup chat diaktifkan kembali tanpa mengembalikan tombol pembuka di panel draft.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 9) — Styling Chat Mengikuti Referensi Emmy
- Lebar dan tinggi popup chat ide disesuaikan agar lebih mendekati proporsi panel chat referensi Emmy di sisi kanan layar.
- Format pesan diubah ke gaya gelap dengan bubble rounded, metadata pengirim di bawah bubble, header status aktif, dan composer bawah yang menyerupai panel chat referensi.
- Model picker diberi tema gelap khusus untuk popup ide agar tetap konsisten dengan tampilan chat baru.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 5) — Alur Ide Kegiatan dengan Chat AI
- Alur workspace diperbarui menjadi: Buat Ide Kegiatan → RAB → KAK → Laporan Keuangan → Laporan Kegiatan.
- Tab "Buat Ide Kegiatan" memiliki Chat AI multi-turn di kiri dan Draft Ide di kanan; chat memakai `session_id`, Gemini 3.1 Pro via emergentintegrations, serta menyimpan riwayat dan draft ke MongoDB `activity_ideas`.
- Draft Ide dapat diedit manual, disimpan, lalu disubmit sebagai bahan pembuatan RAB dan KAK; progress kartu kegiatan kini memiliki chip "Ide".
- Tab RAB membaca Draft Ide submitted dan menyediakan tombol "Pakai untuk Form RAB"; tab KAK membaca Draft Ide submitted dan menyediakan tombol "Muat Draft Ide" ke textarea generate KAK.
- Perbaikan hasil testing: brute-force login lockout memakai identifier email stabil agar tidak gagal di belakang ingress/proxy; seed user idempoten mengupdate password seeded bila berubah; CORS memakai origin eksplisit; dashboard chart diganti grafik CSS agar tidak ada warning Recharts.

## Yang Sudah Diimplementasikan (30 Agustus 2026, sesi 6) — Gulir Otomatis Ide Kegiatan
- Chat AI Ide Kegiatan dipindahkan ke popup mandiri dan bisa diminimalkan menjadi tombol melayang di tengah bawah layar. Draft Ide kini memakai seluruh lebar workspace agar lebih mudah dibaca dan diedit.
- Fitur gulir otomatis berdasarkan posisi kursor dihilangkan. Panel panjang tetap mendukung gulir normal dengan roda mouse, touchpad, dan gestur sentuh; scrollbar visual disembunyikan.
- Popup Chat AI disempurnakan menjadi jendela kecil di kanan bawah, menyerupai chat mengambang. Bagian header berfungsi sebagai handle seret sehingga pengguna desktop dapat memindahkan posisinya; posisi terakhir dipertahankan selama halaman workspace terbuka.

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
- Sesi 5: testing_agent backend+frontend berhasil untuk fitur Ide Kegiatan tetapi menemukan auth lockout lama; diperbaiki dan diverifikasi ulang. Self-test: real Gemini chat ide OK, save/submit draft OK, progress Ide OK, RAB/KAK mengambil bahan ide OK, py_compile OK, yarn build compiled successfully, pytest 6/6 passed, Playwright smoke test OK. Console final hanya 401 normal dari pengecekan /auth/me sebelum login; warning chart hilang setelah Recharts diganti grafik CSS.
- Sesi 7: Playwright smoke test OK untuk login PIC → buka workspace kegiatan → klik sub-tab Ide → popup chat tampil otomatis tanpa tombol pembuka; panel chat tampil stabil dan siap digulir saat isi melebihi tinggi panel.
- Sesi 8: Playwright smoke test OK untuk login PIC → buka workspace → klik tab Ide → quick reply terkirim otomatis → chat auto-scroll ke bawah; verifikasi scroll panel dengan roda mouse berhasil (`scrollTop` berubah 5068 → 4068 → 5068); minimize dan restore popup chat juga berhasil.
- Sesi 9: Playwright smoke test OK untuk login PIC → buka workspace → tab Ide menampilkan popup chat dengan styling gelap ala referensi Emmy; render header, bubble pesan, dan composer baru tampil normal.
- Sesi 10: Build frontend dan `py_compile` backend OK. Playwright login PIC → workspace → Chat Ide berhasil memverifikasi popup putih 300px serta pemilihan PDF. curl berhasil mengunggah lalu menghapus PDF uji; validasi API menolak referensi lampiran chat yang tidak sah (400).
- Sesi 10 (penyempurnaan): Playwright memverifikasi rekomendasi pertanyaan tampil sebagai daftar tombol ringkas dan dapat dipilih dari popup Chat Ide.
- Sesi 10 (preview dokumen): Playwright memverifikasi scroll lokal KAK berubah 0→960 dengan roda mouse. Untuk konten Laporan yang panjang, handler preview juga terverifikasi berubah 0→581; build frontend berhasil.
- Sesi 11: py_compile backend OK, yarn build frontend OK. curl login PIC + POST `/api/ai/report` kini mengembalikan 402 dengan detail penyebab budget AI habis. Playwright login PIC → workspace → tab Laporan → generate menampilkan alert `laporan-ai-error` berisi instruksi tambah balance/auto top up.
- Sesi 12: yarn build frontend berhasil. Playwright memverifikasi kredit tampil di login dan header dashboard, href sesuai link Instagram yang diminta, dan klik ikon/link membuka Instagram di tab baru.

- Sesi 13 (Jun 2026): Fallback Gemini → Universal Key diaktifkan (`GEMINI_USE_EMERGENT_FALLBACK=True` di server.py) karena `GEMINI_API_KEY` pengguna kena 402/503. curl login PIC OK: `/api/ai/kak` menghasilkan KAK lengkap dan `/api/ai/report` menghasilkan LPJ BAB I-IV. Fungsi AI inti pulih. Balik ke key pengguna cukup set flag ke False saat key aktif.

## Backlog Prioritas
- P0 (SELESAI): Fungsi AI pulih via fallback Universal Key untuk Gemini. Saat GEMINI_API_KEY pengguna aktif, set GEMINI_USE_EMERGENT_FALLBACK=False.
- P0 (SELESAI): Fitur hapus kegiatan untuk PIC/Admin dan Super Admin.
- P1: Notifikasi Nota Baru ke PIC saat relawan menyimpan nota.
- P2: Offline queue PWA untuk blank spot, tanda tangan digital, filter/cari realisasi lanjutan, multi-kegiatan per RAB, opsi mobile native Expo/React Native di atas API yang sudah ada.
- P2: Cetak Label Arsip PDF per kegiatan dengan QR code.
