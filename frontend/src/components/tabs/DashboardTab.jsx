import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STATUS_STYLE = {
  Selesai: "bg-emerald-100 text-emerald-800",
  Menunggu: "bg-amber-100 text-amber-800",
  Diverifikasi: "bg-blue-100 text-blue-800",
  Perencanaan: "bg-sky-100 text-sky-800",
};
const SLA_COLORS = ["#10b981", "#fbbf24", "#ef4444"];

const fmtMiliar = (v) =>
  v >= 1000
    ? `Rp ${(v / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`
    : `Rp ${v} Jt`;

export default function DashboardTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newK, setNewK] = useState({ name: "", loc: "", date: "", plafon: "" });
  const canCreate = user.role === "pic" || user.role === "superadmin";

  const loadProjects = () => api.get("/projects").then((r) => setProjects(r.data)).catch(() => {});

  useEffect(() => {
    api.get("/dashboard/stats").then((r) => setStats(r.data)).catch(() => {});
    loadProjects();
  }, []);

  const createKegiatan = async () => {
    if (!newK.name.trim()) return toast.warning("Nama kegiatan wajib diisi");
    setCreating(true);
    try {
      const r = await api.post("/projects", {
        name: newK.name.trim(), loc: newK.loc.trim(), date: newK.date.trim(),
        plafon: parseInt(newK.plafon) || 0,
      });
      toast.success(`Kegiatan "${r.data.name}" dibuat (${r.data.nomor_indeks})`);
      setShowCreate(false);
      setNewK({ name: "", loc: "", date: "", plafon: "" });
      navigate(`/kegiatan/${r.data.id}`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setCreating(false);
    }
  };

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

      <div className="flex justify-between items-center mb-2 mt-4 flex-wrap gap-2">
        <h2 className="font-heading text-lg font-bold text-gray-800">Status & Jadwal Pendaftaran Kegiatan</h2>
        <div className="flex space-x-2 items-center">
          {canCreate && (
            <button
              data-testid="kegiatan-add-button"
              onClick={() => setShowCreate(!showCreate)}
              className="text-xs px-3 py-1.5 rounded-full font-bold bg-emerald-700 text-white hover:bg-emerald-800 active:scale-95 transition flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" /><span>Tambah Kegiatan</span>
            </button>
          )}
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

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm space-y-3 mb-4" data-testid="kegiatan-create-form">
              <p className="font-heading font-bold text-sm text-gray-800">Kegiatan Baru</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input data-testid="kegiatan-name-input" value={newK.name} onChange={(e) => setNewK({ ...newK, name: e.target.value })} placeholder="Nama kegiatan (mis: Layanan Kesehatan NTT)" className="text-xs border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500" />
                <input data-testid="kegiatan-loc-input" value={newK.loc} onChange={(e) => setNewK({ ...newK, loc: e.target.value })} placeholder="Lokasi" className="text-xs border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500" />
                <input data-testid="kegiatan-date-input" value={newK.date} onChange={(e) => setNewK({ ...newK, date: e.target.value })} placeholder="Tanggal (mis: 5 September 2026)" className="text-xs border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500" />
                <input data-testid="kegiatan-plafon-input" type="number" value={newK.plafon} onChange={(e) => setNewK({ ...newK, plafon: e.target.value })} placeholder="Plafon anggaran (Rp juta)" className="text-xs border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <button data-testid="kegiatan-create-submit" onClick={createKegiatan} disabled={creating} className="bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-60">
                {creating ? "Menyimpan..." : "Simpan & Buka Perencanaan"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4" data-testid="project-list">
        {filtered.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition hover:border-emerald-300 hover:shadow-md cursor-pointer"
            onClick={() => navigate(`/kegiatan/${p.id}`)}
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
