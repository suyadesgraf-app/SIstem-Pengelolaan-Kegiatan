import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, FolderOpen, LogOut, Bell } from "lucide-react";
import api from "@/lib/api";

export default function Header({ user, onLogout, activeMenu = "dashboard", onNavigateDashboard, onNavigateCompleted }) {
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef(null);
  const unread = notifs.filter((n) => !n.read).length;

  const loadNotifs = () => api.get("/notifications").then((r) => setNotifs(r.data)).catch(() => {});
  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const close = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const readAll = async () => {
    await api.post("/notifications/read-all").catch(() => {});
    loadNotifs();
  };

  return (
    <header className="bg-white/85 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40 no-print" data-testid="app-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <img
              src="https://baznasbazisdki.id/assets/img/logo-dark-min.png"
              alt="Logo BAZNAS DKI"
              className="h-8 sm:h-10 w-auto object-contain"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
            <div className="hidden sm:block border-l border-gray-200 pl-3">
              <h1 className="font-heading font-bold text-xs leading-tight text-gray-800">BAZNAS BAZIS DKI</h1>
              <p className="text-[10px] text-gray-500 font-medium">Sistem Integrasi Pengelolaan Program/Kegiatan</p>
            </div>
          </div>
          <nav className="flex items-center space-x-2 sm:space-x-5 text-sm font-medium text-gray-600">
            <button
              data-testid="nav-dashboard"
              onClick={() => {
                onNavigateDashboard?.();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`hidden md:flex items-center space-x-1.5 transition ${activeMenu === "dashboard" ? "text-emerald-700" : "hover:text-emerald-700"}`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <button
              data-testid="nav-daftar-kegiatan"
              onClick={() => {
                onNavigateCompleted?.();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`hidden md:flex items-center space-x-1.5 transition ${activeMenu === "completed" ? "text-emerald-700" : "hover:text-emerald-700"}`}
            >
              <FolderOpen className="w-4 h-4" />
              <span>Daftar Kegiatan</span>
            </button>
            <div className="relative" ref={notifRef}>
              <button
                data-testid="header-notif-bell"
                onClick={() => setShowNotifs(!showNotifs)}
                className="relative p-2 rounded-full hover:bg-gray-100 transition text-gray-500 hover:text-emerald-700"
              >
                <Bell className="w-4 h-4" />
                {unread > 0 && (
                  <span data-testid="header-notif-badge" className="absolute -top-0.5 -right-0.5 bg-amber-500 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">{unread}</span>
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 p-4" data-testid="header-notif-panel">
                  <div className="flex justify-between items-center mb-3">
                    <p className="font-heading font-bold text-sm text-gray-800">Notifikasi</p>
                    <button data-testid="header-notif-read-all" onClick={readAll} className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900">Tandai semua dibaca</button>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {notifs.map((n) => (
                      <div key={n.id} data-testid={`header-notif-${n.id}`} className={`rounded-xl border p-3 text-xs leading-relaxed ${n.read ? "border-gray-100 bg-gray-50 text-gray-500" : "border-emerald-200 bg-emerald-50 text-gray-800 font-medium"}`}>
                        <p>{n.message}</p>
                        <p className="text-[9px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString("id-ID")}</p>
                      </div>
                    ))}
                    {notifs.length === 0 && <p className="text-xs text-gray-400 text-center py-4" data-testid="header-notif-empty">Belum ada notifikasi.</p>}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2 bg-emerald-700 text-white px-4 py-2 rounded-full" data-testid="nav-user-badge">
              <span className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold">
                {user.name?.charAt(0) || "U"}
              </span>
              <span className="text-xs font-semibold max-w-[110px] truncate">{user.name}</span>
            </div>
            <button
              data-testid="nav-logout"
              onClick={onLogout}
              className="flex items-center space-x-1.5 hover:text-red-600 transition pl-2 sm:pl-4 border-l border-gray-200"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
