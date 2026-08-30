import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquareText, RotateCcw } from "lucide-react";
import api, { formatApiError } from "@/lib/api";

const STATUS_STYLE = {
  Selesai: "bg-emerald-100 text-emerald-800",
  Menunggu: "bg-amber-100 text-amber-800",
  Diverifikasi: "bg-blue-100 text-blue-800",
  Perencanaan: "bg-sky-100 text-sky-800",
};

export default function PersetujuanTab() {
  const [projects, setProjects] = useState([]);
  const [revisionMessages, setRevisionMessages] = useState({});

  const load = () => api.get("/projects").then((r) => setProjects(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const approve = async (p) => {
    try {
      await api.post(`/projects/${p.id}/approve`);
      toast.success("Dokumen disahkan!");
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const revise = async (p) => {
    try {
      await api.post(`/projects/${p.id}/revise`, { message: revisionMessages[p.id] || "" });
      toast.success("Dikembalikan untuk revisi. PIC telah diberi tahu.");
      setRevisionMessages((prev) => ({ ...prev, [p.id]: "" }));
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm" data-testid="persetujuan-tab">
      <h2 className="font-heading text-lg font-bold text-gray-800 mb-4">Antrean Persetujuan Laporan (Approval Flow)</h2>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm text-left text-gray-600" data-testid="approval-table">
          <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
            <tr>
              <th className="p-4">Nomor Indeks & Kegiatan</th>
              <th className="p-4">Sisa Waktu SLA</th>
              <th className="p-4">Status</th>
              <th className="p-4">Pesan Revisi</th>
              <th className="p-4 text-center">Aksi (Pimpinan)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 transition" data-testid={`approval-row-${p.nomor_indeks}`}>
                <td className="p-4 font-bold text-gray-800">{p.nomor_indeks} — {p.name}</td>
                <td className="p-4">
                  <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs font-bold">H+{p.slaDays}</span>
                </td>
                <td className="p-4">
                  <span className={`text-[11px] px-2 py-1 rounded-full font-bold ${STATUS_STYLE[p.status] || "bg-gray-100 text-gray-700"}`}>{p.status}</span>
                </td>
                <td className="p-4 min-w-[260px]">
                  {p.status === "Menunggu" ? (
                    <label className="relative block" data-testid={`approval-revision-message-field-${p.nomor_indeks}`}>
                      <MessageSquareText className="absolute left-3 top-3 w-4 h-4 text-amber-600" />
                      <textarea
                        data-testid={`approval-revision-message-${p.nomor_indeks}`}
                        value={revisionMessages[p.id] || ""}
                        onChange={(e) => setRevisionMessages((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        maxLength={1000}
                        rows={3}
                        placeholder="Tulis poin perbaikan untuk PIC..."
                        className="w-full rounded-xl border border-amber-200 bg-amber-50/60 pl-9 pr-3 py-2 text-xs text-gray-700 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100 resize-none"
                      />
                    </label>
                  ) : (
                    <span className="text-xs text-gray-400" data-testid={`approval-revision-message-disabled-${p.nomor_indeks}`}>-</span>
                  )}
                </td>
                <td className="p-4 text-center">
                  {p.status === "Menunggu" ? (
                    <span className="inline-flex space-x-2">
                      <button
                        data-testid={`approval-approve-${p.nomor_indeks}`}
                        onClick={() => approve(p)}
                        className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition"
                      >
                        Sahkan Dokumen
                      </button>
                      <button
                        data-testid={`approval-revise-${p.nomor_indeks}`}
                        onClick={() => revise(p)}
                        className="bg-amber-100 hover:bg-amber-200 active:scale-95 text-amber-800 text-xs px-3 py-1.5 rounded-lg font-semibold transition inline-flex items-center space-x-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Minta Revisi</span>
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Tidak ada aksi</span>
                  )}
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr><td colSpan="5" className="p-8 text-center text-gray-400" data-testid="approval-empty">Belum ada antrean persetujuan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
