import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import api from "@/lib/api";

const STATUS_STYLE = {
  Selesai: "bg-emerald-100 text-emerald-800",
  Menunggu: "bg-amber-100 text-amber-800",
  Diverifikasi: "bg-blue-100 text-blue-800",
};
const SLA_COLORS = ["#10b981", "#fbbf24", "#ef4444"];

const fmtMiliar = (v) =>
  v >= 1000
    ? `Rp ${(v / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`
    : `Rp ${v} Jt`;

export default function DashboardTab() {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.get("/dashboard/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/projects").then((r) => setProjects(r.data)).catch(() => {});
  }, []);

  const filtered = filter === "warning"
    ? projects.filter((p) => p.status === "Menunggu" || p.slaDays > 0)
    : projects;

  const barData = projects.map((p) => ({ name: p.name, Anggaran: p.plafon, Realisasi: p.realisasi }));
  const slaData = stats
    ? [
        { name: "Tepat Waktu", value: stats.slaBuckets[0] },
        { name: "Mendekati", value: stats.slaBuckets[1] },
        { name: "Terlambat", value: stats.slaBuckets[2] },
      ]
    : [];

  return (
    <div className="space-y-6" data-testid="dashboard-tab">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Plafon RAB", value: stats ? fmtMiliar(stats.totalPlafon) : "—", cls: "text-gray-800", tid: "stat-plafon" },
          { label: "Realisasi Anggaran", value: stats ? fmtMiliar(stats.totalRealisasi) : "—", cls: "text-emerald-600", tid: "stat-realisasi" },
          { label: "Kepatuhan SLA", value: stats ? `${stats.slaCompliance}%` : "—", cls: "text-blue-600", tid: "stat-sla" },
        ].map((s) => (
          <motion.div
            key={s.label}
            whileHover={{ y: -4 }}
            className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-center"
            data-testid={s.tid}
          >
            <span className="text-[10px] font-bold text-gray-400 uppercase">{s.label}</span>
            <span className={`text-xl font-heading font-bold mt-1 ${s.cls}`}>{s.value}</span>
          </motion.div>
        ))}
        <motion.div whileHover={{ y: -4 }} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between" data-testid="stat-kegiatan">
          <span className="text-[10px] font-bold text-gray-400 uppercase">Total Kegiatan</span>
          <span className="text-xl font-heading font-extrabold text-gray-900 mt-0.5">
            {stats ? `${stats.totalKegiatan} Aktif` : "—"}
          </span>
          <div className="flex items-center space-x-2 mt-2">
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-3 py-1 rounded-full">{stats?.proses ?? 0} Proses</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-3 py-1 rounded-full">{stats?.selesai ?? 0} Selesai</span>
          </div>
        </motion.div>
      </div>

      <div className="flex justify-between items-center mb-2 mt-4">
        <h2 className="font-heading text-lg font-bold text-gray-800">Status & Jadwal Pendaftaran Kegiatan</h2>
        <div className="flex space-x-2">
          <button
            data-testid="filter-semua"
            onClick={() => setFilter("all")}
            className={`text-xs px-3 py-1 rounded-full font-medium transition ${filter === "all" ? "bg-emerald-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
          >
            Semua
          </button>
          <button
            data-testid="filter-perlu-tindakan"
            onClick={() => setFilter("warning")}
            className={`text-xs px-3 py-1 rounded-full font-medium transition border ${filter === "warning" ? "bg-amber-500 text-white border-amber-500" : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"}`}
          >
            Perlu Tindakan
          </button>
        </div>
      </div>

      <div className="space-y-4" data-testid="project-list">
        {filtered.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition hover:border-emerald-300 cursor-pointer"
            data-testid={`project-card-${p.nomor_indeks}`}
          >
            <div className="flex items-center space-x-4">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center font-heading font-extrabold text-sm border border-gray-100"
                style={{ backgroundColor: p.tint?.bg, color: p.tint?.fg }}
              >
                {p.tint?.ini || p.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-gray-800">{p.name}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_STYLE[p.status] || "bg-gray-100 text-gray-700"}`}>
                    {p.status}
                  </span>
                </div>
                <div className="flex items-center text-[11px] text-gray-500 mt-1 space-x-3">
                  <span>{p.loc}</span>
                  <span>{p.date}</span>
                  <span className="text-gray-400">{p.nomor_indeks}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 mt-3 md:mt-0 border-gray-100">
              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-bold uppercase">Realisasi</p>
                <p className="text-sm font-heading font-bold text-emerald-600">
                  {p.plafon ? Math.round((p.realisasi / p.plafon) * 100) : 0}%
                </p>
              </div>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8" data-testid="project-list-empty">Tidak ada kegiatan pada filter ini.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="font-heading font-bold text-gray-800 text-sm mb-4">Grafik Realisasi vs Anggaran</h3>
          <div className="chart-container" data-testid="chart-budget-vs-realization">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={48} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => `Rp ${v} Jt`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Anggaran" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Realisasi" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="font-heading font-bold text-gray-800 text-sm mb-4">Status SLA & Pelaporan H+7</h3>
          <div className="chart-container" data-testid="chart-sla-status">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slaData} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="85%" strokeWidth={0}>
                  {slaData.map((_, i) => (
                    <Cell key={i} fill={SLA_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
