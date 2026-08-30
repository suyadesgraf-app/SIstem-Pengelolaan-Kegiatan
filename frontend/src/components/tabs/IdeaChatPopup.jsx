import { useEffect, useRef, useState } from "react";
import { Bot, GripHorizontal, Minimize2, SendHorizonal, UserRound } from "lucide-react";
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

  return (
    <section className="fixed bottom-3 right-3 z-[110] flex min-h-0 h-[min(600px,calc(100dvh-1.5rem))] w-[min(500px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:bottom-6 sm:right-6" style={{ transform: `translate(${position.x}px, ${position.y}px)` }} data-testid="idea-chat-popup" role="dialog" aria-modal="false" aria-labelledby="idea-chat-title">
      <header onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className={`flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`} data-testid="idea-chat-drag-handle">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Bot className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 id="idea-chat-title" className="font-heading text-lg font-bold text-gray-900" data-testid="idea-chat-title">Chat AI Ide Kegiatan</h2>
            <p className="truncate text-xs text-gray-500" data-testid="idea-chat-session">Session: {sessionId.slice(0, 8)}</p>
          </div>
        </div>
        <div onPointerDown={(event) => event.stopPropagation()} className="flex items-center gap-1" data-testid="idea-chat-model-picker-wrap">
          <ModelPicker value={provider} onChange={setProvider} kind="doc" compact />
          <button data-testid="idea-chat-minimize-button" onClick={onMinimize} title="Minimalkan chat" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-emerald-50 hover:text-emerald-700" aria-label="Minimalkan chat"><Minimize2 className="h-4 w-4" /></button>
        </div>
        <span className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 text-gray-300"><GripHorizontal className="h-3 w-3" /></span>
      </header>
      <div ref={messagesRef} onWheel={handleWheelScroll} className="chat-scroll-area flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y space-y-3 bg-gradient-to-b from-gray-50 to-white p-5 pr-3" data-testid="idea-chat-messages" style={{ WebkitOverflowScrolling: "touch" }}>
        {messages.map((message, index) => (
          <div key={message.id || index} data-testid={`idea-chat-message-${index}`} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            {message.role !== "user" && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Bot className="h-4 w-4" /></span>}
            <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "bg-emerald-700 text-white" : "border border-gray-200 bg-white text-gray-700 shadow-sm"}`}>
              <p>{message.content}</p>
              {message.next_questions?.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5" data-testid={`idea-next-questions-${index}`}>{message.next_questions.map((question, questionIndex) => <button key={question} data-testid={`idea-next-question-${index}-${questionIndex}`} onClick={() => onSend(question)} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 transition hover:bg-emerald-100">{question}</button>)}</div>}
            </div>
            {message.role === "user" && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500"><UserRound className="h-4 w-4" /></span>}
          </div>
        ))}
        {loading && <div data-testid="idea-chat-loading" className="w-fit rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">AI sedang menyusun draft...</div>}
        <div ref={bottomRef} data-testid="idea-chat-bottom-anchor" />
      </div>
      <footer className="border-t border-gray-100 bg-white p-4">
        <div className="flex gap-2">
          <textarea data-testid="idea-chat-input" value={input} onChange={(event) => setInput(event.target.value)} rows={2} placeholder="Mau buat kegiatan apa dan seperti apa?" className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          <button data-testid="idea-chat-send-button" onClick={() => onSend()} disabled={loading} className="flex w-12 items-center justify-center rounded-xl bg-emerald-700 text-white transition hover:bg-emerald-800 active:scale-95 disabled:opacity-60" aria-label="Kirim pesan ide"><SendHorizonal className="h-5 w-5" /></button>
        </div>
      </footer>
    </section>
  );
};