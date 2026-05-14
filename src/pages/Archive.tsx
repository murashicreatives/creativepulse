import React from 'react';
import { useApp } from '../contexts/AppContext';
import { useNavigate } from 'react-router-dom';

export default function Archive() {
  const { state } = useApp();
  const navigate = useNavigate();

  if (!state) return null;

  const completed = state.projects.filter(p => p.status === 'completed');

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div className="section-title">Archive ({completed.length})</div>
      </div>
      <div className="projects-grid">
        {completed.map(p => (
          <div key={p.id} className="project-card opacity-80 hover:opacity-100" onClick={() => navigate(`/tasks?project=${encodeURIComponent(p.name)}`)}>
             <div className="project-header text-left">
               <div className="project-name">{p.name}</div>
               <span className="project-badge badge-done">Completed</span>
             </div>
             <div className="project-desc text-left">{p.desc}</div>
             <div className="progress-row mt-4"><span>Archive date</span><span>{p.completedAt ? new Date(p.completedAt).toLocaleDateString() : 'N/A'}</span></div>
          </div>
        ))}
        {completed.length === 0 && <div className="col-span-full p-12 text-center text-slate-400 border-[0.5px] border-dashed border-slate-300 rounded-xl">No archived projects</div>}
      </div>
    </div>
  );
}
