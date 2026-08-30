import { useEffect, useRef, useState } from "react";
import { Bot, Minimize2, SendHorizonal } from "lucide-react";
import ModelPicker from "@/components/ModelPicker";

export const IdeaChatPopup = ({ messages, sessionId, provider, setProvider, input, setInput, loading, onSend, onMinimize, position, setPosition }) => {
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const messagesRef = useRef(null);
  const bottomRef = useRef(null);

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

  return (
    <section className="fixed bottom-2 right-2 z-[110] flex min-h-0 h-[min(92dvh,840px)] w-[min(430px,calc(100vw-0.75rem))] flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[#121216] text-white shadow-[0_28px_90px_rgba(0,0,0,0.55)] sm:bottom-4 sm:right-4" style={{ transform: `translate(${position.x}px, ${position.y}px)` }} data-testid="idea-chat-popup" role="dialog" aria-modal="false" aria-labelledby="idea-chat-title">
      <header onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className={`flex items-start justify-between gap-3 border-b border-white/8 px-4 py-4 select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`} data-testid="idea-chat-drag-handle">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#1b1c22] text-emerald-300 shadow-inner" data-testid="idea-chat-avatar"><Bot className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 id="idea-chat-title" className="font-heading text-base font-bold leading-none text-white sm:text-lg" data-testid="idea-chat-title">Chat Ide</h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-white/55">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" data-testid="idea-chat-active-dot" />
              <span data-testid="idea-chat-status">Aktif</span>
              <span className="text-white/25">•</span>
              <span className="truncate" data-testid="idea-chat-session">Session: {sessionId.slice(0, 8)}</span>
            </div>
          </div>
        </div>
        <div onPointerDown={(event) => event.stopPropagation()} className="flex items-center gap-2" data-testid="idea-chat-model-picker-wrap">
          <ModelPicker value={provider} onChange={setProvider} kind="doc" compact theme="dark" />
          <button data-testid="idea-chat-minimize-button" onClick={onMinimize} title="Minimalkan chat" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="Minimalkan chat"><Minimize2 className="h-4 w-4" /></button>
        </div>
      </header>
      <div ref={messagesRef} onWheel={handleWheelScroll} className="chat-scroll-area flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y bg-[#121216] px-4 py-5" data-testid="idea-chat-messages" style={{ WebkitOverflowScrolling: "touch" }}>
        {messages.map((message, index) => (
          <div key={message.id || index} data-testid={`idea-chat-message-${index}`} className={`mb-4 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] ${message.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
              <div className={`rounded-[24px] border px-4 py-3.5 text-sm leading-7 shadow-sm ${message.role === "user" ? "rounded-br-md border-emerald-500/25 bg-emerald-700/30 text-emerald-50" : "rounded-bl-md border-white/8 bg-[#24242b] text-white/92"}`} data-testid={`idea-chat-bubble-${index}`}>
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                {message.next_questions?.length > 0 && <div className="mt-4 flex flex-wrap gap-2" data-testid={`idea-next-questions-${index}`}>{message.next_questions.map((question, questionIndex) => <button key={question} data-testid={`idea-next-question-${index}-${questionIndex}`} onClick={() => onSend(question)} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:border-emerald-400/30 hover:bg-emerald-500/10 hover:text-emerald-100">{question}</button>)}</div>}
              </div>
              <p className="mt-2 px-1 text-[11px] text-white/42" data-testid={`idea-chat-message-meta-${index}`}>{getMessageMeta(message.role)}</p>
            </div>
          </div>
        ))}
        {loading && <div data-testid="idea-chat-loading" className="mb-4 w-fit rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-emerald-200">AI sedang menyusun draft...</div>}
        <div ref={bottomRef} data-testid="idea-chat-bottom-anchor" />
      </div>
      <footer className="border-t border-white/8 bg-[#121216] p-4">
        <div className="rounded-[24px] border border-white/10 bg-[#17171d] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]" data-testid="idea-chat-composer">
          <textarea data-testid="idea-chat-input" value={input} onChange={(event) => setInput(event.target.value)} rows={3} placeholder="Pesan..." className="w-full resize-none bg-transparent px-1 text-sm text-white outline-none placeholder:text-white/30" />
          <div className="mt-3 flex items-center justify-end">
            <button data-testid="idea-chat-send-button" onClick={() => onSend()} disabled={loading} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-emerald-600 hover:text-white active:scale-95 disabled:opacity-60" aria-label="Kirim pesan ide"><SendHorizonal className="h-5 w-5" /></button>
          </div>
        </div>
      </footer>
    </section>
  );
};