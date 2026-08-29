import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Camera, ScanLine, Pencil, Trash2, Signal, X } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { fileToResizedBase64 } from "@/lib/ocr";
import ModelPicker from "@/components/ModelPicker";

const rp = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

export default function RealisasiTab() {
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [image, setImage] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [provider, setProvider] = useState("gemini");
  const [form, setForm] = useState({ merchant: "", nominal: "", tanggal: "", kegiatan: "" });
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [notaView, setNotaView] = useState(null);
  const fileRef = useRef(null);

  const load = () => {
    api.get("/realisasi").then((r) => setItems(r.data)).catch(() => {});
    api.get("/projects").then((r) => setProjects(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToResizedBase64(file);
    setImage(dataUrl);
    toast.info("Foto nota siap dipindai AI");
  };

  const scan = async () => {
    if (!image) return toast.warning("Ambil/unggah foto nota terlebih dahulu");
    setScanning(true);
    try {
      const r = await api.post("/ai/ocr", { image_base64: image, provider });
      setForm((f) => ({
        ...f,
        merchant: r.data.merchant || "",
        nominal: r.data.nominal ? String(r.data.nominal) : "",
        tanggal: r.data.tanggal || "",
      }));
      toast.success("OCR Berhasil Membaca Nota");
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
        nota_image: image,
      });
      setForm({ merchant: "", nominal: "", tanggal: "", kegiatan: "" });
      setImage(null);
      load();
      toast.success("Realisasi nota berhasil disimpan & tersinkron");
    } catch (e2) { toast.error(formatApiError(e2)); }
  };

  const saveEdit = async () => {
    try {
      await api.put(`/realisasi/${editingId}`, {
        tanggal: draft.tanggal, merchant: draft.merchant,
        nominal: parseInt(draft.nominal) || 0, kegiatan: draft.kegiatan,
      });
      setEditingId(null);
      load();
      toast.success("Realisasi diperbarui");
    } catch (e2) { toast.error(formatApiError(e2)); }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus data realisasi ini?")) return;
    await api.delete(`/realisasi/${id}`).catch(() => {});
    load();
    toast.success("Data realisasi dihapus");
  };

  const viewNota = async (id) => {
    try {
      const r = await api.get(`/realisasi/${id}/nota`);
      setNotaView(r.data.image);
    } catch {
      toast.warning("Nota tidak tersedia untuk data ini");
    }
  };

  const editCls = "w-full border border-emerald-500 rounded px-1 py-1 text-xs bg-white";

  return (
    <div className="space-y-6" data-testid="realisasi-tab">
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <h2 className="font-heading text-lg font-bold text-gray-800 mb-1">Mobile OCR & Input Nota Lapangan</h2>
        <p className="text-sm text-gray-500 mb-6">Unggah foto nota — AI mengekstrak merchant, nominal, dan tanggal secara otomatis.</p>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* PHONE FRAME */}
          <div className="mx-auto lg:mx-0">
            <div className="relative border-gray-800 bg-gray-800 border-[12px] rounded-[2.5rem] h-[560px] w-[290px] shadow-xl overflow-hidden" data-testid="phone-frame">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-gray-800 rounded-b-2xl z-20" />
              <div className="bg-gray-50 h-full w-full overflow-y-auto scrollbar-hide">
                <div className="flex justify-between items-center px-5 pt-2 text-[10px] text-gray-700">
                  <span className="font-semibold">09:41</span>
                  <span className="flex items-center space-x-1 text-emerald-600 font-bold">
                    <Signal className="w-3 h-3" /><span>ONLINE</span>
                  </span>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-center text-[11px] font-bold text-gray-700">Arahkan kamera ke nota</p>
                  <div className="relative rounded-2xl overflow-hidden bg-gray-900 h-64 border-2 border-dashed border-emerald-400/60" data-testid="ocr-viewfinder">
                    {image ? (
                      <img src={image} alt="Nota" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 space-y-2">
                        <Camera className="w-8 h-8" />
                        <span className="text-[10px]">Belum ada foto nota</span>
                      </div>
                    )}
                    <div className="absolute inset-3 border border-emerald-400/50 rounded-xl pointer-events-none" />
                    {scanning && (
                      <motion.div
                        className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_16px_4px_rgba(52,211,153,0.7)]"
                        animate={{ top: ["4%", "92%", "4%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} data-testid="ocr-file-input" />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => fileRef.current?.click()} data-testid="ocr-capture-button"
                      className="bg-gray-800 text-white text-[11px] font-bold py-2.5 rounded-xl flex items-center justify-center space-x-1 active:scale-95 transition"
                    >
                      <Camera className="w-3.5 h-3.5" /><span>Ambil Foto</span>
                    </button>
                    <button
                      onClick={scan} disabled={scanning} data-testid="ocr-scan-button"
                      className="bg-emerald-700 text-white text-[11px] font-bold py-2.5 rounded-xl flex items-center justify-center space-x-1 active:scale-95 transition disabled:opacity-60"
                    >
                      <ScanLine className="w-3.5 h-3.5" /><span>{scanning ? "Memindai..." : "Pindai AI"}</span>
                    </button>
                  </div>
                  <ModelPicker value={provider} onChange={setProvider} kind="ocr" compact />

                  <AnimatePresence>
                    {(form.merchant || scanning) && (
                      <motion.div
                        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                        className="bg-white rounded-2xl border border-emerald-200 p-3.5 space-y-2 shadow-sm"
                        data-testid="ocr-result-panel"
                      >
                        <div className="flex justify-between items-center">
                          <p className="text-[11px] font-bold text-gray-800">Hasil Ekstraksi AI (OCR)</p>
                          {form.merchant && <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Terbaca</span>}
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Nama Merchant</label>
                          <input data-testid="ocr-merchant-input" value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} className="w-full text-[11px] border border-gray-200 rounded-lg p-2 bg-gray-50 outline-none focus:ring-1 focus:ring-emerald-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-gray-400 uppercase">Nominal (Rp)</label>
                            <input data-testid="ocr-nominal-input" value={form.nominal} onChange={(e) => setForm({ ...form, nominal: e.target.value })} className="w-full text-[11px] border border-gray-200 rounded-lg p-2 bg-gray-50 outline-none focus:ring-1 focus:ring-emerald-500" />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-gray-400 uppercase">Tanggal</label>
                            <input data-testid="ocr-tanggal-input" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} placeholder="DD/MM/YYYY" className="w-full text-[11px] border border-gray-200 rounded-lg p-2 bg-gray-50 outline-none focus:ring-1 focus:ring-emerald-500" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase">Kegiatan</label>
                          <select data-testid="ocr-kegiatan-select" value={form.kegiatan} onChange={(e) => setForm({ ...form, kegiatan: e.target.value })} className="w-full text-[11px] border border-gray-200 rounded-lg p-2 bg-gray-50 outline-none">
                            <option value="">Pilih kegiatan...</option>
                            {projects.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                          </select>
                        </div>
                        <button onClick={save} data-testid="ocr-save-button" className="w-full bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold py-2.5 rounded-xl transition active:scale-95">
                          Simpan & Sinkronisasi
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* REKAP TABLE */}
          <div className="flex-1 w-full">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-heading font-bold text-gray-800 text-sm">Rekapitulasi Data Realisasi (Hasil Scan)</h3>
              <span className="text-[10px] text-gray-400 font-semibold">Dapat diedit manual</span>
            </div>
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-xs text-left text-gray-700" data-testid="realisasi-table">
                <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                  <tr>
                    <th className="p-2 text-center w-8">No</th>
                    <th className="p-2">Tanggal</th>
                    <th className="p-2">Nama Barang/Jasa</th>
                    <th className="p-2 text-right">Nominal</th>
                    <th className="p-2">Kegiatan</th>
                    <th className="p-2">Dibuat Oleh</th>
                    <th className="p-2 text-center">Nota</th>
                    <th className="p-2 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {items.map((it, i) => (
                    <tr key={it.id} className="hover:bg-gray-50 transition" data-testid={`realisasi-row-${it.id}`}>
                      <td className="p-2 text-center text-gray-400">{i + 1}</td>
                      <td className="p-2 font-medium">
                        {editingId === it.id ? <input className={editCls} value={draft.tanggal} onChange={(e) => setDraft({ ...draft, tanggal: e.target.value })} /> : it.tanggal}
                      </td>
                      <td className="p-2">
                        {editingId === it.id ? <input className={editCls} value={draft.merchant} onChange={(e) => setDraft({ ...draft, merchant: e.target.value })} /> : it.merchant}
                      </td>
                      <td className="p-2 text-right font-bold">
                        {editingId === it.id ? <input type="number" className={`${editCls} text-right`} value={draft.nominal} onChange={(e) => setDraft({ ...draft, nominal: e.target.value })} /> : rp(it.nominal)}
                      </td>
                      <td className="p-2">
                        {editingId === it.id ? <input className={editCls} value={draft.kegiatan} onChange={(e) => setDraft({ ...draft, kegiatan: e.target.value })} /> : it.kegiatan}
                      </td>
                      <td className="p-2 text-gray-500">{it.uploader}</td>
                      <td className="p-2 text-center">
                        <button data-testid={`realisasi-nota-${it.id}`} onClick={() => viewNota(it.id)} className="text-blue-600 underline text-[11px]">Lihat Nota</button>
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        {editingId === it.id ? (
                          <button data-testid={`realisasi-save-${it.id}`} onClick={saveEdit} className="bg-emerald-600 text-white px-2 py-1 rounded text-[10px] font-bold">Simpan</button>
                        ) : (
                          <span className="inline-flex space-x-1">
                            <button data-testid={`realisasi-edit-${it.id}`} onClick={() => { setEditingId(it.id); setDraft({ ...it }); }} className="text-emerald-700 hover:text-emerald-900 p-1" title="Edit"><Pencil className="w-4 h-4" /></button>
                            <button data-testid={`realisasi-delete-${it.id}`} onClick={() => remove(it.id)} className="text-red-500 hover:text-red-700 p-1" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan="8" className="p-6 text-center text-gray-400" data-testid="realisasi-empty">Belum ada realisasi tercatat.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* NOTA MODAL */}
      <AnimatePresence>
        {notaView && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setNotaView(null)}
            data-testid="nota-modal"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-4 max-w-md w-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setNotaView(null)} data-testid="nota-modal-close" className="absolute top-3 right-3 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
              <p className="font-heading font-bold text-sm text-gray-800 mb-3">Foto Nota</p>
              <img src={notaView} alt="Nota" className="w-full rounded-xl border border-gray-200" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
