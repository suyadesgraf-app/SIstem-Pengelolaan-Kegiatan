import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bot, CheckCircle2, ClipboardCheck, Lightbulb, Save, SendHorizonal, UserRound } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import ModelPicker from "@/components/ModelPicker";

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
  const [status, setStatus] = useState("draft");
  const [provider, setProvider] = useState("gemini");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
    if (!clean) return toast.warning("Tulis ide atau kebutuhan kegiatan terlebih dahulu");
    setInput("");
    setLoading(true);
    const optimistic = { id: `local-${Date.now()}`, role: "user", content: clean };
    setMessages((prev) => [...prev.filter((m) => m.id !== "greeting"), optimistic]);
    try {
      const r = await api.post(`/projects/${project.id}/idea/chat`, { message: clean, session_id: sessionId, provider, draft });
      setDraft({ ...emptyDraft, ...(r.data.draft || {}) });
      setMessages(r.data.messages || []);
      setSessionId(r.data.session_id || sessionId);
      setStatus(r.data.status || "draft");
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6" data-testid="ide-kegiatan-tab">
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-testid="idea-chat-panel">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Bot className="w-5 h-5" /></span>
            <div>
              <h2 className="font-heading text-lg font-bold text-gray-900" data-testid="idea-chat-title">Chat AI Ide Kegiatan</h2>
              <p className="text-xs text-gray-500" data-testid="idea-chat-session">Session: {sessionId.slice(0, 8)}</p>
            </div>
          </div>
          <ModelPicker value={provider} onChange={setProvider} kind="doc" compact />
        </div>
        <div className="h-[460px] overflow-y-auto p-5 space-y-3 bg-gradient-to-b from-gray-50 to-white" data-testid="idea-chat-messages">
          {messages.map((m, i) => (
            <div key={m.id || i} data-testid={`idea-chat-message-${i}`} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role !== "user" && <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><Bot className="w-4 h-4" /></span>}
              <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-emerald-700 text-white" : "bg-white border border-gray-200 text-gray-700 shadow-sm"}`}>
                <p>{m.content}</p>
                {m.next_questions?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5" data-testid={`idea-next-questions-${i}`}>
                    {m.next_questions.map((q, qi) => (
                      <button key={q} data-testid={`idea-next-question-${i}-${qi}`} onClick={() => setInput(q)} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition">
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {m.role === "user" && <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center shrink-0"><UserRound className="w-4 h-4" /></span>}
            </div>
          ))}
          {loading && <div data-testid="idea-chat-loading" className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-3 py-2 w-fit">AI sedang menyusun draft...</div>}
        </div>
        <div className="p-4 border-t border-gray-100 bg-white">
          <div className="flex gap-2">
            <textarea data-testid="idea-chat-input" value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder="Mau buat kegiatan apa dan seperti apa?" className="flex-1 text-sm rounded-xl border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
            <button data-testid="idea-chat-send-button" onClick={() => sendMessage()} disabled={loading} className="w-12 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 active:scale-95 transition flex items-center justify-center disabled:opacity-60" aria-label="Kirim pesan ide">
              <SendHorizonal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5" data-testid="idea-draft-panel">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> Draft Ide</p>
            <h2 className="font-heading text-lg font-bold text-gray-900 mt-1" data-testid="idea-draft-heading">Bahan Awal RAB & KAK</h2>
          </div>
          <span data-testid="idea-draft-status" className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${status === "submitted" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{status === "submitted" ? "Sudah Disubmit" : "Draft"}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[540px] overflow-y-auto pr-1" data-testid="idea-draft-fields">
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
    </div>
  );
}