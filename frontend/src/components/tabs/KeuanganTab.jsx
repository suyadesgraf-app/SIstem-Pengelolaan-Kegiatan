import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Pencil, Trash2, X } from "lucide-react";
import api, { formatApiError } from "@/lib/api";

const rp = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

export default function KeuanganTab({ project }) {
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [notaView, setNotaView] = useState(null);

  const load = () => api.get(`/realisasi?project_id=${project.id}`).then((r) => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, [project.id]);

  const total = items.reduce((s, it) => s + (it.nominal || 0), 0);

  const saveEdit = async () => {
    try {
      await api.put(`/realisasi/${editingId}`, {
        tanggal: draft.tanggal, merchant: draft.merchant,
        nominal: parseInt(draft.nominal) || 0, kegiatan: draft.kegiatan,
        project_id: project.id,
      });
      setEditingId(null);
      load();
      toast.success("Realisasi diperbarui");
    } catch (e) { toast.error(formatApiError(e)); }
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
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm" data-testid="keuangan-tab">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-gray-800 mb-1">Laporan Keuangan — {project.name}</h2>
          <p className="text-sm text-gray-500">Semua nota yang diinput relawan untuk kegiatan ini masuk di sini dan bisa langsung Anda kelola.</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5" data-testid="keuangan-total">
          <p className="text-[9px] font-bold text-emerald-700 uppercase">Total Realisasi</p>
          <p className="font-heading font-extrabold text-emerald-800">{rp(total)}</p>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-xs text-left text-gray-700" data-testid="keuangan-table">
          <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
            <tr>
              <th className="p-2 text-center w-8">No</th>
              <th className="p-2">Tanggal</th>
              <th className="p-2">Nama Barang/Jasa</th>
              <th className="p-2 text-right">Nominal</th>
              <th className="p-2">Dibuat Oleh</th>
              <th className="p-2 text-center">Nota</th>
              <th className="p-2 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {items.map((it, i) => (
              <tr key={it.id} className="hover:bg-gray-50 transition" data-testid={`keuangan-row-${it.id}`}>
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
                <td className="p-2 text-gray-500">{it.uploader}</td>
                <td className="p-2 text-center">
                  <button data-testid={`keuangan-nota-${it.id}`} onClick={() => viewNota(it.id)} className="text-blue-600 underline text-[11px]">Lihat Nota</button>
                </td>
                <td className="p-2 text-center whitespace-nowrap">
                  {editingId === it.id ? (
                    <button data-testid={`keuangan-save-${it.id}`} onClick={saveEdit} className="bg-emerald-600 text-white px-2 py-1 rounded text-[10px] font-bold">Simpan</button>
                  ) : (
                    <span className="inline-flex space-x-1">
                      <button data-testid={`keuangan-edit-${it.id}`} onClick={() => { setEditingId(it.id); setDraft({ ...it }); }} className="text-emerald-700 hover:text-emerald-900 p-1" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button data-testid={`keuangan-delete-${it.id}`} onClick={() => remove(it.id)} className="text-red-500 hover:text-red-700 p-1" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan="7" className="p-6 text-center text-gray-400" data-testid="keuangan-empty">Belum ada laporan nota dari relawan untuk kegiatan ini.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {notaView && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setNotaView(null)}
            data-testid="keuangan-nota-modal"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-4 max-w-md w-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setNotaView(null)} data-testid="keuangan-nota-close" className="absolute top-3 right-3 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
              <p className="font-heading font-bold text-sm text-gray-800 mb-3">Foto Nota</p>
              <img src={notaView} alt="Nota" className="w-full rounded-xl border border-gray-200" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
