import { ArrowDown, ArrowRight } from "lucide-react";

const STEPS = [
  { no: "01", title: "Pembuatan Akun", detail: "Admin membuat atau memverifikasi akun peserta/pemohon agar proses pendaftaran tercatat resmi." },
  { no: "02", title: "Pendaftaran Online", detail: "Peserta mengisi data pendaftaran dan melengkapi berkas awal secara online." },
  { no: "03", title: "Seleksi Administrasi", detail: "Tim memeriksa kelengkapan dokumen, kesesuaian data, dan persyaratan administrasi." },
  { no: "04", title: "Pengumuman Kelulusan Seleksi Administrasi", detail: "Hasil seleksi administrasi diumumkan sebagai dasar peserta masuk tahap berikutnya." },
  { no: "05", title: "Wawancara Assessment", detail: "Peserta mengikuti wawancara/assessment untuk memvalidasi kebutuhan, komitmen, dan kelayakan program." },
  { no: "06", title: "Verifikasi Faktual", detail: "Tim melakukan pengecekan lapangan atau validasi faktual terhadap data calon penerima manfaat." },
  { no: "07", title: "Pengumuman Kelulusan Penerima Manfaat", detail: "Daftar penerima manfaat yang lolos diumumkan berdasarkan hasil seleksi dan verifikasi." },
  { no: "08", title: "Pengukuhan / Inagurasi", detail: "Penerima manfaat mengikuti pengukuhan/inagurasi sebagai tanda dimulainya program pembinaan." },
  { no: "09", title: "Pencairan Bantuan Tahap I", detail: "Bantuan tahap pertama dicairkan sesuai ketentuan dan hasil verifikasi program." },
  { no: "10", title: "Pembinaan", detail: "Penerima manfaat mengikuti pembinaan, monitoring, dan pendampingan sesuai rancangan program." },
  { no: "11", title: "Pencairan Bantuan Tahap II", detail: "Bantuan tahap kedua dicairkan setelah evaluasi pembinaan dan kelengkapan laporan terpenuhi." },
];

const desktopPosition = (index) => {
  const row = Math.floor(index / 3) + 1;
  const col = (index % 3) + 1;
  return { gridColumn: col, gridRow: row };
};

function FlowArrow({ index }) {
  const isLast = index === STEPS.length - 1;
  if (isLast) return null;
  const isRowEnd = (index + 1) % 3 === 0;
  const Icon = isRowEnd ? ArrowDown : ArrowRight;
  return (
    <span
      data-testid={`registration-flow-arrow-${index + 1}`}
      className={`absolute z-20 w-8 h-8 rounded-full border border-lime-300/35 bg-emerald-800/90 text-lime-200 shadow-lg flex items-center justify-center transition-transform group-hover:scale-110
        ${isRowEnd ? "left-1/2 -bottom-5 -translate-x-1/2" : "right-[-1rem] top-1/2 -translate-y-1/2"}
        hidden md:flex`}
      aria-hidden="true"
    >
      <Icon className="w-4 h-4" />
    </span>
  );
}

export default function RegistrationFlow() {
  return (
    <section className="rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-900 p-4 sm:p-6 shadow-sm overflow-hidden" data-testid="registration-flow-section">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-extrabold text-white" data-testid="registration-flow-heading">Alur Pendaftaran</h2>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-lime-200/80" data-testid="registration-flow-count">{STEPS.length} Tahap</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-7" data-testid="registration-flow-grid">
        {STEPS.map((step, index) => (
          <div
            key={step.no}
            tabIndex={0}
            data-testid={`registration-flow-step-${step.no}`}
            className="group relative min-h-[104px] rounded-2xl border border-white/18 bg-white/10 px-5 py-5 flex items-center overflow-visible shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] focus:outline-none focus:ring-2 focus:ring-lime-300/80"
            style={desktopPosition(index)}
          >
            <div className="relative z-10 pr-12">
              <p className="font-heading text-base sm:text-lg font-extrabold text-white leading-snug" data-testid={`registration-flow-title-${step.no}`}>{step.title}</p>
            </div>
            <span className="absolute right-5 top-4 text-5xl font-heading font-extrabold text-white/8 select-none" data-testid={`registration-flow-number-${step.no}`}>{step.no}</span>
            <div
              data-testid={`registration-flow-tooltip-${step.no}`}
              className="pointer-events-none absolute left-4 right-4 bottom-[calc(100%+0.6rem)] z-30 rounded-xl border border-lime-200/40 bg-white px-4 py-3 text-xs leading-relaxed text-emerald-950 shadow-2xl opacity-0 translate-y-2 transition duration-200 group-hover:opacity-100 group-hover:translate-y-0 group-focus:opacity-100 group-focus:translate-y-0"
            >
              {step.detail}
            </div>
            <FlowArrow index={index} />
            {index < STEPS.length - 1 && (
              <span className="md:hidden absolute left-1/2 -bottom-4 -translate-x-1/2 z-20 w-8 h-8 rounded-full border border-lime-300/35 bg-emerald-800/95 text-lime-200 shadow-lg flex items-center justify-center" data-testid={`registration-flow-mobile-arrow-${step.no}`}>
                <ArrowDown className="w-4 h-4" />
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}