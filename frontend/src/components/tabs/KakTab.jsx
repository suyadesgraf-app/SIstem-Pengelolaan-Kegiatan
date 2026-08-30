import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Loader2, Printer, Save, Sparkles } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import ModelPicker from "@/components/ModelPicker";
import { draftToKakText } from "@/components/tabs/IdeKegiatanTab";

const SIGNERS = [
  { label: "Dibuat oleh;", name: "Saiful Rahman", role: "Staff Kebencanaan" },
  { label: "Diajukan oleh;", name: "Lina Yunita", role: "Kasie Pendistribusian" },
  { label: "Disetujui oleh;", name: "Muhammad Nurminto", role: "Kepala Bidang II" },
  { label: "Disetujui oleh;", name: "Muhamad Bahaudin", role: "Pimpinan Bidang II" },
];

const KAK_COMPONENTS = [
  "Pendahuluan",
  "Deskripsi Program",
  "Landasan Hukum",
  "Tujuan Program",
  "Sasaran & Target",
  "Tempat & Waktu Pelaksanaan",
  "Indikator Keberhasilan",
  "Pelaksana & Penanggung Jawab",
  "Mekanisme Pelaksanaan",
  "Jadwal Kegiatan",
  "Penutup",
];

const normalizeHeading = (value = "") => value.replace(/^\s*\d+[.)-]?\s*/, "").trim().toLowerCase();
const rp = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

export default function KakTab({ project = null }) {
  const [raw, setRaw] = useState("");
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState("gemini");
  const [history, setHistory] = useState([]);
  const [idea, setIdea] = useState(null);
  const [rabItems, setRabItems] = useState([]);
  const [savingManual, setSavingManual] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [manualRows, setManualRows] = useState({});
  const [manualTitle, setManualTitle] = useState("");
  const manualRowsRef = useRef({});
  const manualTitleRef = useRef("");
  const previewRef = useRef(null);

  const handlePreviewWheel = (event) => {
    const panel = previewRef.current;
    if (!panel || panel.scrollHeight <= panel.clientHeight) return;
    event.preventDefault();
    event.stopPropagation();
    panel.scrollTop += event.deltaY;
  };

  useEffect(() => {
    if (!project?.id) return;
    setLoadingHistory(true);
    api.get(`/projects/${project.id}/kaks`).then((r) => {
      setHistory(r.data);
      if (r.data[0]) setDoc({ id: r.data[0].id, title: r.data[0].title, sections: r.data[0].sections });
    }).catch(() => {}).finally(() => setLoadingHistory(false));
    api.get(`/projects/${project.id}/idea`).then((r) => {
      if (r.data.status === "submitted") setIdea(r.data.draft || null);
    }).catch(() => {});
    api.get(`/rab?project_id=${project.id}`).then((r) => setRabItems(r.data)).catch(() => {});
  }, [project?.id]);

  useEffect(() => {
    const sections = doc?.sections || [];
    const rows = {};
    KAK_COMPONENTS.forEach((component, index) => {
      const normalized = normalizeHeading(component).replace("dan", "&");
      const matched = sections.find((section) => normalizeHeading(section.heading).replace("dan", "&").includes(normalized));
      rows[component] = matched?.body || sections[index]?.body || "";
    });
    setManualRows(rows);
    manualRowsRef.current = rows;
    setManualTitle(doc?.title || "");
    manualTitleRef.current = doc?.title || "";
  }, [doc?.id, doc?.sections, doc?.title, project?.id]);

  const officialRows = useMemo(() => {
    const sections = doc?.sections || [];
    return KAK_COMPONENTS.map((component, index) => {
      const normalized = normalizeHeading(component).replace("dan", "&");
      const matched = sections.find((section) => normalizeHeading(section.heading).replace("dan", "&").includes(normalized));
      return {
        no: index + 1,
        component,
        explanation: manualRows[component] ?? matched?.body ?? sections[index]?.body ?? "",
      };
    });
  }, [doc, manualRows]);

  const rabTotal = useMemo(
    () => rabItems.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.frek) || 0) * (Number(item.harga) || 0), 0),
    [rabItems]
  );

  const loadIdeaToRaw = () => {
    const text = draftToKakText(idea);
    if (!text) return toast.warning("Draft ide belum memiliki bahan KAK");
    setRaw(text);
    toast.success("Draft ide dimuat sebagai bahan KAK");
  };

  const generate = async () => {
    if (!raw.trim()) return toast.warning("Masukkan poin mentah kegiatan terlebih dahulu");
    if (!window.confirm("Setujui proses generate KAK berbasis Ai sekarang?")) return;
    setLoading(true);
    try {
      const r = await api.post("/ai/kak", { raw_text: raw, provider, project_id: project?.id });
      setDoc(r.data);
      if (project?.id) api.get(`/projects/${project.id}/kaks`).then((res) => setHistory(res.data)).catch(() => {});
      toast.success(`KAK berhasil dibuat AI (${provider === "gemini" ? "Gemini 3.1 Pro" : "GPT-5.4"})!`);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const buildSectionsFromRows = () => KAK_COMPONENTS.map((component, index) => ({
    heading: `${index + 1}. ${component}`,
    body: manualRowsRef.current[component] ?? "",
  }));

  const updateManualRow = (index, value) => {
    const component = KAK_COMPONENTS[index];
    manualRowsRef.current = { ...manualRowsRef.current, [component]: value };
    setManualRows(manualRowsRef.current);
  };

  const updateManualTitle = (value) => {
    manualTitleRef.current = value;
    setManualTitle(value);
  };

  const saveManualKak = async () => {
    if (!project?.id) return toast.warning("Kegiatan belum tersedia");
    if (loadingHistory) return toast.warning("Tunggu data KAK selesai dimuat");
    const liveRows = { ...manualRowsRef.current };
    previewRef.current?.querySelectorAll("textarea[data-kak-component-index]").forEach((element) => {
      const component = KAK_COMPONENTS[Number(element.dataset.kakComponentIndex)];
      if (component) liveRows[component] = element.value;
    });
    const liveTitle = previewRef.current?.querySelector('[data-testid="kak-doc-subtitle-input"]')?.value ?? manualTitleRef.current;
    manualRowsRef.current = liveRows;
    manualTitleRef.current = liveTitle;
    const payload = {
      title: liveTitle || project?.name || "",
      sections: KAK_COMPONENTS.map((component, index) => ({
        heading: `${index + 1}. ${component}`,
        body: liveRows[component] ?? "",
      })),
    };
    setSavingManual(true);
    try {
      const response = doc?.id
        ? await api.put(`/projects/${project.id}/kaks/${doc.id}`, payload)
        : await api.post(`/projects/${project.id}/kaks/manual`, payload);
      setDoc({ id: response.data.id, title: response.data.title, sections: response.data.sections });
      const historyResponse = await api.get(`/projects/${project.id}/kaks`);
      setHistory(historyResponse.data);
      toast.success("Edit manual KAK tersimpan");
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSavingManual(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-8" data-testid="kak-tab">
      <div className="flex-1 space-y-4 no-print">
        <h2 className="font-heading text-lg font-bold text-gray-800">AI Perencanaan (Kerangka Acuan Kegiatan / KAK)</h2>
        <p className="text-sm text-gray-500">Masukkan poin mentah kegiatan, AI akan merangkai dokumen KAK lengkap sesuai format resmi BAZNAS DKI.</p>
        {idea && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 flex items-center justify-between gap-3 flex-wrap" data-testid="kak-idea-source-panel">
            <div>
              <p className="text-[10px] font-bold text-emerald-800 uppercase">Bahan dari Draft Ide</p>
              <p className="text-xs text-emerald-700 font-semibold" data-testid="kak-idea-source-title">{idea.title || "Ide kegiatan siap digunakan"}</p>
            </div>
            <button data-testid="kak-load-idea-button" onClick={loadIdeaToRaw} className="text-xs bg-emerald-700 text-white hover:bg-emerald-800 px-3 py-2 rounded-lg font-bold transition flex items-center gap-1.5">
              <ClipboardCheck className="w-3.5 h-3.5" /><span>Muat Draft Ide</span>
            </button>
          </div>
        )}
        <textarea
          rows="6" value={raw} onChange={(e) => setRaw(e.target.value)}
          data-testid="kak-raw-input"
          className="w-full text-sm border border-gray-300 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none transition"
          placeholder="Contoh: Program Respon Bencana Gempa Bumi di NTT, target 19.000 penerima manfaat, anggaran 856 juta..."
        />
        <ModelPicker value={provider} onChange={setProvider} kind="doc" />
        <button
          onClick={generate} disabled={loading} data-testid="kak-generate-button"
          className="w-full bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white font-heading font-bold py-3 rounded-xl text-sm transition shadow-sm flex items-center justify-center space-x-2 disabled:opacity-60"
        >
          <Sparkles className="w-4 h-4" />
          <span>{loading ? "AI sedang menyusun dokumen..." : "Generate KAK dengan AI"}</span>
        </button>
        {history.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center" data-testid="kak-history">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Riwayat:</span>
            {history.map((h, i) => (
              <button
                key={h.id}
                data-testid={`kak-history-${i}`}
                onClick={() => setDoc({ id: h.id, title: h.title, sections: h.sections })}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 hover:bg-emerald-50 text-gray-600 transition"
              >
                v{history.length - i} • {new Date(h.created_at).toLocaleDateString("id-ID")} • {h.provider === "gemini" ? "Gemini" : "OpenAI"}
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-between items-center pt-4 border-t border-gray-100 flex-wrap gap-2">
          <span className="text-xs font-bold text-gray-500">Ekspor & Cetak:</span>
          <div className="flex space-x-2 flex-wrap gap-y-2">
            <button
              onClick={saveManualKak}
              disabled={savingManual}
              data-testid="kak-save-manual-button"
              className="text-xs bg-amber-500 text-white hover:bg-amber-600 px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1 shadow-sm transition disabled:opacity-60"
            >
              {savingManual ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savingManual ? "Menyimpan..." : "Simpan Edit KAK"}</span>
            </button>
            <button
              onClick={() => window.print()} data-testid="kak-print-button"
              className="text-xs bg-emerald-700 text-white hover:bg-emerald-800 px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1 shadow-sm transition"
            >
              <Printer className="w-3.5 h-3.5" /><span>Cetak Dokumen</span>
            </button>
            <button onClick={() => { if (!project?.id || history.length === 0) return toast.warning("Generate KAK terlebih dahulu agar dokumen tersimpan"); window.open(`${process.env.REACT_APP_BACKEND_URL}/api/projects/${project.id}/export/kak.pdf`); }} data-testid="kak-export-pdf" className="text-xs border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-medium">PDF</button>
            <button onClick={() => { if (!project?.id || history.length === 0) return toast.warning("Generate KAK terlebih dahulu agar dokumen tersimpan"); window.open(`${process.env.REACT_APP_BACKEND_URL}/api/projects/${project.id}/export/kak.docx`); }} data-testid="kak-export-word" className="text-xs border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-medium">Word</button>
            <button onClick={() => toast.info("Unduh file Word lalu unggah ke Google Docs untuk berkolaborasi")} data-testid="kak-export-gdoc" className="text-xs border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-medium">Google Doc</button>
          </div>
        </div>
      </div>

      <div
        id="kak-print-area"
        ref={previewRef}
        onWheel={handlePreviewWheel}
        className="document-scroll-area flex-1 bg-[#fcfcfc] border border-gray-200 rounded-xl p-6 relative h-[640px] overflow-y-auto overscroll-y-contain touch-pan-y font-sans text-xs text-gray-900 space-y-5 shadow-inner"
        data-testid="kak-preview"
        aria-label="Pratinjau dokumen KAK yang dapat digulir"
      >
        {loadingHistory && (
          <div className="absolute inset-0 z-20 bg-white/75 backdrop-blur-[1px] flex items-center justify-center rounded-xl no-print" data-testid="kak-preview-loading">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700"><Loader2 className="w-4 h-4 animate-spin" /> Memuat KAK...</div>
          </div>
        )}
        <span className="absolute top-3 right-3 text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold font-sans no-print">
          {doc ? "KAK Resmi Disusun AI" : "Format Resmi BAZNAS"}
        </span>
        <div className="text-center font-bold pb-3 font-sans" data-testid="kak-official-header">
          <img
            src="https://baznasbazisdki.id/assets/img/logo-dark-min.png"
            alt="Logo BAZNAS BAZIS DKI"
            className="h-14 w-auto object-contain mx-auto mb-3"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <h4 className="text-sm text-gray-950 uppercase font-extrabold tracking-wide" data-testid="kak-doc-title">
            {(project?.name || doc?.title || "NAMA KEGIATAN").toUpperCase()}
          </h4>
          <input
            data-testid="kak-doc-subtitle-input"
            value={manualTitle}
            onChange={(e) => updateManualTitle(e.target.value)}
            disabled={loadingHistory}
            placeholder="Subjudul / keterangan KAK"
            className="mt-1 w-full text-center text-[11px] text-gray-600 bg-transparent border-b border-dashed border-gray-200 focus:border-emerald-500 outline-none px-2 py-1"
          />
          <p className="text-[10px] text-gray-500 mt-1" data-testid="kak-doc-location-date">
            {[project?.loc, project?.date].filter(Boolean).join(" • ") || "Keterangan kegiatan"}
          </p>
        </div>

        <table className="w-full border-collapse bg-white text-[10px] leading-relaxed" data-testid="kak-official-table">
          <thead>
            <tr className="bg-gray-100 text-gray-900 font-bold">
              <th className="border border-gray-500 px-2 py-2 w-10 text-center">NO</th>
              <th className="border border-gray-500 px-2 py-2 w-32 text-left">KOMPONEN</th>
              <th className="border border-gray-500 px-2 py-2 text-left">PENJELASAN</th>
            </tr>
          </thead>
          <tbody>
            {officialRows.map((row) => (
              <tr key={row.no} data-testid={`kak-official-row-${row.no}`}>
                <td className="border border-gray-500 px-2 py-2 text-center align-top font-semibold">{row.no}</td>
                <td className="border border-gray-500 px-2 py-2 align-top font-semibold">{row.component}</td>
                <td className="border border-gray-500 p-0 align-top text-gray-800 min-h-8">
                  <textarea
                    data-testid={`kak-manual-explanation-${row.no}`}
                    data-kak-component-index={row.no - 1}
                    value={row.explanation || ""}
                    onChange={(e) => updateManualRow(row.no - 1, e.target.value)}
                    onInput={(e) => updateManualRow(row.no - 1, e.currentTarget.value)}
                    disabled={loadingHistory}
                    placeholder={doc ? "Isi penjelasan..." : "Belum di-generate"}
                    className="w-full min-h-[48px] resize-y bg-transparent px-2 py-2 text-[10px] leading-relaxed outline-none focus:bg-emerald-50/40"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pt-2" data-testid="kak-rab-section">
          <h4 className="text-center text-sm font-extrabold uppercase mb-2">Rencana Anggaran Biaya (RAB)</h4>
          <table className="w-full border-collapse bg-white text-[10px]" data-testid="kak-rab-table">
            <thead>
              <tr className="bg-gray-100 text-gray-900 font-bold">
                <th className="border border-gray-500 px-2 py-2 w-9 text-center">No</th>
                <th className="border border-gray-500 px-2 py-2 text-left">Uraian</th>
                <th className="border border-gray-500 px-2 py-2 w-20 text-center">Qty</th>
                <th className="border border-gray-500 px-2 py-2 w-20 text-center">Frek</th>
                <th className="border border-gray-500 px-2 py-2 w-24 text-right">Harga Satuan</th>
                <th className="border border-gray-500 px-2 py-2 w-24 text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {rabItems.map((item, index) => {
                const jumlah = (Number(item.qty) || 0) * (Number(item.frek) || 0) * (Number(item.harga) || 0);
                return (
                  <tr key={item.id} data-testid={`kak-rab-row-${item.id}`}>
                    <td className="border border-gray-500 px-2 py-2 text-center align-top">{index + 1}</td>
                    <td className="border border-gray-500 px-2 py-2 align-top">
                      <span className="font-semibold">{item.uraian}</span>
                      {item.kategori && <span className="block text-gray-500 text-[9px]">{item.kategori}</span>}
                    </td>
                    <td className="border border-gray-500 px-2 py-2 text-center align-top">{item.qty} {item.satuanQty}</td>
                    <td className="border border-gray-500 px-2 py-2 text-center align-top">{item.frek} {item.satuanFrek}</td>
                    <td className="border border-gray-500 px-2 py-2 text-right align-top">{rp(item.harga)}</td>
                    <td className="border border-gray-500 px-2 py-2 text-right align-top font-semibold">{rp(jumlah)}</td>
                  </tr>
                );
              })}
              {rabItems.length === 0 && (
                <tr><td colSpan="6" className="border border-gray-500 px-2 py-6 text-center text-gray-400" data-testid="kak-rab-empty">Belum ada item RAB.</td></tr>
              )}
              <tr className="font-extrabold bg-gray-100">
                <td colSpan="5" className="border border-gray-500 px-2 py-2 text-center uppercase">Total</td>
                <td className="border border-gray-500 px-2 py-2 text-right" data-testid="kak-rab-total">{rp(rabTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-8 pt-4 border-t border-gray-300 font-sans">
          <table className="w-full table-fixed text-[10px] text-center border border-gray-300 bg-white">
            <tbody>
              <tr className="bg-gray-100 font-bold">
                {SIGNERS.map((s, i) => <td key={i} className="border p-1 w-1/4">{s.label}</td>)}
              </tr>
              <tr>
                {SIGNERS.map((s, i) => (
                  <td key={i} className="border p-1.5 align-top w-1/4">
                    <div className="mb-1">
                      <input type="date" defaultValue={today} className="w-full text-center text-[9px] bg-gray-50 border border-gray-200 rounded p-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer" />
                    </div>
                    <div className="h-14 flex items-center justify-center text-gray-300 italic text-[9px]">Tanda Tangan</div>
                    <div><input type="text" defaultValue={s.name} className="w-full text-center font-bold text-gray-700 text-[9px] border-b border-dashed border-gray-300 bg-transparent truncate py-1" /></div>
                    <div><input type="text" defaultValue={s.role} className="w-full text-center text-[8px] text-gray-500 bg-transparent truncate py-0.5" /></div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
