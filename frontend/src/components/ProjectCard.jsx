import { motion } from "framer-motion";

const STATUS_STYLE = {
  Selesai: "bg-emerald-100 text-emerald-800",
  Menunggu: "bg-amber-100 text-amber-800",
  Diverifikasi: "bg-blue-100 text-blue-800",
  Perencanaan: "bg-sky-100 text-sky-800",
};

export default function ProjectCard({ project, index = 0, onOpen }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition hover:border-emerald-300 hover:shadow-md cursor-pointer"
      onClick={() => onOpen(project)}
      data-testid={`project-card-${project.nomor_indeks}`}
    >
      <div className="flex items-center space-x-4 min-w-0">
        <div
          className="w-12 h-12 rounded-lg flex shrink-0 items-center justify-center font-heading font-extrabold text-sm border border-gray-100"
          style={{ backgroundColor: project.tint?.bg, color: project.tint?.fg }}
          data-testid={`project-card-initial-${project.nomor_indeks}`}
        >
          {project.tint?.ini || project.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-800 truncate" data-testid={`project-card-title-${project.nomor_indeks}`}>{project.name}</h3>
            <span data-testid={`project-card-status-${project.nomor_indeks}`} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_STYLE[project.status] || "bg-gray-100 text-gray-700"}`}>
              {project.status}
            </span>
          </div>
          <div className="flex items-center text-[11px] text-gray-500 mt-1 gap-x-3 gap-y-1 flex-wrap">
            <span data-testid={`project-card-location-${project.nomor_indeks}`}>{project.loc || "Lokasi belum diisi"}</span>
            <span data-testid={`project-card-date-${project.nomor_indeks}`}>{project.date || "Tanggal belum diisi"}</span>
            <span className="text-gray-400" data-testid={`project-card-index-${project.nomor_indeks}`}>{project.nomor_indeks}</span>
          </div>
          <div className="flex items-center flex-wrap gap-1.5 mt-2" data-testid={`progress-${project.nomor_indeks}`}>
            {[["Ide", "idea"], ["RAB", "rab"], ["KAK", "kak"], ["Keuangan", "keuangan"], ["Laporan", "laporan"]].map(([label, key]) => (
              <span key={key} data-testid={`project-card-progress-${key}-${project.nomor_indeks}`} className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${project.progress?.[key] > 0 ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-400"}`}>
                {project.progress?.[key] > 0 ? "✓" : "—"} {label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-4 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 mt-3 md:mt-0 border-gray-100">
        <div className="text-right">
          <p className="text-[10px] text-gray-400 font-bold uppercase">Realisasi</p>
          <p className="text-sm font-heading font-bold text-emerald-600" data-testid={`project-card-realization-${project.nomor_indeks}`}>
            {project.plafon ? Math.round((project.realisasi / project.plafon) * 100) : 0}%
          </p>
        </div>
      </div>
    </motion.div>
  );
}