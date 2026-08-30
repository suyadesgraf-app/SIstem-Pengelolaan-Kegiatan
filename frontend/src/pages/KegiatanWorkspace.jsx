import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import IdeKegiatanTab from "@/components/tabs/IdeKegiatanTab";
import KakTab from "@/components/tabs/KakTab";
import RabTab from "@/components/tabs/RabTab";
import KeuanganTab from "@/components/tabs/KeuanganTab";
import LaporanTab from "@/components/tabs/LaporanTab";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_STYLE = {
  Selesai: "bg-emerald-100 text-emerald-800",
  Menunggu: "bg-amber-100 text-amber-800",
  Diverifikasi: "bg-blue-100 text-blue-800",
  Perencanaan: "bg-sky-100 text-sky-800",
};

const SUBTABS = [
  { id: "ide", label: "Buat Ide Kegiatan" },
  { id: "rab", label: "RAB" },
  { id: "kak", label: "KAK" },
  { id: "keuangan", label: "Laporan Keuangan" },
  { id: "laporan", label: "Laporan Kegiatan" },
];

export default function KegiatanWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [project, setProject] = useState(null);
  const [sub, setSub] = useState("ide");
  const [notFound, setNotFound] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canDeleteProject = user.role === "pic" || user.role === "superadmin";
  const showNomorIndeks = Boolean(
    project?.nomor_indeks && (project?.nomor_indeks_updated_at || project?.progress?.laporan > 0 || project?.status !== "Perencanaan")
  );

  useEffect(() => {
    api.get("/projects").then((r) => {
      const p = r.data.find((x) => x.id === id);
      if (p) setProject(p); else setNotFound(true);
    }).catch(() => setNotFound(true));
  }, [id]);

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const handleDeleteProject = async () => {
    if (!project || deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/projects/${project.id}`);
      toast.success("Kegiatan berhasil dihapus");
      navigate("/");
    } catch (e) {
      toast.error(formatApiError(e));
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

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
                  <p className="text-xs text-gray-500 mt-1" data-testid="workspace-project-meta">
                    {[showNomorIndeks ? project.nomor_indeks : "", project.loc, project.date].filter(Boolean).join(" • ")}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-left md:text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Plafon Anggaran</p>
                  <p className="font-heading font-extrabold text-emerald-700">Rp {project.plafon} Jt</p>
                </div>
                <button
                  data-testid="workspace-export-paket"
                  onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/projects/${project.id}/export/paket.pdf`)}
                  className="bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition whitespace-nowrap"
                >
                  Unduh Paket PDF
                </button>
                {canDeleteProject && (
                  <button
                    data-testid="workspace-delete-project-button"
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    title="Hapus kegiatan"
                    aria-label="Hapus kegiatan"
                    className="w-10 h-10 rounded-xl border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 active:scale-95 transition flex items-center justify-center disabled:opacity-60"
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
              <AlertDialogContent data-testid="delete-project-confirm-dialog">
                <AlertDialogHeader>
                  <AlertDialogTitle data-testid="delete-project-confirm-title">Hapus kegiatan ini?</AlertDialogTitle>
                  <AlertDialogDescription data-testid="delete-project-confirm-description">
                    Data ide kegiatan, RAB, KAK, laporan keuangan, laporan kegiatan, nota, dan lampiran terkait akan dihapus dari daftar aplikasi.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="delete-project-cancel-button" disabled={deleting}>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    data-testid="delete-project-confirm-button"
                    onClick={(event) => {
                      event.preventDefault();
                      handleDeleteProject();
                    }}
                    disabled={deleting}
                    className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                  >
                    {deleting ? "Menghapus..." : "Hapus"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

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
                {sub === "ide" && <IdeKegiatanTab project={project} />}
                {sub === "rab" && <RabTab projectId={project.id} />}
                {sub === "kak" && <KakTab project={project} />}
                {sub === "keuangan" && <KeuanganTab project={project} />}
                {sub === "laporan" && <LaporanTab project={project} onProjectUpdate={setProject} />}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </main>
    </div>
  );
}
