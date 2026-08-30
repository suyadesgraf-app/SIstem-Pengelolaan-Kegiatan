import { UserRound } from "lucide-react";
import { ROLE_LABELS, ROLE_DESCS } from "@/context/AuthContext";
import { PoweredByChengSuya } from "@/components/PoweredByChengSuya";

export default function SidebarProfile({ user }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col items-center text-center shadow-sm min-h-[430px]" data-testid="sidebar-profile-card">
      <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-2xl flex justify-center items-center mb-4 border border-emerald-200">
        <UserRound className="w-10 h-10" />
      </div>
      <h2 className="font-heading font-bold text-lg text-gray-800" data-testid="sidebar-profile-name">{user.name}</h2>
      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full mt-1 mb-5" data-testid="sidebar-role-badge">
        {ROLE_LABELS[user.role] || user.role}
      </span>
      <div className="w-full pt-5 border-t border-gray-100 text-left">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Hak Akses Peran</p>
        <p className="text-[11px] text-gray-500 leading-relaxed" data-testid="sidebar-role-desc">{ROLE_DESCS[user.role]}</p>
      </div>
      <div className="w-full pt-4 mt-4 border-t border-gray-100 text-left space-y-2">
        <div className="flex justify-between text-[11px]">
          <span className="text-gray-400 font-semibold">Email</span>
          <span className="text-gray-700 font-medium truncate max-w-[150px]">{user.email}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-gray-400 font-semibold">Unit</span>
          <span className="text-gray-700 font-medium">BAZNAS BAZIS DKI</span>
        </div>
      </div>
      <div className="w-full pt-4 mt-auto border-t border-gray-100 flex justify-start" data-testid="sidebar-powered-by-section">
        <PoweredByChengSuya context="sidebar" />
      </div>
    </div>
  );
}
