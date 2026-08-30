import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import KakTab from "@/components/tabs/KakTab";
import RabTab from "@/components/tabs/RabTab";
import KeuanganTab from "@/components/tabs/KeuanganTab";
import LaporanTab from "@/components/tabs/LaporanTab";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STATUS_STYLE = {
  Selesai: "bg-emerald-100 text-emerald-800",
  Menunggu: "bg-amber-100 text-amber-800",
  Diverifikasi: "bg-blue-100 text-blue-800",
  Perencanaan: "bg-sky-100 text-sky-800",
};

const SUBTABS = [
  { id: "kak", label: "KAK" },
  { id: "rab", label: "RAB" },
  { id: "keuangan", label: "Laporan Keuangan" },
  { id: "laporan", label: "Laporan Kegiatan" },
];

export default function KegiatanWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [project, setProject] = useState(null);
  const [sub, setSub] = useState("kak");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get("/projects").then((r) => {
      const p = r.data.find((x) => x.id === id);
      if (p) setProject(p); else setNotFound(true);
    }).catch(() => setNotFound(true));
  }, [id]);

  const handleLogout = async () => { await logout(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-appbg text-gray-800 antialiased" data-testid="kegiatan-workspace">
      <Header user={user} onLogout={handleLogout} />
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <button data-testid="workspace-back" onClick={() => navigate("/")} className="flex items-center space-x-2 text-sm font-semibold text-gray-500 hover:text-emerald-700 transition">
          <ArrowLeft className="w-4 h-4" /><span>Kembali ke Dashboard</span>
        </button>

        {notFound && (
          <p className="text-sm text-gray-400 bg-white border border-gray-200 rounded-2xl p-8 text-center" data-testid="workspace-not-found">
            Kegiatan tidak ditemukan atau bukan milik akun Anda.
          </p>
        )}

        {project && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4" data-testid="workspace-header">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-heading font-extrabold text-lg border border-gray-100" style={{ backgroundColor: project.tint?.bg, color: project.tint?.fg }}>
                  {project.tint?.ini}
                </div>
                <div>
                  <div className="flex items-center space-x-2 flex-wrap">
                    <h1 className="font-heading text-xl font-extrabold text-gray-900" data-testid="workspace-project-name">{project.name}</h1>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_STYLE[project.status] || "bg-gray-100 text-gray-700"}`}>{project.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{project.nomor_indeks} • {project.loc} • {project.date}</p>
                </div>
              </div>
              <div className="text-left md:text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Plafon Anggaran</p>
                <p className="font-heading font-extrabold text-emerald-700">Rp {project.plafon} Jt</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-2 shadow-sm flex space-x-1 overflow-x-auto" data-testid="workspace-subtabs">
              {SUBTABS.map((t) => (
                <button
                  key={t.id}
                  data-testid={`subtab-${t.id}`}
                  onClick={() => setSub(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm transition whitespace-nowrap ${
                    sub === t.id ? "text-emerald-700 bg-emerald-50 font-semibold" : "text-gray-500 hover:text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={sub} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: "easeOut" }}>
                {sub === "kak" && <KakTab project={project} />}
                {sub === "rab" && <RabTab projectId={project.id} />}
                {sub === "keuangan" && <KeuanganTab project={project} />}
                {sub === "laporan" && <LaporanTab project={project} />}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </main>
    </div>
  );
}
