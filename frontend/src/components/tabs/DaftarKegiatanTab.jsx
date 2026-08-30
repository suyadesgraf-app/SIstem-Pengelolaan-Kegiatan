import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Search } from "lucide-react";
import api from "@/lib/api";
import ProjectCard from "@/components/ProjectCard";

const isCompletedProject = (project) => ["Selesai", "Diverifikasi"].includes(project.status);

const sortNewest = (items) => [...items].sort((a, b) => {
  const dateA = Date.parse(a.created_at || "") || 0;
  const dateB = Date.parse(b.created_at || "") || 0;
  if (dateA !== dateB) return dateB - dateA;
  return String(b.nomor_indeks || "").localeCompare(String(a.nomor_indeks || ""));
});

export default function DaftarKegiatanTab() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.get("/projects").then((r) => setProjects(r.data)).catch(() => {});
  }, []);

  const completedProjects = sortNewest(projects.filter(isCompletedProject));
  const keyword = query.trim().toLowerCase();
  const visibleProjects = keyword
    ? completedProjects.filter((project) => [project.name, project.nomor_indeks, project.loc, project.date, project.status].some((value) => String(value || "").toLowerCase().includes(keyword)))
    : completedProjects;

  return (
    <div className="space-y-6" data-testid="daftar-kegiatan-tab">
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Arsip Kegiatan Selesai</span>
          </div>
          <h2 className="font-heading text-lg font-bold text-gray-800" data-testid="completed-projects-heading">Daftar Kegiatan</h2>
          <p className="text-xs text-gray-500 mt-1" data-testid="completed-projects-summary">{completedProjects.length} kegiatan selesai tersimpan.</p>
        </div>
        <label className="relative w-full md:w-72" data-testid="completed-projects-search-wrapper">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            data-testid="completed-projects-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama / nomor indeks"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 py-2.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
          />
        </label>
      </div>

      <div className="space-y-4" data-testid="completed-project-list">
        {visibleProjects.map((project, index) => (
          <ProjectCard key={project.id} project={project} index={index} onOpen={(item) => navigate(`/kegiatan/${item.id}`)} />
        ))}
        {visibleProjects.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10" data-testid="completed-project-list-empty">
            Belum ada kegiatan selesai.
          </p>
        )}
      </div>
    </div>
  );
}