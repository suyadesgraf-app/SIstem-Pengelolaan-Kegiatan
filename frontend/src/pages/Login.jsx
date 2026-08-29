import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

const HERO_IMG = "https://images.unsplash.com/photo-1689443111287-5c2e129ec756?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjd8MHwxfHNlYXJjaHwyfHxncmVlbiUyMGdlb21ldHJpYyUyMGJhY2tncm91bmR8ZW58MHx8fHwxNzg4MDIzODgxfDA&ixlib=rb-4.1.0&q=85";

const DEMO = [
  { label: "Super Admin", email: "superadmin@baznas.id", password: "admin123" },
  { label: "Admin / PIC", email: "pic@baznas.id", password: "pic12345" },
  { label: "Relawan", email: "relawan@baznas.id", password: "relawan123" },
];

const HEADLINES = ["Sistem Integrasi", "Pengelolaan", "Program & Kegiatan"];
const MARQUEE = ["AMANAH", "TRANSPARAN", "AKUNTABEL", "PROFESIONAL", "BERKEADILAN", "SIAP MELAYANI"];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Selamat datang, ${user.name}`);
      navigate(user.role === "relawan" ? "/relawan" : "/");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-950 lg:grid lg:grid-cols-2" data-testid="login-page">
      {/* HERO */}
      <div className="relative overflow-hidden hidden lg:flex flex-col justify-between p-14 grain">
        <motion.img
          src={HERO_IMG}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-40"
          initial={{ scale: 1.15, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.4 }}
          transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/70 via-emerald-950/40 to-emerald-950" />
        <div className="relative z-10 flex items-center space-x-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-emerald-300" />
          </div>
          <div>
            <p className="font-heading font-800 font-extrabold text-white text-sm tracking-wide">BAZNAS BAZIS</p>
            <p className="text-emerald-300/80 text-[11px] font-medium">Provinsi DKI Jakarta</p>
          </div>
        </div>
        <div className="relative z-10">
          <h1 className="font-heading font-extrabold text-white text-5xl xl:text-6xl leading-[1.05] tracking-tight">
            {HEADLINES.map((line, i) => (
              <span key={i} className="block overflow-hidden pb-1">
                <motion.span
                  className="block"
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.25 + i * 0.15, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p
            className="mt-6 text-emerald-100/70 text-sm max-w-md leading-relaxed"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.7 }}
          >
            Satu pintu untuk perencanaan KAK & RAB, realisasi nota lapangan berbasis AI OCR,
            hingga persetujuan laporan — cepat, tercatat, dan akuntabel.
          </motion.p>
        </div>
        <div className="relative z-10 overflow-hidden border-t border-emerald-400/20 pt-5">
          <div className="marquee-track space-x-8 text-emerald-300/60 text-xs font-heading font-bold tracking-[0.3em]">
            {[...MARQUEE, ...MARQUEE].map((w, i) => (
              <span key={i} className="flex items-center space-x-8">
                <span>{w}</span><span className="text-emerald-500/40">•</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* FORM */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-appbg min-h-screen lg:min-h-0">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center space-x-3 mb-8">
            <img
              src="https://baznasbazisdki.id/assets/img/logo-dark-min.png"
              alt="Logo BAZNAS DKI"
              className="h-10 w-auto object-contain"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
            <div className="border-l border-gray-200 pl-3">
              <p className="font-heading font-bold text-sm text-gray-800 leading-tight">BAZNAS BAZIS DKI</p>
              <p className="text-[11px] text-gray-500 font-medium">Sistem Integrasi Pengelolaan Program/Kegiatan</p>
            </div>
          </div>

          <h2 className="font-heading font-extrabold text-2xl text-gray-900 tracking-tight">Masuk ke Akun Anda</h2>
          <p className="text-sm text-gray-500 mt-1 mb-7">Gunakan akun sesuai peran Anda di lapangan.</p>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@baznas.id" data-testid="login-email-input"
                  className="w-full text-sm border border-gray-300 rounded-xl pl-10 pr-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Kata Sandi</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" data-testid="login-password-input"
                  className="w-full text-sm border border-gray-300 rounded-xl pl-10 pr-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition"
                />
              </div>
            </div>
            {error && (
              <div data-testid="login-error" className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            <button
              type="submit" disabled={loading} data-testid="login-submit-button"
              className="w-full bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white font-heading font-bold py-3.5 rounded-xl text-sm transition flex items-center justify-center space-x-2 shadow-sm disabled:opacity-60"
            >
              <span>{loading ? "Memeriksa..." : "Masuk"}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Akun Demo (klik untuk mengisi)</p>
            <div className="flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  data-testid={`demo-fill-${d.label.toLowerCase().replace(/[^a-z]/g, "-")}`}
                  onClick={() => { setEmail(d.email); setPassword(d.password); }}
                  className="text-xs font-semibold px-3.5 py-2 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
