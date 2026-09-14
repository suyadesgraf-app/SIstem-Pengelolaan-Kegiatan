import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCheck, Lightbulb, Save } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { IdeaChatPopup } from "@/components/tabs/IdeaChatPopup";

const FIELDS = [
  ["title", "Judul Ide", "Contoh: Layanan Kesehatan Keliling untuk Dhuafa"],
  ["background", "Latar Belakang", "Masalah, urgensi, dan dasar kebutuhan kegiatan"],
  ["goal", "Tujuan", "Dampak yang ingin dicapai"],
  ["beneficiaries", "Sasaran", "Jumlah dan karakter penerima manfaat"],
  ["location", "Lokasi", "Wilayah pelaksanaan"],
  ["schedule", "Waktu", "Rencana tanggal/durasi"],
  ["activity_format", "Bentuk Kegiatan", "Rangkaian acara atau metode pelaksanaan"],
  ["budget_outline", "Gambaran Anggaran", "Estimasi kebutuhan biaya utama"],
  ["rab_notes", "Bahan RAB", "Pos anggaran awal yang perlu disiapkan"],
  ["kak_notes", "Bahan KAK", "Poin penting untuk dokumen KAK"],
];

const emptyDraft = Object.fromEntries(FIELDS.map(([key]) => [key, ""]));

const makeSessionId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `idea-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const draftToKakText = (draft = {}) => FIELDS
  .filter(([key]) => draft[key])
  .map(([key, label], i) => `${i + 1}. ${label}: ${draft[key]}`)
  .join("\n");

export default function IdeKegiatanTab({ project }) {
  const [sessionId, setSessionId] = useState(makeSessionId);
  const [draft, setDraft] = useState(emptyDraft);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [status, setStatus] = useState("draft");
  const [provider, setProvider] = useState("openai");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [chatPosition, setChatPosition] = useState({ x: 0, y: 0 });

  const greeting = useMemo(() => ({
    id: "greeting",
    role: "assistant",
    content: `Halo, saya bantu bentuk ide kegiatan untuk ${project?.name || "kegiatan ini"}. Ceritakan dulu: mau buat kegiatan apa, untuk siapa, dan masalah apa yang ingin diselesaikan?`,
    next_questions: ["Buat kegiatan sosial untuk keluarga dhuafa", "Bantu susun ide dari masalah kesehatan warga", "Kegiatan pendidikan untuk anak yatim"],
  }), [project?.name]);

  const load = useCallback(() => {
    if (!project?.id) return;
    api.get(`/projects/${project.id}/idea`).then((r) => {
      setDraft({ ...emptyDraft, ...(r.data.draft || {}) });
      setMessages(r.data.messages?.length ? r.data.messages : [greeting]);
      setStatus(r.data.status || "draft");
      if (r.data.session_id) setSessionId(r.data.session_id);
    }).catch(() => setMessages([greeting]));
  }, [greeting, project?.id]);

  useEffect(() => { load(); }, [load]);

  const updateDraft = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const sendMessage = async (text = input) => {
    const clean = text.trim();
    const selectedFile = attachmentFile;
    if (!clean && !selectedFile) return toast.warning("Tulis pesan atau pilih lampiran terlebih dahulu");
    if (selectedFile && !(selectedFile.type === "application/pdf" || selectedFile.type.startsWith("image/") || selectedFile.name.toLowerCase().endsWith(".pdf"))) {
      return toast.warning("Lampiran chat hanya mendukung dokumen PDF atau foto");
    }
    if (selectedFile && selectedFile.size > 15 * 1024 * 1024) return toast.warning("Ukuran lampiran maksimal 15MB");
    setInput("");
    setAttachmentFile(null);
    setLoading(true);
    const message = clean || `Saya melampirkan ${selectedFile.name} untuk menjadi bahan ide kegiatan.`;
    let optimisticId = null;
    let uploadedAttachment = null;
    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const upload = await api.post(`/files/upload?kind=idea_chat&label=${encodeURIComponent(selectedFile.name)}&ref=${encodeURIComponent(project.id)}`, formData);
        uploadedAttachment = { id: upload.data.id, filename: upload.data.original_filename, content_type: upload.data.content_type, size: upload.data.size };
      }
      optimisticId = `local-${Date.now()}`;
      const optimistic = { id: optimisticId, role: "user", content: message, attachments: uploadedAttachment ? [uploadedAttachment] : [] };
      setMessages((prev) => [...prev.filter((m) => m.id !== "greeting"), optimistic]);
      const r = await api.post(`/projects/${project.id}/idea/chat`, { message, session_id: sessionId, provider, draft, attachments: uploadedAttachment ? [uploadedAttachment] : [] });
      setDraft({ ...emptyDraft, ...(r.data.draft || {}) });
      setMessages(r.data.messages || []);
      setSessionId(r.data.session_id || sessionId);
      setStatus(r.data.status || "draft");
    } catch (e) {
      if (optimisticId) setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      if (uploadedAttachment) api.delete(`/files/${uploadedAttachment.id}`).catch(() => {});
      toast.error(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      const r = await api.put(`/projects/${project.id}/idea/draft`, { session_id: sessionId, draft });
      setDraft({ ...emptyDraft, ...(r.data.draft || {}) });
      setStatus(r.data.status || "draft");
      toast.success("Draft ide disimpan");
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  const submitDraft = async () => {
    setSaving(true);
    try {
      const r = await api.post(`/projects/${project.id}/idea/submit`, { session_id: sessionId, draft });
      setDraft({ ...emptyDraft, ...(r.data.draft || {}) });
      setStatus("submitted");
      toast.success("Ide kegiatan disubmit sebagai bahan RAB dan KAK");
    } catch (e) { toast.error(formatApiError(e)); }
    finally { setSaving(false); }
  };

  const restoreChat = () => setChatMinimized(false);
  const minimizeChat = () => setChatMinimized(true);

  return (
    <div className="relative" data-testid="ide-kegiatan-tab">
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5" data-testid="idea-draft-panel">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> Draft Ide</p>
            <h2 className="font-heading text-lg font-bold text-gray-900 mt-1" data-testid="idea-draft-heading">Bahan Awal RAB & KAK</h2>
          </div>
          <span data-testid="idea-draft-status" className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${status === "submitted" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{status === "submitted" ? "Sudah Disubmit" : "Draft"}</span>
        </div>
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[540px] overflow-y-auto overscroll-y-contain touch-pan-y scrollbar-hide pr-1"
          data-testid="idea-draft-fields"
          aria-label="Kolom draft ide"
        >
          {FIELDS.map(([key, label, placeholder]) => (
            <label key={key} className={key.includes("notes") || key === "background" || key === "activity_format" ? "md:col-span-2" : ""} data-testid={`idea-draft-${key}-field`}>
              <span className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{label}</span>
              <textarea data-testid={`idea-draft-${key}-input`} value={draft[key] || ""} onChange={(e) => updateDraft(key, e.target.value)} rows={key.includes("notes") || key === "background" || key === "activity_format" ? 3 : 2} placeholder={placeholder} className="w-full text-xs rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 outline-none resize-none transition focus:bg-white focus:ring-2 focus:ring-emerald-500" />
            </label>
          ))}
        </div>
        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          <button data-testid="idea-draft-save-button" onClick={saveDraft} disabled={saving} className="flex-1 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 active:scale-[0.98] font-bold text-sm px-4 py-3 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60">
            <Save className="w-4 h-4" /><span>{saving ? "Menyimpan..." : "Simpan Draft"}</span>
          </button>
          <button data-testid="idea-draft-submit-button" onClick={submitDraft} disabled={saving} className="flex-1 bg-emerald-700 text-white hover:bg-emerald-800 active:scale-[0.98] font-bold text-sm px-4 py-3 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60">
            {status === "submitted" ? <CheckCircle2 className="w-4 h-4" /> : <ClipboardCheck className="w-4 h-4" />}
            <span>{status === "submitted" ? "Update Bahan" : "Submit untuk RAB & KAK"}</span>
          </button>
        </div>
      </section>
      {!chatMinimized && <IdeaChatPopup messages={messages} sessionId={sessionId} provider={provider} setProvider={setProvider} input={input} setInput={setInput} attachmentFile={attachmentFile} setAttachmentFile={setAttachmentFile} loading={loading} onSend={sendMessage} onMinimize={minimizeChat} position={chatPosition} setPosition={setChatPosition} />}
      {chatMinimized && <button data-testid="idea-chat-restore-button" onClick={restoreChat} className="fixed bottom-5 right-5 z-[110] inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-800 active:scale-95"><span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-200" />Chat AI Ide Kegiatan</button>}
    </div>
  );
}