import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ProjectCard from "@/components/ProjectCard";

const SLA_COLORS = ["#10b981", "#fbbf24", "#ef4444"];
const COMPLETED_STATUSES = ["Selesai", "Diverifikasi"];

const fmtMiliar = (v) =>
  v >= 1000
    ? `Rp ${(v / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} M`
    : `Rp ${v} Jt`;

const sortNewest = (items) => [...items].sort((a, b) => {
  const dateA = Date.parse(a.created_at || "") || 0;
  const dateB = Date.parse(b.created_at || "") || 0;
  if (dateA !== dateB) return dateB - dateA;
  return String(b.nomor_indeks || "").localeCompare(String(a.nomor_indeks || ""));
});

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

  const sortedProjects = sortNewest(projects);
  const activeProjects = sortedProjects.filter((p) => !COMPLETED_STATUSES.includes(p.status));
  const completedProjects = sortedProjects.filter((p) => COMPLETED_STATUSES.includes(p.status));
  const filtered = filter === "warning"
    ? activeProjects.filter((p) => p.status === "Menunggu" || p.slaDays > 0)
    : activeProjects;

  const barData = activeProjects.map((p) => ({ name: p.name, Anggaran: p.plafon, Realisasi: p.realisasi }));
  const maxBudget = Math.max(1, ...barData.flatMap((p) => [p.Anggaran || 0, p.Realisasi || 0]));
  const slaData = stats
    ? [
        { name: "Tepat Waktu", value: stats.slaBuckets[0] },
        { name: "Mendekati", value: stats.slaBuckets[1] },
        { name: "Terlambat", value: stats.slaBuckets[2] },
      ]
    : [];
  const slaTotal = Math.max(1, slaData.reduce((sum, item) => sum + item.value, 0));
  const slaPercents = slaData.map((item) => Math.round((item.value / slaTotal) * 100));
  const donutStyle = {
    background: `conic-gradient(${SLA_COLORS[0]} 0 ${slaPercents[0] || 0}%, ${SLA_COLORS[1]} ${slaPercents[0] || 0}% ${(slaPercents[0] || 0) + (slaPercents[1] || 0)}%, ${SLA_COLORS[2]} ${(slaPercents[0] || 0) + (slaPercents[1] || 0)}% 100%)`,
  };

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
            {stats ? `${activeProjects.length} Aktif` : "—"}
          </span>
          <div className="flex items-center space-x-2 mt-2">
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-3 py-1 rounded-full" data-testid="stat-kegiatan-proses">{activeProjects.length} Proses</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-3 py-1 rounded-full" data-testid="stat-kegiatan-selesai">{completedProjects.length} Selesai</span>
          </div>
        </motion.div>
      </div>

      <div className="flex justify-between items-center mb-2 mt-4 flex-wrap gap-2">
        <h2 className="font-heading text-lg font-bold text-gray-800" data-testid="active-projects-heading">Kegiatan Dalam Proses Terbaru</h2>
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
          <ProjectCard key={p.id} project={p} index={i} onOpen={(item) => navigate(`/kegiatan/${item.id}`)} />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8" data-testid="project-list-empty">Tidak ada kegiatan dalam proses pada filter ini.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="font-heading font-bold text-gray-800 text-sm mb-4">Grafik Realisasi vs Anggaran</h3>
          <div className="chart-container min-w-0 overflow-y-auto pr-1 space-y-3" data-testid="chart-budget-vs-realization">
            {barData.map((p, i) => (
              <div key={p.name} data-testid={`budget-chart-row-${i}`} className="space-y-1.5">
                <div className="flex justify-between gap-3 text-[10px] font-bold text-gray-500">
                  <span className="truncate">{p.name}</span>
                  <span className="whitespace-nowrap">{fmtMiliar(p.Realisasi)} / {fmtMiliar(p.Anggaran)}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
                  <div className="absolute inset-y-0 left-0 bg-slate-300" style={{ width: `${Math.max(4, (p.Anggaran / maxBudget) * 100)}%` }} />
                  <div className="absolute inset-y-0 left-0 bg-emerald-500" style={{ width: `${Math.max(3, (p.Realisasi / maxBudget) * 100)}%` }} />
                </div>
              </div>
            ))}
            {barData.length === 0 && <p className="text-xs text-gray-400 text-center py-10" data-testid="budget-chart-empty">Belum ada data grafik.</p>}
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="font-heading font-bold text-gray-800 text-sm mb-4">Status SLA & Pelaporan H+7</h3>
          <div className="chart-container min-w-0 flex items-center justify-center gap-6 flex-wrap" data-testid="chart-sla-status">
            <div className="w-36 h-36 rounded-full p-5" style={donutStyle} data-testid="sla-donut-chart">
              <div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center text-center shadow-inner">
                <span className="font-heading font-extrabold text-2xl text-gray-900" data-testid="sla-donut-total">{slaTotal}</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Kegiatan</span>
              </div>
            </div>
            <div className="space-y-2 min-w-[180px]">
              {slaData.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between gap-4 text-xs" data-testid={`sla-chart-item-${i}`}>
                  <span className="flex items-center gap-2 text-gray-600"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SLA_COLORS[i] }} />{item.name}</span>
                  <span className="font-bold text-gray-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
