import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Upload, Send, FileCheck2 } from "lucide-react";
import api, { formatApiError } from "@/lib/api";

const LAMPIRAN = [
  "Nota-nota Pembelian Barang/Jasa",
  "Dokumentasi (4-8 Foto)",
  "Berita Acara Serah Terima / BAST (Opsional)",
  "Data Penerima Manfaat",
  "Daftar Hadir Panitia (Opsional)",
  "Lampiran Lainnya (Opsional)",
];

export default function LaporanTab() {
  const [projects, setProjects] = useState([]);
  const [nomorIndeks, setNomorIndeks] = useState("");
  const [kakName, setKakName] = useState("");
  const [points, setPoints] = useState("");
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploaded, setUploaded] = useState({});
  const kakFileRef = useRef(null);

  useEffect(() => {
    api.get("/projects").then((r) => {
      setProjects(r.data);
      if (r.data[0]) setNomorIndeks(r.data[0].nomor_indeks);
    }).catch(() => {});
  }, []);

  const uploadKak = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setKakName(file.name);
    toast.success("KAK bertandatangan berhasil di-upload sebagai referensi");
  };

  const generate = async () => {
    if (!points.trim()) return toast.warning("Masukkan poin mentah lapangan terlebih dahulu");
    setLoading(true);
    try {
      const r = await api.post("/ai/report", { nomor_indeks: nomorIndeks, points, kak_name: kakName });
      setDoc(r.data);
      toast.success("Narasi Laporan AI berhasil dibuat merujuk KAK TTD!");
    } catch (e2) {
      toast.error(formatApiError(e2));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    try {
      await api.post("/projects/submit", { nomor_indeks: nomorIndeks });
      toast.success(`Laporan (${nomorIndeks}) berhasil disubmit ke Verifikator!`);
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
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nomor Indeks</label>
            <select data-testid="laporan-nomor-indeks" value={nomorIndeks} onChange={(e) => setNomorIndeks(e.target.value)} className="w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-emerald-500">
              {projects.map((p) => <option key={p.id} value={p.nomor_indeks}>{p.nomor_indeks} — {p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Upload KAK Disetujui / Bertandatangan (Referensi Laporan)</label>
            <input ref={kakFileRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={uploadKak} data-testid="laporan-kak-file" />
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
          <button
            onClick={generate} disabled={loading} data-testid="laporan-generate-button"
            className="w-full bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white font-heading font-bold py-3 rounded-xl text-sm transition shadow-sm flex items-center justify-center space-x-2 disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? "Generating Laporan AI..." : "Generate Laporan dengan AI"}</span>
          </button>
        </div>

        <div className="flex-1 bg-[#fcfcfc] border border-gray-200 rounded-xl p-6 relative h-[480px] overflow-y-auto font-doc text-xs text-gray-800 space-y-4 shadow-inner" data-testid="laporan-preview">
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

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <h3 className="font-heading font-bold text-gray-800 text-sm mb-4">Lampiran Wajib & Pendukung Kegiatan</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6" data-testid="lampiran-list">
          {LAMPIRAN.map((l, i) => (
            <div key={i} className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3">
              <span className="text-xs text-gray-700 font-medium">{i + 1}. {l}</span>
              <button
                data-testid={`lampiran-upload-${i}`}
                onClick={() => { setUploaded({ ...uploaded, [i]: true }); toast.success(`Lampiran "${l}" terunggah`); }}
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
