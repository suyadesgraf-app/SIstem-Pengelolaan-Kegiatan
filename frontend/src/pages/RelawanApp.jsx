import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Camera, ScanLine, Home, History, LogOut, Wallet, ReceiptText, Signal, Bell } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { fileToResizedBase64 } from "@/lib/ocr";
import ModelPicker from "@/components/ModelPicker";
import { useAuth } from "@/context/AuthContext";

const rp = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

export default function RelawanApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState("home");
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [image, setImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [provider, setProvider] = useState("openai");
  const [form, setForm] = useState({ merchant: "", nominal: "", tanggal: "", kegiatan: "", projectId: "" });
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const fileRef = useRef(null);

  const loadNotifs = useCallback(() => api.get("/notifications").then((r) => setNotifs(r.data)).catch(() => {}), []);
  const unread = notifs.filter((n) => !n.read).length;

  const load = useCallback(() => {
    api.get("/realisasi?mine=true").then((r) => setItems(r.data)).catch(() => {});
    api.get("/projects").then((r) => setProjects(r.data)).catch(() => {});
    loadNotifs();
  }, [loadNotifs]);
  useEffect(() => { load(); }, [load]);

  const totalNominal = items.reduce((s, it) => s + (it.nominal || 0), 0);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(await fileToResizedBase64(file));
    toast.info("Foto nota siap dipindai AI");
  };

  const scan = async () => {
    if (!image) return toast.warning("Ambil foto nota terlebih dahulu");
    setScanning(true);
    try {
      const r = await api.post("/ai/ocr", { image_base64: image, provider });
      setForm({
        merchant: r.data.merchant || "",
        nominal: r.data.nominal ? String(r.data.nominal) : "",
        tanggal: r.data.tanggal || "",
        kegiatan: form.kegiatan,
        projectId: form.projectId,
      });
      toast.success("AI berhasil membaca nota");
    } catch (e2) {
      toast.error(formatApiError(e2));
    } finally {
      setScanning(false);
    }
  };

  const save = async () => {
    if (!form.merchant.trim()) return toast.warning("Data merchant wajib diisi");
    try {
      await api.post("/realisasi", {
        tanggal: form.tanggal || new Date().toLocaleDateString("id-ID"),
        merchant: form.merchant.trim(),
        nominal: parseInt(String(form.nominal).replace(/[^0-9]/g, "")) || 0,
        kegiatan: form.kegiatan || projects[0]?.name || "Umum",
        project_id: form.projectId || null,
        nota_image: image,
      });
      toast.success("Laporan nota tersimpan & tersinkron");
      setImage(null);
      setForm({ merchant: "", nominal: "", tanggal: "", kegiatan: "", projectId: "" });
      load();
      setView("riwayat");
    } catch (e2) { toast.error(formatApiError(e2)); }
  };

  const handleLogout = async () => { await logout(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-emerald-950 sm:py-8" data-testid="relawan-app">
      <div className="max-w-md mx-auto bg-gray-50 min-h-screen sm:min-h-[820px] sm:rounded-[2rem] sm:shadow-2xl sm:border sm:border-emerald-900/40 overflow-hidden relative flex flex-col">
        {/* HEADER */}
        <div className="bg-emerald-800 text-white px-5 pt-5 pb-6 rounded-b-3xl">
          <div className="flex justify-between items-center text-[10px] text-emerald-200 mb-4">
            <span className="font-semibold">09:41</span>
            <span className="flex items-center space-x-3 font-bold">
              <button data-testid="relawan-notif-bell" onClick={() => setShowNotifs(true)} className="relative p-1 hover:text-white transition">
                <Bell className="w-4 h-4" />
                {unread > 0 && (
                  <span data-testid="relawan-notif-badge" className="absolute -top-1.5 -right-1.5 bg-amber-400 text-emerald-950 text-[8px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">{unread}</span>
                )}
              </button>
              <span className="flex items-center space-x-1"><Signal className="w-3 h-3" /><span>ONLINE</span></span>
            </span>
          </div>
          <p className="text-emerald-200 text-xs">Assalamu'alaikum,</p>
          <h1 className="font-heading font-extrabold text-xl tracking-tight" data-testid="relawan-user-name">{user.name}</h1>
          <span className="inline-block mt-1.5 text-[10px] font-bold bg-emerald-700/70 border border-emerald-600 px-2.5 py-1 rounded-full">Relawan Lapangan</span>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="bg-emerald-700/60 border border-emerald-600/60 rounded-2xl p-3" data-testid="relawan-stat-count">
              <p className="text-[9px] font-bold text-emerald-200 uppercase">Laporan Saya</p>
              <p className="font-heading font-extrabold text-lg">{items.length} Nota</p>
            </div>
            <div className="bg-emerald-700/60 border border-emerald-600/60 rounded-2xl p-3" data-testid="relawan-stat-total">
              <p className="text-[9px] font-bold text-emerald-200 uppercase">Total Nominal</p>
              <p className="font-heading font-extrabold text-lg">{rp(totalNominal)}</p>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-5 pb-28">
          <AnimatePresence mode="wait">
            {view === "home" && (
              <motion.div key="home" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                <button
                  onClick={() => setView("scan")} data-testid="relawan-scan-cta"
                  className="w-full bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white rounded-3xl p-6 text-left transition shadow-lg shadow-emerald-900/20"
                >
                  <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center mb-3">
                    <ScanLine className="w-6 h-6" />
                  </div>
                  <p className="font-heading font-extrabold text-lg">Scan Nota Baru</p>
                  <p className="text-emerald-100/80 text-xs mt-1">Foto nota, AI membaca isinya otomatis, laporan langsung tersinkron.</p>
                </button>
                <div>
                  <p className="font-heading font-bold text-sm text-gray-800 mb-3">Kegiatan untuk Anda</p>
                  <div className="space-y-2.5" data-testid="relawan-project-list">
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        data-testid={`relawan-project-${p.id}`}
                        onClick={() => { setForm({ ...form, projectId: p.id, kegiatan: p.name }); setView("scan"); }}
                        className="w-full bg-white rounded-2xl border border-gray-200 p-3.5 flex items-center justify-between text-left hover:border-emerald-400 active:scale-[0.98] transition"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-heading font-extrabold text-xs" style={{ backgroundColor: p.tint?.bg, color: p.tint?.fg }}>
                            {p.tint?.ini || p.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-800">{p.name}</p>
                            <p className="text-[10px] text-gray-400">{p.loc} • {p.date}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full whitespace-nowrap">Input Nota</span>
                      </button>
                    ))}
                    {projects.length === 0 && <p className="text-xs text-gray-400 text-center py-4" data-testid="relawan-project-empty">Belum ada kegiatan dari PIC Anda.</p>}
                  </div>
                </div>
                <div>
                  <p className="font-heading font-bold text-sm text-gray-800 mb-3">Terakhir Dilaporkan</p>
                  <div className="space-y-2.5">
                    {items.slice(0, 3).map((it) => (
                      <div key={it.id} className="bg-white rounded-2xl border border-gray-200 p-3.5 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center"><ReceiptText className="w-4 h-4" /></div>
                          <div>
                            <p className="text-xs font-bold text-gray-800">{it.merchant}</p>
                            <p className="text-[10px] text-gray-400">{it.tanggal} • {it.kegiatan}</p>
                          </div>
                        </div>
                        <p className="text-xs font-heading font-bold text-emerald-700">{rp(it.nominal)}</p>
                      </div>
                    ))}
                    {items.length === 0 && <p className="text-xs text-gray-400 text-center py-6" data-testid="relawan-empty-home">Belum ada laporan. Mulai scan nota pertama Anda.</p>}
                  </div>
                </div>
              </motion.div>
            )}

            {view === "scan" && (
              <motion.div key="scan" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-heading font-bold text-sm text-gray-800">Scan Nota Keuangan</p>
                  {form.kegiatan && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full truncate" data-testid="relawan-scan-kegiatan-chip">{form.kegiatan}</span>}
                </div>
                <div className="relative rounded-3xl overflow-hidden bg-gray-900 h-72 border-2 border-dashed border-emerald-400/60" data-testid="relawan-viewfinder">
                  {image ? (
                    <img src={image} alt="Nota" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 space-y-2">
                      <Camera className="w-10 h-10" />
                      <span className="text-xs">Arahkan kamera ke nota</span>
                    </div>
                  )}
                  <div className="absolute inset-4 border border-emerald-400/50 rounded-2xl pointer-events-none" />
                  {scanning && (
                    <motion.div
                      className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_16px_4px_rgba(52,211,153,0.7)]"
                      animate={{ top: ["4%", "92%", "4%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} data-testid="relawan-file-input" />
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => fileRef.current?.click()} data-testid="relawan-capture-button" className="bg-gray-800 text-white text-xs font-bold py-3 rounded-2xl flex items-center justify-center space-x-1.5 active:scale-95 transition">
                    <Camera className="w-4 h-4" /><span>Ambil Foto</span>
                  </button>
                  <button onClick={scan} disabled={scanning} data-testid="relawan-scan-button" className="bg-emerald-700 text-white text-xs font-bold py-3 rounded-2xl flex items-center justify-center space-x-1.5 active:scale-95 transition disabled:opacity-60">
                    <ScanLine className="w-4 h-4" /><span>{scanning ? "Memindai..." : "Pindai AI"}</span>
                  </button>
                </div>
                <ModelPicker value={provider} onChange={setProvider} kind="ocr" compact />
                <AnimatePresence>
                  {(form.merchant || scanning) && (
                    <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white rounded-2xl border border-emerald-200 p-4 space-y-3 shadow-sm" data-testid="relawan-ocr-result">
                      <p className="text-xs font-bold text-gray-800">Hasil Ekstraksi AI</p>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Nama Merchant</label>
                        <input data-testid="relawan-merchant-input" value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} className="w-full text-xs border border-gray-200 rounded-xl p-2.5 bg-gray-50 outline-none focus:ring-1 focus:ring-emerald-500" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Nominal (Rp)</label>
                          <input data-testid="relawan-nominal-input" value={form.nominal} onChange={(e) => setForm({ ...form, nominal: e.target.value })} className="w-full text-xs border border-gray-200 rounded-xl p-2.5 bg-gray-50 outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Tanggal</label>
                          <input data-testid="relawan-tanggal-input" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} placeholder="DD/MM/YYYY" className="w-full text-xs border border-gray-200 rounded-xl p-2.5 bg-gray-50 outline-none" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Kegiatan</label>
                        <select data-testid="relawan-kegiatan-select" value={form.projectId} onChange={(e) => { const p = projects.find((x) => x.id === e.target.value); setForm({ ...form, projectId: e.target.value, kegiatan: p?.name || "" }); }} className="w-full text-xs border border-gray-200 rounded-xl p-2.5 bg-gray-50 outline-none">
                          <option value="">Pilih kegiatan...</option>
                          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <button onClick={save} data-testid="relawan-save-button" className="w-full bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold py-3 rounded-2xl transition active:scale-95">
                        Simpan & Sinkronisasi
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {view === "riwayat" && (
              <motion.div key="riwayat" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2.5">
                <p className="font-heading font-bold text-sm text-gray-800 mb-1">Riwayat Laporan Nota</p>
                {items.map((it) => (
                  <div key={it.id} className="bg-white rounded-2xl border border-gray-200 p-3.5 flex items-center justify-between" data-testid={`relawan-item-${it.id}`}>
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center"><Wallet className="w-4 h-4" /></div>
                      <div>
                        <p className="text-xs font-bold text-gray-800">{it.merchant}</p>
                        <p className="text-[10px] text-gray-400">{it.tanggal} • {it.kegiatan}</p>
                      </div>
                    </div>
                    <p className="text-xs font-heading font-bold text-emerald-700">{rp(it.nominal)}</p>
                  </div>
                ))}
                {items.length === 0 && <p className="text-xs text-gray-400 text-center py-8" data-testid="relawan-empty-riwayat">Belum ada riwayat laporan.</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* NOTIFICATION PANEL */}
        <AnimatePresence>
          {showNotifs && (
            <motion.div
              className="absolute inset-0 z-30 bg-black/40"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowNotifs(false)}
              data-testid="relawan-notif-overlay"
            >
              <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 26, stiffness: 300 }}
                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-5 max-h-[70%] overflow-y-auto scrollbar-hide"
                onClick={(e) => e.stopPropagation()}
                data-testid="relawan-notif-panel"
              >
                <div className="flex justify-between items-center mb-4">
                  <p className="font-heading font-bold text-sm text-gray-800">Notifikasi</p>
                  <button
                    data-testid="relawan-notif-read-all"
                    onClick={async () => { await api.post("/notifications/read-all").catch(() => {}); loadNotifs(); }}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900"
                  >
                    Tandai semua dibaca
                  </button>
                </div>
                <div className="space-y-2.5 pb-6">
                  {notifs.map((n) => (
                    <div
                      key={n.id}
                      data-testid={`relawan-notif-${n.id}`}
                      className={`rounded-2xl border p-3.5 text-xs leading-relaxed ${n.read ? "border-gray-200 bg-gray-50 text-gray-500" : "border-emerald-200 bg-emerald-50 text-gray-800 font-medium"}`}
                    >
                      <p>{n.message}</p>
                      <p className="text-[9px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString("id-ID")}</p>
                    </div>
                  ))}
                  {notifs.length === 0 && <p className="text-xs text-gray-400 text-center py-6" data-testid="relawan-notif-empty">Belum ada notifikasi.</p>}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BOTTOM NAV */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center" data-testid="relawan-bottom-nav">
          {[
            { id: "home", icon: Home, label: "Beranda" },
            { id: "scan", icon: ScanLine, label: "Scan" },
            { id: "riwayat", icon: History, label: "Riwayat" },
          ].map((n) => (
            <button
              key={n.id}
              data-testid={`relawan-nav-${n.id}`}
              onClick={() => setView(n.id)}
              className={`flex flex-col items-center space-y-1 px-3 py-1 rounded-xl transition ${view === n.id ? "text-emerald-700" : "text-gray-400 hover:text-gray-600"}`}
            >
              <n.icon className="w-5 h-5" />
              <span className="text-[9px] font-bold">{n.label}</span>
            </button>
          ))}
          <button data-testid="relawan-nav-logout" onClick={handleLogout} className="flex flex-col items-center space-y-1 px-3 py-1 rounded-xl text-gray-400 hover:text-red-600 transition">
            <LogOut className="w-5 h-5" />
            <span className="text-[9px] font-bold">Keluar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
