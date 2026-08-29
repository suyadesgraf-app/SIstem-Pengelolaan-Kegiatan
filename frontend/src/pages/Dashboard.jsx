import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Header from "@/components/Header";
import SidebarProfile from "@/components/SidebarProfile";
import DashboardTab from "@/components/tabs/DashboardTab";
import RabTab from "@/components/tabs/RabTab";
import KakTab from "@/components/tabs/KakTab";
import RealisasiTab from "@/components/tabs/RealisasiTab";
import LaporanTab from "@/components/tabs/LaporanTab";
import PersetujuanTab from "@/components/tabs/PersetujuanTab";
import { useAuth } from "@/context/AuthContext";

const TABS = [
  { id: "dashboard", label: "Status & Jadwal" },
  { id: "planning", label: "Anggaran Kegiatan" },
  { id: "aiperencanaan", label: "AI Perencanaan" },
  { id: "realisasi", label: "Realisasi Anggaran" },
  { id: "laporan", label: "AI Laporan" },
  { id: "persetujuan", label: "Persetujuan" },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("dashboard");

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-appbg text-gray-800 antialiased" data-testid="dashboard-page">
      <Header user={user} onLogout={handleLogout} />
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <aside className="lg:col-span-3 lg:sticky lg:top-24 no-print">
            <SidebarProfile user={user} />
          </aside>
          <section className="lg:col-span-9 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-2 shadow-sm flex space-x-1 overflow-x-auto no-print" data-testid="tab-navigation">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  data-testid={`tab-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm transition whitespace-nowrap ${
                    tab === t.id
                      ? "text-emerald-700 bg-emerald-50 font-semibold"
                      : "text-gray-500 hover:text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {tab === "dashboard" && <DashboardTab />}
                {tab === "planning" && <RabTab />}
                {tab === "aiperencanaan" && <KakTab />}
                {tab === "realisasi" && <RealisasiTab />}
                {tab === "laporan" && <LaporanTab />}
                {tab === "persetujuan" && <PersetujuanTab />}
              </motion.div>
            </AnimatePresence>
          </section>
        </div>
      </main>
    </div>
  );
}
