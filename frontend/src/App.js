import "@/App.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Lenis from "lenis";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import RelawanApp from "@/pages/RelawanApp";

function useLenis() {
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.12 });
    let raf;
    const loop = (time) => { lenis.raf(time); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);
}

function Splash() {
  return (
    <div className="min-h-screen bg-appbg flex items-center justify-center">
      <div data-testid="app-loading-spinner" className="w-10 h-10 rounded-full border-4 border-emerald-700 border-t-transparent animate-spin" />
    </div>
  );
}

function HomeGate() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "relawan") return <Navigate to="/relawan" replace />;
  return <Dashboard />;
}

function RelawanGate() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  return <RelawanApp />;
}

export default function App() {
  useLenis();
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<HomeGate />} />
          <Route path="/relawan" element={<RelawanGate />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" richColors closeButton />
    </AuthProvider>
  );
}
