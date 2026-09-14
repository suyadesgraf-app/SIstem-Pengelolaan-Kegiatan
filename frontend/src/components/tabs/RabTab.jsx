import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Lightbulb, Loader2, Pencil, Sparkles, Trash2 } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import ModelPicker from "@/components/ModelPicker";

const KATEGORI_OPSI = ["Branding", "Perlengkapan", "Konsumsi", "Transportasi", "Honorarium", "Operasional", "Dokumentasi", "Akomodasi"];
const empty = { kategori: "Branding", kategoriManual: "", uraian: "", qty: "", satuanQty: "", frek: "", satuanFrek: "", harga: "" };
const rp = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

const SBM_RATES = [
  { label: "Makan VIP", aliases: ["makan vip", "konsumsi vip"], kategori: "Konsumsi", satuanQty: "Orang", satuanFrek: "Kali", harga: 85000 },
  { label: "Makan/Minum Kegiatan/Audensi", aliases: ["makan minum", "mamin", "jamuan", "audensi"], kategori: "Konsumsi", satuanQty: "Orang", satuanFrek: "Kali", harga: 85000 },
  { label: "Uang Makan Peserta", aliases: ["makan", "nasi", "konsumsi peserta", "uang makan"], kategori: "Konsumsi", satuanQty: "Orang", satuanFrek: "Kali", harga: 50000 },
  { label: "Kudapan VIP", aliases: ["snack vip", "kudapan vip"], kategori: "Konsumsi", satuanQty: "Orang", satuanFrek: "Kali", harga: 30000 },
  { label: "Kudapan Peserta", aliases: ["snack", "kudapan", "coffee break"], kategori: "Konsumsi", satuanQty: "Orang", satuanFrek: "Kali", harga: 20000 },
  { label: "Honor Narasumber Eksternal", aliases: ["narasumber", "pemateri", "honor", "honorarium"], kategori: "Honorarium", satuanQty: "Orang", satuanFrek: "Kegiatan", harga: 2500000 },
  { label: "MC/Doa/Moderator", aliases: ["mc", "moderator", "doa", "pembawa acara"], kategori: "Honorarium", satuanQty: "Orang", satuanFrek: "Kegiatan", harga: 500000 },
  { label: "Protokol/Ajudan/Humas", aliases: ["protokol", "ajudan", "humas"], kategori: "Operasional", satuanQty: "Orang", satuanFrek: "Kegiatan", harga: 200000 },
  { label: "ME/OB/Security", aliases: ["security", "keamanan", "ob", "me"], kategori: "Operasional", satuanQty: "Orang", satuanFrek: "Kegiatan", harga: 100000 },
  { label: "Sewa Kendaraan Pelaksanaan Kegiatan", aliases: ["sewa kendaraan", "rental mobil", "mobil kegiatan"], kategori: "Transportasi", satuanQty: "Unit", satuanFrek: "Hari", harga: 5000000 },
  { label: "Sewa Kendaraan Operasional Kantor/Lapangan", aliases: ["sewa kendaraan bulanan", "kendaraan operasional"], kategori: "Transportasi", satuanQty: "Unit", satuanFrek: "Bulan", harga: 8000000 },
  { label: "Hotel Rapat/Training Luar Kantor", aliases: ["hotel", "penginapan", "akomodasi"], kategori: "Akomodasi", satuanQty: "Orang", satuanFrek: "Hari", harga: 1500000 },
  { label: "Pakaian Dinas", aliases: ["pakaian", "seragam", "baju"], kategori: "Perlengkapan", satuanQty: "Setel", satuanFrek: "Kegiatan", harga: 1500000 },
];

const normalizeText = (value = "") => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const findSbmRate = (value = "") => {
  const text = normalizeText(value);
  if (!text) return null;
  return SBM_RATES.find((rate) => rate.aliases.some((alias) => text.includes(normalizeText(alias)))) || null;
};

export default function RabTab({ projectId = "" }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [idea, setIdea] = useState(null);
  const [provider, setProvider] = useState("openai");
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(() => api.get(`/rab?project_id=${projectId}`).then((r) => setItems(r.data)).catch(() => {}), [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!projectId) return;
    api.get(`/projects/${projectId}/idea`).then((r) => {
      if (r.data.status === "submitted") setIdea(r.data.draft || null);
    }).catch(() => {});
  }, [projectId]);

  const groups = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      if (!map.has(it.kategori)) map.set(it.kategori, []);
      map.get(it.kategori).push(it);
    });
    return [...map.entries()];
  }, [items]);

  const displayGroups = useMemo(() => {
    let rowNumber = 0;
    return groups.map(([kategori, rows]) => [
      kategori,
      rows.map((item) => ({ ...item, displayNumber: rowNumber += 1 })),
    ]);
  }, [groups]);

  const grandTotal = items.reduce((s, it) => s + it.qty * it.frek * it.harga, 0);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const sbmMatch = useMemo(() => findSbmRate(form.uraian), [form.uraian]);
  const hargaSatuan = Number(form.harga || 0);
  const exceedsSbm = Boolean(sbmMatch && hargaSatuan > sbmMatch.harga);

  const setUraian = (e) => {
    const value = e.target.value;
    const match = findSbmRate(value);
    setForm((prev) => ({
      ...prev,
      uraian: value,
      ...(match ? {
        kategori: match.kategori,
        kategoriManual: "",
        satuanQty: match.satuanQty,
        satuanFrek: match.satuanFrek,
        harga: String(match.harga),
      } : {}),
    }));
  };

  const useIdeaForRab = async () => {
    if (!idea) return toast.warning("Submit ide kegiatan terlebih dahulu");
    if (!window.confirm("Setujui Ai mengisi RAB otomatis dari draft ide kegiatan?")) return;
    setAiLoading(true);
    try {
      const response = await api.post(`/projects/${projectId}/ai/rab`, { provider });
      await load();
      toast.success(`${response.data.count} item RAB berhasil dibuat AI dari draft ide`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setAiLoading(false);
    }
  };

  const addItem = async () => {
    const kategori = form.kategori === "lainnya" ? form.kategoriManual.trim() : form.kategori;
    if (!kategori) return toast.warning("Kategori wajib diisi!");
    const qty = parseInt(form.qty) || 0;
    const harga = parseInt(form.harga) || 0;
    if (!form.uraian.trim() || qty === 0 || harga === 0) return toast.error("Lengkapi data RAB!");
    if (exceedsSbm) toast.warning(`${form.uraian} melebihi pagu ${sbmMatch.label}: maksimal ${rp(sbmMatch.harga)}`);
    try {
      await api.post("/rab/items", {
        kategori, uraian: form.uraian.trim(), qty,
        satuanQty: form.satuanQty || "Pcs", frek: parseInt(form.frek) || 1,
        satuanFrek: form.satuanFrek || "Kali", harga, project_id: projectId,
      });
      setForm(empty);
      load();
      toast.success("Item berhasil ditambahkan");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const startEdit = (it) => { setEditingId(it.id); setDraft({ ...it }); };
  const saveEdit = async () => {
    try {
      await api.put(`/rab/items/${editingId}`, {
        kategori: draft.kategori, uraian: draft.uraian,
        qty: parseInt(draft.qty) || 0, satuanQty: draft.satuanQty,
        frek: parseInt(draft.frek) || 0, satuanFrek: draft.satuanFrek,
        harga: parseInt(draft.harga) || 0,
      });
      setEditingId(null);
      load();
      toast.success("Item RAB berhasil diperbarui");
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus item anggaran ini?")) return;
    await api.delete(`/rab/items/${id}`).catch(() => {});
    load();
    toast.success("Item berhasil dihapus");
  };

  const inputCls = "w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-emerald-500";
  const editCls = "w-full border border-emerald-500 rounded px-1 py-1 text-xs bg-white";

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm" data-testid="rab-tab">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-gray-800 mb-1">Rencana Anggaran Biaya (RAB)</h2>
          <p className="text-sm text-gray-500">Input rincian pos anggaran kegiatan berdasarkan format standar dokumen BAZNAS.</p>
        </div>
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <span className="text-xs font-bold text-gray-500">Ekspor:</span>
          <button data-testid="rab-export-pdf" onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/projects/${projectId}/export/rab.pdf`)} className="text-xs border border-gray-300 text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg font-semibold transition">PDF</button>
          <button data-testid="rab-export-excel" onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/projects/${projectId}/export/rab.xlsx`)} className="text-xs border border-gray-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-semibold transition">Excel</button>
          <button data-testid="rab-export-spreadsheet" onClick={() => { window.open(`${process.env.REACT_APP_BACKEND_URL}/api/projects/${projectId}/export/rab.xlsx`); toast.info("File Excel kompatibel dengan Google Sheets / Spreadsheet"); }} className="text-xs border border-gray-300 text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-semibold transition">Spreadsheet</button>
        </div>
      </div>

      {idea && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3" data-testid="rab-idea-source-panel">
          <div>
            <p className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> Bahan dari Draft Ide</p>
            <p className="text-xs text-emerald-700 mt-1" data-testid="rab-idea-source-notes">{idea.rab_notes || idea.budget_outline || "Draft ide siap dijadikan dasar pos anggaran."}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div data-testid="rab-ai-model-picker-wrap"><ModelPicker value={provider} onChange={setProvider} kind="doc" compact /></div>
            <button data-testid="rab-use-idea-button" onClick={useIdeaForRab} disabled={aiLoading} className="text-xs bg-emerald-700 text-white hover:bg-emerald-800 active:scale-95 px-4 py-2 rounded-lg font-bold transition whitespace-nowrap inline-flex items-center gap-1.5 disabled:opacity-60">
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{aiLoading ? "AI mengisi RAB..." : "Pakai untuk Form RAB"}</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-3">
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Kategori Pos</label>
            <select data-testid="rab-kategori-select" value={form.kategori} onChange={set("kategori")} className={inputCls}>
              {KATEGORI_OPSI.map((k) => <option key={k} value={k}>{k}</option>)}
              <option value="lainnya" className="font-bold text-emerald-700">+ Lainnya (Input Manual)...</option>
            </select>
            {form.kategori === "lainnya" && (
              <input data-testid="rab-kategori-manual" value={form.kategoriManual} onChange={set("kategoriManual")} placeholder="Ketik kategori..." className={`${inputCls} mt-2`} />
            )}
          </div>
          <div className="md:col-span-9">
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Uraian / Nama Barang</label>
            <input data-testid="rab-uraian-input" value={form.uraian} onChange={setUraian} placeholder="Contoh: Makan peserta / Snack / Honor narasumber" className={inputCls} />
            {sbmMatch && (
              <p data-testid="rab-sbm-suggestion" className="mt-1.5 text-[10px] font-semibold text-emerald-700">
                Acuan SBM: {sbmMatch.label} maksimal {rp(sbmMatch.harga)} / {sbmMatch.satuanQty}/{sbmMatch.satuanFrek}
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Qty</label>
            <input data-testid="rab-qty-input" type="number" value={form.qty} onChange={set("qty")} placeholder="0" className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Satuan Qty</label>
            <input data-testid="rab-satuan-qty-input" value={form.satuanQty} onChange={set("satuanQty")} placeholder="Pcs / Set" className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Frekuensi</label>
            <input data-testid="rab-frek-input" type="number" value={form.frek} onChange={set("frek")} placeholder="0" className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Satuan Frek</label>
            <input data-testid="rab-satuan-frek-input" value={form.satuanFrek} onChange={set("satuanFrek")} placeholder="Kali" className={inputCls} />
          </div>
          <div className="md:col-span-4 flex items-end space-x-2">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Harga Satuan (Rp)</label>
              <input data-testid="rab-harga-input" type="number" value={form.harga} onChange={set("harga")} placeholder="100000" className={inputCls} />
              {exceedsSbm && (
                <p data-testid="rab-sbm-warning" className="mt-1.5 text-[10px] font-bold text-red-600">
                  Melebihi pagu SBM: maks {rp(sbmMatch.harga)}
                </p>
              )}
            </div>
            <button data-testid="rab-add-button" onClick={addItem} className="bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold py-2.5 px-5 rounded-lg text-xs transition shadow-sm h-[38px] whitespace-nowrap">+ Tambah</button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-300 rounded-lg">
        <table className="w-full text-xs text-left text-gray-800 border-collapse" data-testid="rab-table">
          <thead className="bg-emerald-700 text-white font-bold">
            <tr>
              <th className="p-2 border border-gray-300 text-center w-10">No</th>
              <th className="p-2 border border-gray-300">Uraian</th>
              <th className="p-2 border border-gray-300 text-center" colSpan="2">Qty</th>
              <th className="p-2 border border-gray-300 text-center" colSpan="2">Frek</th>
              <th className="p-2 border border-gray-300 text-right w-32">Harga Satuan</th>
              <th className="p-2 border border-gray-300 text-right w-36">Jumlah</th>
              <th className="p-2 border border-gray-300 text-center w-20">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {displayGroups.map(([kategori, rows]) => (
              <Fragment key={kategori}>
                <tr className="bg-emerald-50 font-bold border-b border-gray-200">
                  <td className="p-2 border border-gray-300" />
                  <td className="p-2 border border-gray-300 text-emerald-800" colSpan="8">{kategori}</td>
                </tr>
                {rows.map((it) => {
                  const jumlah = it.qty * it.frek * it.harga;
                  const editing = editingId === it.id;
                  return (
                    <tr key={it.id} className="hover:bg-gray-50 transition border-b border-gray-200" data-testid={`rab-row-${it.id}`}>
                      <td className="p-2 border-r border-gray-300 text-center text-gray-500" data-testid={`rab-row-number-${it.id}`}>{it.displayNumber}</td>
                      <td className="p-2 border-r border-gray-300 font-medium">
                        {editing ? <input className={editCls} value={draft.uraian} onChange={(e) => setDraft({ ...draft, uraian: e.target.value })} /> : it.uraian}
                      </td>
                      <td className="p-2 border-r border-gray-300 text-center">
                        {editing ? <input type="number" className={`${editCls} text-center`} value={draft.qty} onChange={(e) => setDraft({ ...draft, qty: e.target.value })} /> : it.qty}
                      </td>
                      <td className="p-2 border-r border-gray-300 text-center text-gray-500 text-[10px]">
                        {editing ? <input className={`${editCls} text-center`} value={draft.satuanQty} onChange={(e) => setDraft({ ...draft, satuanQty: e.target.value })} /> : it.satuanQty}
                      </td>
                      <td className="p-2 border-r border-gray-300 text-center">
                        {editing ? <input type="number" className={`${editCls} text-center`} value={draft.frek} onChange={(e) => setDraft({ ...draft, frek: e.target.value })} /> : it.frek}
                      </td>
                      <td className="p-2 border-r border-gray-300 text-center text-gray-500 text-[10px]">
                        {editing ? <input className={`${editCls} text-center`} value={draft.satuanFrek} onChange={(e) => setDraft({ ...draft, satuanFrek: e.target.value })} /> : it.satuanFrek}
                      </td>
                      <td className="p-2 border-r border-gray-300 text-right">
                        {editing ? <input type="number" className={`${editCls} text-right`} value={draft.harga} onChange={(e) => setDraft({ ...draft, harga: e.target.value })} /> : rp(it.harga)}
                      </td>
                      <td className="p-2 border-r border-gray-300 text-right font-bold text-gray-800">{rp(jumlah)}</td>
                      <td className="p-2 text-center whitespace-nowrap">
                        {editing ? (
                          <button data-testid={`rab-save-${it.id}`} onClick={saveEdit} className="bg-emerald-600 text-white px-2 py-1 rounded text-[10px] font-bold">Simpan</button>
                        ) : (
                          <span className="space-x-1 inline-flex">
                            <button data-testid={`rab-edit-${it.id}`} onClick={() => startEdit(it)} className="text-emerald-600 hover:text-emerald-800 p-1" title="Edit"><Pencil className="w-4 h-4" /></button>
                            <button data-testid={`rab-delete-${it.id}`} onClick={() => remove(it.id)} className="text-red-500 hover:text-red-700 p-1" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            {items.length === 0 && (
              <tr><td colSpan="9" className="p-6 text-center text-gray-400" data-testid="rab-empty">Belum ada item RAB.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-emerald-700 text-white font-bold text-sm tracking-wide">
              <td colSpan="7" className="p-3 border border-gray-300 text-center uppercase">Jumlah Total</td>
              <td className="p-3 border border-gray-300 text-right" colSpan="2" data-testid="rab-total">{rp(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
