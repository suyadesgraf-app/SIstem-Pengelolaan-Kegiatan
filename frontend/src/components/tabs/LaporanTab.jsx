import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileCheck2, Pencil, Save, Send, Sparkles, Trash2, Upload } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import ModelPicker from "@/components/ModelPicker";

const LAMPIRAN = [
  "Nota-nota Pembelian Barang/Jasa",
  "Dokumentasi (4-8 Foto)",
  "Berita Acara Serah Terima / BAST (Opsional)",
  "Data Penerima Manfaat",
  "Daftar Hadir Panitia (Opsional)",
  "Lampiran Lainnya (Opsional)",
];

export default function LaporanTab({ project = null, onProjectUpdate = null }) {
  const showSavedProjectNomorIndeks = Boolean(
    project?.nomor_indeks && (project?.nomor_indeks_updated_at || project?.progress?.laporan > 0 || project?.status !== "Perencanaan")
  );
  const savedProjectNomorIndeks = showSavedProjectNomorIndeks ? project?.nomor_indeks || "" : "";
  const [nomorIndeks, setNomorIndeks] = useState(savedProjectNomorIndeks);
  const [kakName, setKakName] = useState("");
  const [points, setPoints] = useState("");
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingIndex, setSavingIndex] = useState(false);
  const [provider, setProvider] = useState("gemini");
  const [uploaded, setUploaded] = useState({});
  const [files, setFiles] = useState([]);
  const [activeLamp, setActiveLamp] = useState(null);
  const [replaceFileId, setReplaceFileId] = useState(null);
  const [aiError, setAiError] = useState("");
  const kakFileRef = useRef(null);
  const lampFileRef = useRef(null);
  const replaceFileRef = useRef(null);
  const previewRef = useRef(null);
  const canEditAttachments = project?.status === "Perencanaan";

  useEffect(() => {
    setNomorIndeks(savedProjectNomorIndeks);
  }, [project?.id, savedProjectNomorIndeks]);

  const handlePreviewWheel = (event) => {
    const panel = previewRef.current;
    if (!panel || panel.scrollHeight <= panel.clientHeight) return;
    event.preventDefault();
    event.stopPropagation();
    panel.scrollTop += event.deltaY;
  };

  const applyFileState = useCallback((rows = []) => {
    const up = {};
    let kak = "";
    rows.forEach((f) => {
      if (f.kind === "kak_ref" && !kak) kak = f.original_filename;
      if (f.kind === "lampiran") {
        const idx = LAMPIRAN.indexOf(f.label);
        if (idx >= 0) up[idx] = true;
      }
    });
    setFiles(rows);
    setUploaded(up);
    setKakName(kak);
  }, []);

  const loadFiles = useCallback(() => {
    if (!savedProjectNomorIndeks) return Promise.resolve();
    return api.get(`/files?ref=${encodeURIComponent(savedProjectNomorIndeks)}`).then((r) => {
      applyFileState(r.data);
    }).catch(() => {});
  }, [applyFileState, savedProjectNomorIndeks]);

  useEffect(() => {
    if (!project?.id) return;
    api.get(`/projects/${project.id}/reports`).then((r) => {
      if (r.data[0]) setDoc({ title: r.data[0].title, sections: r.data[0].sections });
    }).catch(() => {});
  }, [project?.id]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const saveNomorIndeks = async ({ silent = false } = {}) => {
    const value = nomorIndeks.trim();
    if (!value) throw new Error("Nomor indeks wajib diisi saat membuat laporan kegiatan");
    setSavingIndex(true);
    try {
      const response = await api.put(`/projects/${project.id}/nomor-indeks`, { nomor_indeks: value });
      setNomorIndeks(response.data.nomor_indeks || value);
      onProjectUpdate?.(response.data);
      if (!silent) toast.success("Nomor indeks laporan disimpan");
      return response.data.nomor_indeks || value;
    } finally {
      setSavingIndex(false);
    }
  };

  const uploadFile = async (file, kind, label) => {
    const savedNomorIndeks = await saveNomorIndeks({ silent: true });
    const fd = new FormData();
    fd.append("file", file);
    const r = await api.post(
      `/files/upload?kind=${kind}&label=${encodeURIComponent(label)}&ref=${encodeURIComponent(savedNomorIndeks)}`,
      fd
    );
    return r.data;
  };

  const uploadKak = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const rec = await uploadFile(file, "kak_ref", "KAK TTD");
      applyFileState([rec, ...files]);
      setKakName(file.name);
      toast.success("KAK bertandatangan berhasil di-upload sebagai referensi");
    } catch (e2) { toast.error(formatApiError(e2)); }
  };

  const pickLamp = (i) => {
    setActiveLamp(i);
    lampFileRef.current?.click();
  };

  const onLampFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || activeLamp === null) return;
    try {
      const rec = await uploadFile(file, "lampiran", LAMPIRAN[activeLamp]);
      applyFileState([rec, ...files]);
      toast.success(`Lampiran "${LAMPIRAN[activeLamp]}" terunggah ke penyimpanan`);
    } catch (e2) { toast.error(formatApiError(e2)); }
  };

  const cancelAttachment = async (fileId) => {
    if (!canEditAttachments) return toast.warning("Lampiran hanya bisa dibatalkan sebelum laporan disubmit");
    try {
      await api.delete(`/files/${fileId}`);
      applyFileState(files.filter((f) => f.id !== fileId));
      toast.success("Unggahan lampiran dibatalkan");
    } catch (e2) { toast.error(formatApiError(e2)); }
  };

  const startReplaceAttachment = (fileId) => {
    if (!canEditAttachments) return toast.warning("Lampiran hanya bisa diedit sebelum laporan disubmit");
    setReplaceFileId(fileId);
    replaceFileRef.current?.click();
  };

  const onReplaceFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !replaceFileId) return;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api.put(`/files/${replaceFileId}/replace`, fd);
      applyFileState(files.map((f) => (f.id === replaceFileId ? r.data : f)));
      toast.success("Lampiran berhasil diganti");
    } catch (e2) {
      toast.error(formatApiError(e2));
    } finally {
      setReplaceFileId(null);
    }
  };

  const generate = async () => {
    if (!points.trim()) return toast.warning("Masukkan poin mentah lapangan terlebih dahulu");
    setLoading(true);
    setAiError("");
    try {
      const savedNomorIndeks = await saveNomorIndeks({ silent: true });
      const r = await api.post("/ai/report", { nomor_indeks: savedNomorIndeks, points, kak_name: kakName, provider, project_id: project?.id });
      setDoc(r.data);
      toast.success(`Laporan AI berhasil dibuat (${provider === "gemini" ? "Gemini 3.1 Pro" : "GPT-5.4"})!`);
    } catch (e2) {
      const message = formatApiError(e2);
      setAiError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    try {
      const savedNomorIndeks = await saveNomorIndeks({ silent: true });
      await api.post("/projects/submit", { nomor_indeks: savedNomorIndeks, project_id: project?.id });
      toast.success(`Laporan (${savedNomorIndeks}) berhasil disubmit ke Verifikator!`);
    } catch (e2) {
      toast.error(formatApiError(e2));
    }
  };

  return (
    <div className="space-y-6" data-testid="laporan-tab">
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-8">
        <div className="flex-1 space-y-4">
          <h2 className="font-heading text-lg font-bold text-gray-800">AI Report Generator</h2>
          <p className="text-sm text-gray-500">Masukkan poin mentah lapangan, AI akan merangkai dokumen Laporan Akhir sesuai format baku BAZNAS.</p>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nomor Indeks Laporan</label>
            <div className="flex gap-2">
              <input
                data-testid="laporan-nomor-indeks-input"
                value={nomorIndeks}
                onChange={(e) => setNomorIndeks(e.target.value)}
                disabled={!canEditAttachments || savingIndex}
                placeholder="Input nomor indeks saat membuat laporan"
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition disabled:opacity-60"
              />
              <button
                data-testid="laporan-nomor-indeks-save"
                onClick={() => saveNomorIndeks().catch((e) => toast.error(formatApiError(e)))}
                disabled={!canEditAttachments || savingIndex}
                title="Simpan nomor indeks"
                aria-label="Simpan nomor indeks laporan"
                className="w-10 h-10 rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 active:scale-95 transition flex items-center justify-center disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
              </button>
            </div>
            {project?.name && <p className="text-[11px] text-gray-400 mt-1" data-testid="laporan-project-name-note">{project.name}</p>}
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Upload KAK Disetujui / Bertandatangan (Referensi Laporan)</label>
            <input ref={kakFileRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={uploadKak} data-testid="laporan-kak-file" />
            <input ref={lampFileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" className="hidden" onChange={onLampFile} data-testid="lampiran-file-input" />
            <input ref={replaceFileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" className="hidden" onChange={onReplaceFile} data-testid="lampiran-replace-file-input" />
            <button onClick={() => kakFileRef.current?.click()} data-testid="laporan-upload-kak" className="w-full text-xs border-2 border-dashed border-gray-300 hover:border-emerald-400 text-gray-600 rounded-xl py-3 flex items-center justify-center space-x-2 transition">
              <Upload className="w-4 h-4" /><span>Pilih File KAK</span>
            </button>
            {kakName && <p className="text-[11px] mt-1.5 text-emerald-700 font-bold" data-testid="laporan-kak-status">✓ Referensi KAK TTD: {kakName}</p>}
          </div>
          <textarea
            rows="5" value={points} onChange={(e) => setPoints(e.target.value)} data-testid="laporan-points-input"
            className="w-full text-sm border border-gray-300 rounded-xl p-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none transition"
            placeholder="Contoh: Kegiatan terlaksana 24 Agustus, 19.000 penerima manfaat terlayani, sisa anggaran 4%..."
          />
          <ModelPicker value={provider} onChange={setProvider} kind="doc" />
          <button
            onClick={generate} disabled={loading} data-testid="laporan-generate-button"
            className="w-full bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white font-heading font-bold py-3 rounded-xl text-sm transition shadow-sm flex items-center justify-center space-x-2 disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? "Generating Laporan AI..." : "Generate Laporan dengan AI"}</span>
          </button>
          {aiError && (
            <p data-testid="laporan-ai-error" className="text-[11px] font-semibold text-rose-800 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 leading-relaxed">
              {aiError}
            </p>
          )}
        </div>

        <div ref={previewRef} onWheel={handlePreviewWheel} className="document-scroll-area flex-1 bg-[#fcfcfc] border border-gray-200 rounded-xl p-6 relative h-[480px] overflow-y-auto overscroll-y-contain touch-pan-y font-doc text-xs text-gray-800 space-y-4 shadow-inner" data-testid="laporan-preview" aria-label="Pratinjau laporan kegiatan yang dapat digulir">
          <span className="absolute top-3 right-3 text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold font-sans">
            {loading ? "Generating Laporan AI..." : doc ? "Selesai" : "Format Resmi BAZNAS"}
          </span>
          <div className="text-center font-bold border-b border-gray-400 pb-3 mb-4 font-sans">
            <p className="text-xs text-gray-600 uppercase">BAZNAS BAZIS PROVINSI DKI JAKARTA</p>
            <h4 className="text-sm text-gray-900 uppercase mt-1 font-heading" data-testid="laporan-doc-title">
              {doc?.title || "LAPORAN PERTANGGUNGJAWABAN"}
            </h4>
            <p className="text-[11px] text-emerald-700 font-bold mt-1">{nomorIndeks}</p>
          </div>
          <div className="space-y-3 leading-relaxed">
            {doc ? (
              doc.sections?.map((s, i) => <p key={i}><strong>{s.heading}:</strong> {s.body}</p>)
            ) : (
              <>
                <p><strong>BAB I: PENDAHULUAN</strong><br />Narasi pendahuluan disusun merujuk KAK yang telah di-upload.</p>
                <p><strong>BAB II: PELAKSANAAN</strong><br />Deskripsi pelaksanaan dan realisasi anggaran.</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white px-6 py-4 rounded-2xl border border-gray-200 shadow-sm flex justify-between items-center flex-wrap gap-2">
        <span className="text-xs font-bold text-gray-500">Ekspor Laporan Kegiatan:</span>
        <div className="flex space-x-2 flex-wrap gap-y-2">
          <button data-testid="laporan-export-pdf" onClick={() => { if (!doc) return toast.warning("Generate laporan terlebih dahulu agar dokumen tersimpan"); window.open(`${process.env.REACT_APP_BACKEND_URL}/api/projects/${project.id}/export/report.pdf`); }} className="text-xs border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-medium">PDF</button>
          <button data-testid="laporan-export-word" onClick={() => { if (!doc) return toast.warning("Generate laporan terlebih dahulu agar dokumen tersimpan"); window.open(`${process.env.REACT_APP_BACKEND_URL}/api/projects/${project.id}/export/report.docx`); }} className="text-xs border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-medium">Word</button>
          <button data-testid="laporan-export-gdoc" onClick={() => toast.info("Unduh file Word lalu unggah ke Google Docs untuk berkolaborasi")} className="text-xs border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg font-medium">Google Doc</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <h3 className="font-heading font-bold text-gray-800 text-sm mb-4">Lampiran Wajib & Pendukung Kegiatan</h3>
        {!canEditAttachments && (
          <p className="mb-4 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2" data-testid="lampiran-locked-message">
            Lampiran terkunci setelah laporan disubmit. Minta revisi terlebih dahulu untuk mengubah unggahan.
          </p>
        )}
        {files.length > 0 && (
          <div className="mb-5 space-y-2" data-testid="lampiran-gallery">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">File Terunggah ({files.length})</p>
            {files.map((f) => (
              <div key={f.id} className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-2.5 gap-3 flex-wrap" data-testid={`lampiran-file-${f.id}`}>
                <span className="text-xs text-gray-700 font-medium truncate max-w-[240px]">{f.original_filename}</span>
                <span className="text-[9px] text-gray-400 whitespace-nowrap">{f.label || f.kind} • {(f.size / 1024).toFixed(0)} KB</span>
                <span className="flex items-center gap-1.5" data-testid={`lampiran-actions-${f.id}`}>
                  <button
                    onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/files/${f.id}/download`)}
                    data-testid={`lampiran-view-${f.id}`}
                    title="Lihat / Unduh"
                    aria-label="Lihat atau unduh lampiran"
                    className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95 transition inline-flex items-center justify-center"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => startReplaceAttachment(f.id)}
                    disabled={!canEditAttachments}
                    data-testid={`lampiran-edit-${f.id}`}
                    title="Edit unggahan"
                    aria-label="Edit unggahan lampiran"
                    className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-95 transition inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => cancelAttachment(f.id)}
                    disabled={!canEditAttachments}
                    data-testid={`lampiran-cancel-${f.id}`}
                    title="Batalkan unggahan"
                    aria-label="Batalkan unggahan lampiran"
                    className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 active:scale-95 transition inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6" data-testid="lampiran-list">
          {LAMPIRAN.map((l, i) => (
            <div key={i} className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3">
              <span className="text-xs text-gray-700 font-medium">{i + 1}. {l}</span>
              <button
                data-testid={`lampiran-upload-${i}`}
                onClick={() => pickLamp(i)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition ${uploaded[i] ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
              >
                {uploaded[i] ? "✓ Terunggah" : "Upload"}
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={submit} data-testid="laporan-submit-button"
          className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-heading font-bold px-6 py-3 rounded-xl text-sm transition shadow flex items-center justify-center space-x-2"
        >
          <Send className="w-4 h-4" /><span>Submit ke Verifikator (SLA Tracker)</span>
        </button>
        <p className="text-[11px] text-gray-400 mt-2 flex items-center space-x-1">
          <FileCheck2 className="w-3.5 h-3.5" /><span>Status berubah menjadi "Menunggu" dan masuk antrean tab Persetujuan.</span>
        </p>
      </div>
    </div>
  );
}
