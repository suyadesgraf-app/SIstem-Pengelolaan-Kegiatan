import { LayoutDashboard, FolderOpen, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function Header({ user, onLogout }) {
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
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="hidden md:flex items-center space-x-1.5 hover:text-emerald-700 transition"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <button
              data-testid="nav-daftar-kegiatan"
              onClick={() => toast.info("Lihat daftar lengkap pada tab Status & Jadwal")}
              className="hidden md:flex items-center space-x-1.5 hover:text-emerald-700 transition"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Daftar Kegiatan</span>
            </button>
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
