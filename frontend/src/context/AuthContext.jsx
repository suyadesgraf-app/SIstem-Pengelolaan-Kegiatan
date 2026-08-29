import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const r = await api.post("/auth/login", { email, password });
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch (e) { /* ignore */ }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const ROLE_LABELS = {
  superadmin: "Super Admin / Pimpinan",
  pic: "Admin / PIC Kegiatan",
  relawan: "Relawan Lapangan",
};

export const ROLE_DESCS = {
  superadmin: "Memiliki akses global dashboard analitik dan pengesahan tingkat akhir.",
  pic: "Mengelola RAB, memverifikasi laporan relawan, dan submit laporan.",
  relawan: "Akses terbatas untuk input realisasi via OCR dan form lapangan.",
};
