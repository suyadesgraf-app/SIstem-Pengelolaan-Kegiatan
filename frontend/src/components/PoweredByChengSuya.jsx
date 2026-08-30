import { Instagram } from "lucide-react";

const INSTAGRAM_URL = "https://www.instagram.com/cheng_suya?igsi=MWhydTk3MWVqbnZw&utm_source=qr";

export const PoweredByChengSuya = ({ context = "login" }) => (
  <a
    href={INSTAGRAM_URL}
    target="_blank"
    rel="noopener noreferrer"
    data-testid={context === "sidebar" ? "powered-by-cheng-suya-sidebar-link" : "powered-by-cheng-suya-login-link"}
    aria-label="Buka Instagram Cheng Suya"
    className={`group inline-flex items-center gap-2 text-gray-600 transition active:scale-95 hover:text-gray-900 ${
      context === "sidebar" ? "text-[11px] font-semibold" : "text-xs font-semibold"
    }`}
  >
    <span
      data-testid={context === "sidebar" ? "powered-by-cheng-suya-sidebar-prefix" : "powered-by-cheng-suya-login-prefix"}
      className="inline"
    >
      Developed by
    </span>
    <Instagram
      data-testid={context === "sidebar" ? "powered-by-cheng-suya-sidebar-icon" : "powered-by-cheng-suya-login-icon"}
      className="w-4 h-4 transition group-hover:rotate-6"
    />
    <span
      data-testid={context === "sidebar" ? "powered-by-cheng-suya-sidebar-text" : "powered-by-cheng-suya-login-text"}
      className="inline"
    >
      Cheng Suya
    </span>
  </a>
);