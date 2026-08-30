import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Printer, Sparkles } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import ModelPicker from "@/components/ModelPicker";
import { draftToKakText } from "@/components/tabs/IdeKegiatanTab";

const SIGNERS = [
  { label: "Dibuat oleh;", name: "Saiful Rahman", role: "Staff Kebencanaan" },
  { label: "Diajukan oleh;", name: "Lina Yunita", role: "Kasie Pendistribusian" },
  { label: "Disetujui oleh;", name: "Muhammad Nurminto", role: "Kepala Bidang II" },
  { label: "Disetujui oleh;", name: "Muhamad Bahaudin", role: "Pimpinan Bidang II" },
];

export default function KakTab({ project = null }) {
  const [raw, setRaw] = useState("");
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState("gemini");
  const [history, setHistory] = useState([]);
  const [idea, setIdea] = useState(null);
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
    api.get(`/projects/${project.id}/kaks`).then((r) => {
      setHistory(r.data);
      if (r.data[0]) setDoc({ title: r.data[0].title, sections: r.data[0].sections });
    }).catch(() => {});
    api.get(`/projects/${project.id}/idea`).then((r) => {
      if (r.data.status === "submitted") setIdea(r.data.draft || null);
    }).catch(() => {});
  }, [project?.id]);

  const loadIdeaToRaw = () => {
    const text = draftToKakText(idea);
    if (!text) return toast.warning("Draft ide belum memiliki bahan KAK");
    setRaw(text);
    toast.success("Draft ide dimuat sebagai bahan KAK");
  };

  const generate = async () => {
    if (!raw.trim()) return toast.warning("Masukkan poin mentah kegiatan terlebih dahulu");
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
                onClick={() => setDoc({ title: h.title, sections: h.sections })}
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
        className="document-scroll-area flex-1 bg-[#fcfcfc] border border-gray-200 rounded-xl p-6 relative h-[580px] overflow-y-auto overscroll-y-contain touch-pan-y font-doc text-xs text-gray-800 space-y-4 shadow-inner"
        data-testid="kak-preview"
        aria-label="Pratinjau dokumen KAK yang dapat digulir"
      >
        <span className="absolute top-3 right-3 text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold font-sans no-print">
          {doc ? "KAK Resmi Disusun AI" : "Format Resmi BAZNAS"}
        </span>
        <div className="text-center font-bold border-b border-gray-400 pb-3 mb-4 font-sans">
          <p className="text-xs text-gray-600 uppercase">BAZNAS BAZIS PROVINSI DKI JAKARTA</p>
          <h4 className="text-sm text-gray-900 uppercase mt-1 font-heading">KERANGKA ACUAN KEGIATAN (KAK)</h4>
          <p className="text-[11px] text-emerald-700 font-bold uppercase mt-1" data-testid="kak-doc-title">
            {doc?.title || "[JUDUL PROGRAM KEGIATAN]"}
          </p>
        </div>
        <div className="space-y-3 leading-relaxed" data-testid="kak-preview-content">
          {doc ? (
            doc.sections?.map((s, i) => (
              <p key={i}><strong>{s.heading}:</strong> {s.body}</p>
            ))
          ) : (
            <>
              <p><strong>1. Pendahuluan:</strong> Belum di-generate. Masukkan poin ringkas di sebelah kiri lalu klik tombol <em>Generate KAK dengan AI</em>.</p>
              <p><strong>2. Deskripsi Program:</strong> Penanganan cepat, tepat, dan berdampak nyata bagi penerima manfaat melalui kolaborasi lintas pihak.</p>
              <p><strong>3. Landasan Hukum:</strong> 1. Undang-Undang Nomor 23 Tahun 2011 tentang Pengelolaan Zakat, 2. Peraturan Gubernur DKI Jakarta No. 3 Tahun 2019.</p>
              <p><strong>10. Rencana Anggaran Biaya:</strong> Terintegrasi otomatis dengan nilai total RAB sistem.</p>
            </>
          )}
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
