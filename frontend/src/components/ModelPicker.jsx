const OPTIONS = {
  doc: [
    { id: "gemini", label: "Gemini 3.1 Pro" },
    { id: "openai", label: "GPT-5.4" },
  ],
  ocr: [
    { id: "gemini", label: "Gemini 3.7 Flash" },
    { id: "openai", label: "GPT-5.4 Mini" },
  ],
};

export default function ModelPicker({ value, onChange, kind = "doc", compact = false }) {
  return (
    <div className={`flex items-center space-x-1 bg-gray-100 rounded-xl p-1 ${compact ? "" : "w-fit"}`} data-testid="model-picker">
      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-2 whitespace-nowrap">Model AI</span>
      {OPTIONS[kind].map((o) => (
        <button
          key={o.id}
          type="button"
          data-testid={`model-${o.id}`}
          onClick={() => onChange(o.id)}
          className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition whitespace-nowrap ${
            value === o.id ? "bg-emerald-700 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
