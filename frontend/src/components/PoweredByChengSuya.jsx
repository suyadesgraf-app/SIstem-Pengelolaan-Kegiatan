import { Instagram } from "lucide-react";

const INSTAGRAM_URL = "https://www.instagram.com/cheng_suya?igsi=MWhydTk3MWVqbnZw&utm_source=qr";

export const PoweredByChengSuya = ({ compact = false, inverted = false }) => (
  <a
    href={INSTAGRAM_URL}
    target="_blank"
    rel="noopener noreferrer"
    data-testid={compact ? "powered-by-cheng-suya-header-link" : "powered-by-cheng-suya-login-link"}
    aria-label="Buka Instagram Cheng Suya"
    className={`group inline-flex items-center gap-2 rounded-full border transition active:scale-95 ${
      compact
        ? "px-2.5 py-1.5 text-[11px] font-bold"
        : "px-4 py-2.5 text-xs font-bold"
    } ${
      inverted
        ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
        : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100"
    }`}
  >
    <span data-testid={compact ? "powered-by-cheng-suya-header-text" : "powered-by-cheng-suya-login-text"} className={compact ? "hidden xl:inline" : "inline"}>
      Powered by Cheng Suya
    </span>
    <Instagram data-testid={compact ? "powered-by-cheng-suya-header-icon" : "powered-by-cheng-suya-login-icon"} className={`${compact ? "w-4 h-4" : "w-4 h-4"} transition group-hover:rotate-6`} />
  </a>
);