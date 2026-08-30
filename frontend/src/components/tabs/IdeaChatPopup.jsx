import { Bot, Minimize2, SendHorizonal, UserRound, X } from "lucide-react";
import ModelPicker from "@/components/ModelPicker";

export const IdeaChatPopup = ({ messages, sessionId, provider, setProvider, input, setInput, loading, onSend, onMinimize, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" data-testid="idea-chat-popup-overlay" role="presentation">
    <button data-testid="idea-chat-popup-backdrop" className="absolute inset-0 bg-gray-950/30 backdrop-blur-[2px]" onClick={onClose} aria-label="Tutup popup chat" />
    <section className="relative z-10 flex h-[min(760px,calc(100dvh-1.5rem))] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" data-testid="idea-chat-popup" role="dialog" aria-modal="true" aria-labelledby="idea-chat-title">
      <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Bot className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 id="idea-chat-title" className="font-heading text-lg font-bold text-gray-900" data-testid="idea-chat-title">Chat AI Ide Kegiatan</h2>
            <p className="truncate text-xs text-gray-500" data-testid="idea-chat-session">Session: {sessionId.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModelPicker value={provider} onChange={setProvider} kind="doc" compact />
          <button data-testid="idea-chat-minimize-button" onClick={onMinimize} title="Minimalkan chat" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-emerald-50 hover:text-emerald-700" aria-label="Minimalkan chat"><Minimize2 className="h-4 w-4" /></button>
          <button data-testid="idea-chat-close-button" onClick={onClose} title="Tutup chat" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800" aria-label="Tutup chat"><X className="h-4 w-4" /></button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto overscroll-y-contain touch-pan-y scrollbar-hide space-y-3 bg-gradient-to-b from-gray-50 to-white p-5" data-testid="idea-chat-messages">
        {messages.map((message, index) => (
          <div key={message.id || index} data-testid={`idea-chat-message-${index}`} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            {message.role !== "user" && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Bot className="h-4 w-4" /></span>}
            <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "bg-emerald-700 text-white" : "border border-gray-200 bg-white text-gray-700 shadow-sm"}`}>
              <p>{message.content}</p>
              {message.next_questions?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5" data-testid={`idea-next-questions-${index}`}>{message.next_questions.map((question, questionIndex) => <button key={question} data-testid={`idea-next-question-${index}-${questionIndex}`} onClick={() => setInput(question)} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-100">{question}</button>)}</div>}
            </div>
            {message.role === "user" && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500"><UserRound className="h-4 w-4" /></span>}
          </div>
        ))}
        {loading && <div data-testid="idea-chat-loading" className="w-fit rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">AI sedang menyusun draft...</div>}
      </div>
      <footer className="border-t border-gray-100 bg-white p-4">
        <div className="flex gap-2">
          <textarea data-testid="idea-chat-input" value={input} onChange={(event) => setInput(event.target.value)} rows={2} placeholder="Mau buat kegiatan apa dan seperti apa?" className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          <button data-testid="idea-chat-send-button" onClick={() => onSend()} disabled={loading} className="flex w-12 items-center justify-center rounded-xl bg-emerald-700 text-white transition hover:bg-emerald-800 active:scale-95 disabled:opacity-60" aria-label="Kirim pesan ide"><SendHorizonal className="h-5 w-5" /></button>
        </div>
      </footer>
    </section>
  </div>
);