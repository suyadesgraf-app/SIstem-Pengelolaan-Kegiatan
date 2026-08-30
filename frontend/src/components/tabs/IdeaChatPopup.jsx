import { useEffect, useRef, useState } from "react";
import { Bot, FileText, Image, Minimize2, Paperclip, SendHorizonal, X } from "lucide-react";
import ModelPicker from "@/components/ModelPicker";

export const IdeaChatPopup = ({ messages, sessionId, provider, setProvider, input, setInput, attachmentFile, setAttachmentFile, loading, onSend, onMinimize, position, setPosition }) => {
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const messagesRef = useRef(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: "end" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, loading]);

  const beginDrag = (event) => {
    if (window.innerWidth < 640) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, position };
    setDragging(true);
  };

  const moveDrag = (event) => {
    if (!dragStart.current || dragStart.current.pointerId !== event.pointerId) return;
    const { x, y, position: origin } = dragStart.current;
    setPosition({
      x: Math.max(-(window.innerWidth - 96), Math.min(24, origin.x + event.clientX - x)),
      y: Math.max(-(window.innerHeight - 112), Math.min(24, origin.y + event.clientY - y)),
    });
  };

  const endDrag = (event) => {
    if (dragStart.current?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragStart.current = null;
      setDragging(false);
    }
  };

  const handleWheelScroll = (event) => {
    const element = messagesRef.current;
    if (!element || element.scrollHeight <= element.clientHeight) return;
    event.preventDefault();
    event.stopPropagation();
    element.scrollTop += event.deltaY;
  };

  const getMessageMeta = (role) => role === "user" ? "Anda • baru saja" : "AI Ide • aktif";
  const isImage = (attachment) => attachment?.content_type?.startsWith("image/") || attachment?.type?.startsWith("image/");

  const selectAttachment = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) setAttachmentFile(file);
  };

  return (
    <section className="fixed bottom-2 right-2 z-[110] flex min-h-0 h-[min(82dvh,756px)] w-[min(300px,calc(100vw-0.75rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-800 shadow-[0_20px_55px_rgba(15,23,42,0.18)] sm:bottom-4 sm:right-4" style={{ transform: `translate(${position.x}px, ${position.y}px)` }} data-testid="idea-chat-popup" role="dialog" aria-modal="false" aria-labelledby="idea-chat-title">
      <header onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className={`flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-3 select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`} data-testid="idea-chat-drag-handle">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700" data-testid="idea-chat-avatar"><Bot className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h2 id="idea-chat-title" className="font-heading text-sm font-bold leading-none text-gray-900" data-testid="idea-chat-title">Chat Ide</h2>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-400">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" data-testid="idea-chat-active-dot" />
              <span data-testid="idea-chat-status">Aktif</span>
              <span className="text-gray-300">•</span>
              <span className="truncate" data-testid="idea-chat-session">Session: {sessionId.slice(0, 8)}</span>
            </div>
          </div>
        </div>
        <div onPointerDown={(event) => event.stopPropagation()} data-testid="idea-chat-controls">
          <button data-testid="idea-chat-minimize-button" onClick={onMinimize} title="Minimalkan chat" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700" aria-label="Minimalkan chat"><Minimize2 className="h-4 w-4" /></button>
        </div>
      </header>
      <div ref={messagesRef} onWheel={handleWheelScroll} className="chat-scroll-area flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y bg-slate-50 px-3 py-3" data-testid="idea-chat-messages" style={{ WebkitOverflowScrolling: "touch" }}>
        {messages.map((message, index) => (
          <div key={message.id || index} data-testid={`idea-chat-message-${index}`} className={`mb-3 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] ${message.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
              <div className={`rounded-2xl border px-3 py-2.5 text-xs leading-5 shadow-sm ${message.role === "user" ? "rounded-br-md border-emerald-700 bg-emerald-700 text-white" : "rounded-bl-md border-gray-200 bg-white text-gray-700"}`} data-testid={`idea-chat-bubble-${index}`}>
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                {message.attachments?.length > 0 && <div className="mt-2 space-y-1.5" data-testid={`idea-chat-attachments-${index}`}>{message.attachments.map((attachment) => <button key={attachment.id} data-testid={`idea-chat-attachment-${attachment.id}`} onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}/api/files/${attachment.id}/download`)} title={`Buka ${attachment.filename}`} className={`flex w-full items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[10px] font-semibold transition ${message.role === "user" ? "border-white/30 bg-white/15 text-white hover:bg-white/25" : "border-gray-200 bg-gray-50 text-gray-600 hover:border-emerald-200 hover:text-emerald-700"}`}>{isImage(attachment) ? <Image className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}<span className="truncate">{attachment.filename}</span></button>)}</div>}
              </div>
              {message.next_questions?.length > 0 && <div className="mt-2.5 w-full" data-testid={`idea-next-questions-${index}`}><p className="mb-1.5 px-1 text-[9px] font-bold uppercase tracking-wide text-gray-400" data-testid={`idea-next-questions-label-${index}`}>Rekomendasi pertanyaan</p><div className="grid gap-1.5">{message.next_questions.map((question, questionIndex) => <button key={question} data-testid={`idea-next-question-${index}-${questionIndex}`} onClick={() => onSend(question)} className="w-full rounded-lg border border-emerald-100 bg-white px-2.5 py-2 text-left text-[10px] font-semibold leading-4 text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 active:scale-[0.99]">{question}</button>)}</div></div>}
              <p className="mt-1 px-1 text-[10px] text-gray-400" data-testid={`idea-chat-message-meta-${index}`}>{getMessageMeta(message.role)}</p>
            </div>
          </div>
        ))}
        {loading && <div data-testid="idea-chat-loading" className="mb-3 w-fit rounded-full border border-emerald-100 bg-white px-3 py-2 text-[10px] font-semibold text-emerald-700">AI sedang menyusun draft...</div>}
        <div ref={bottomRef} data-testid="idea-chat-bottom-anchor" />
      </div>
      <footer className="border-t border-gray-100 bg-white p-2.5">
        <div className="mb-2" data-testid="idea-chat-model-picker-wrap"><ModelPicker value={provider} onChange={setProvider} kind="doc" compact /></div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-2 transition focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-100" data-testid="idea-chat-composer">
          <textarea data-testid="idea-chat-input" value={input} onChange={(event) => setInput(event.target.value)} rows={1} placeholder="Pesan..." className="block h-6 w-full resize-none bg-transparent px-1 text-xs leading-6 text-gray-800 outline-none placeholder:text-gray-400" />
          {attachmentFile && <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-[10px] text-emerald-800" data-testid="idea-chat-selected-attachment">{isImage(attachmentFile) ? <Image className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}<span className="min-w-0 flex-1 truncate font-semibold">{attachmentFile.name}</span><button data-testid="idea-chat-remove-attachment-button" onClick={() => setAttachmentFile(null)} title="Hapus lampiran" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-emerald-700 transition hover:bg-emerald-100" aria-label="Hapus lampiran"><X className="h-3.5 w-3.5" /></button></div>}
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <input ref={fileInputRef} data-testid="idea-chat-file-input" type="file" accept="application/pdf,image/*,.pdf" className="hidden" onChange={selectAttachment} />
            <button data-testid="idea-chat-attach-button" onClick={() => fileInputRef.current?.click()} disabled={loading} title="Lampirkan PDF atau foto" className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-emerald-100 hover:text-emerald-700 disabled:opacity-50" aria-label="Lampirkan PDF atau foto"><Paperclip className="h-4 w-4" /></button>
            <button data-testid="idea-chat-send-button" onClick={() => onSend()} disabled={loading} className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 text-white transition hover:bg-emerald-800 active:scale-95 disabled:opacity-60" aria-label="Kirim pesan ide"><SendHorizonal className="h-4 w-4" /></button>
          </div>
        </div>
      </footer>
    </section>
  );
};