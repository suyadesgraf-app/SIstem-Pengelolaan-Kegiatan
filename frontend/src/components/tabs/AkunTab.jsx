import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useAuth, ROLE_LABELS } from "@/context/AuthContext";

export default function AkunTab() {
  const { user } = useAuth();
  const targetLabel = user.role === "superadmin" ? "PIC Kegiatan" : "Relawan Lapangan";
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const load = () => api.get("/users").then((r) => setAccounts(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      return toast.warning("Lengkapi nama, email, dan kata sandi");
    }
    try {
      await api.post("/users", form);
      setForm({ name: "", email: "", password: "" });
      load();
      toast.success(`Akun ${targetLabel} berhasil dibuat`);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const inputCls = "w-full text-xs border border-gray-300 rounded-lg p-2.5 bg-white outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm" data-testid="akun-tab">
      <h2 className="font-heading text-lg font-bold text-gray-800 mb-1">Kelola Akun {targetLabel}</h2>
      <p className="text-sm text-gray-500 mb-5">
        {user.role === "superadmin"
          ? "Super Admin membuat akun PIC. Setiap PIC mengelola kegiatan dan relawannya masing-masing."
          : "PIC membuat akun relawan. Relawan hanya dapat input laporan nota keuangan untuk kegiatan Anda."}
      </p>

      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3" data-testid="akun-create-form">
        <input data-testid="akun-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama lengkap" className={inputCls} />
        <input data-testid="akun-email-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className={inputCls} />
        <input data-testid="akun-password-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Kata sandi (min. 6 karakter)" className={inputCls} />
        <button data-testid="akun-create-button" onClick={create} className="bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-xs font-bold py-2.5 px-4 rounded-lg transition flex items-center justify-center space-x-1.5">
          <UserPlus className="w-4 h-4" /><span>Buat Akun {targetLabel}</span>
        </button>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <table className="w-full text-xs text-left text-gray-700" data-testid="akun-table">
          <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
            <tr>
              <th className="p-3">Nama</th>
              <th className="p-3">Email</th>
              <th className="p-3">Peran</th>
              <th className="p-3">Dibuat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {accounts.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50 transition" data-testid={`akun-row-${a.email}`}>
                <td className="p-3 font-bold text-gray-800">{a.name}</td>
                <td className="p-3">{a.email}</td>
                <td className="p-3">
                  <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-emerald-50 text-emerald-800">
                    {ROLE_LABELS[a.role] || a.role}
                  </span>
                </td>
                <td className="p-3 text-gray-500">{a.created_at ? new Date(a.created_at).toLocaleDateString("id-ID") : "-"}</td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr><td colSpan="4" className="p-6 text-center text-gray-400" data-testid="akun-empty">Belum ada akun. Buat akun pertama di atas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
