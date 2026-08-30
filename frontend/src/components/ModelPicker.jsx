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

export default function ModelPicker({ value, onChange, kind = "doc", compact = false, theme = "light" }) {
  const isDark = theme === "dark";

  return (
    <div className={`flex items-center space-x-1 rounded-xl p-1 ${compact ? "" : "w-fit"} ${isDark ? "bg-white/5 border border-white/10" : "bg-gray-100"}`} data-testid="model-picker">
      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 whitespace-nowrap ${isDark ? "text-white/45" : "text-gray-400"}`}>Model AI</span>
      {OPTIONS[kind].map((o) => (
        <button
          key={o.id}
          type="button"
          data-testid={`model-${o.id}`}
          onClick={() => onChange(o.id)}
          className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition whitespace-nowrap ${
            value === o.id
              ? "bg-emerald-700 text-white shadow-sm"
              : isDark
                ? "text-white/65 hover:text-white hover:bg-white/5"
                : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
