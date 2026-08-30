import { Instagram } from "lucide-react";

const INSTAGRAM_URL = "https://www.instagram.com/cheng_suya?igsi=MWhydTk3MWVqbnZw&utm_source=qr";

export const PoweredByChengSuya = ({ context = "login" }) => (
  <a
    href={INSTAGRAM_URL}
    target="_blank"
    rel="noopener noreferrer"
    data-testid={context === "sidebar" ? "powered-by-cheng-suya-sidebar-link" : "powered-by-cheng-suya-login-link"}
    aria-label="Buka Instagram Cheng Suya"
    className={`group inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-100 text-gray-700 shadow-sm transition active:scale-95 hover:border-stone-300 hover:bg-stone-200 ${
      context === "sidebar" ? "px-3 py-2 text-[11px] font-semibold" : "px-4 py-2.5 text-xs font-semibold"
    }`}
  >
    <span
      data-testid={context === "sidebar" ? "powered-by-cheng-suya-sidebar-text" : "powered-by-cheng-suya-login-text"}
      className="inline"
    >
      Powered by Cheng Suya
    </span>
    <Instagram
      data-testid={context === "sidebar" ? "powered-by-cheng-suya-sidebar-icon" : "powered-by-cheng-suya-login-icon"}
      className="w-4 h-4 transition group-hover:rotate-6"
    />
  </a>
);