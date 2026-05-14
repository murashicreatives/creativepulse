import React from 'react';
import { useApp } from '../contexts/AppContext';
import { Project } from '../types';
import Avatar from '../components/ui/Avatar';
import { useNavigate } from 'react-router-dom';

export default function Projects() {
  const { state } = useApp();
  const navigate = useNavigate();

  if (!state) return null;

  const active = state.projects.filter(p => p.status !== 'completed');

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div className="section-title">Active projects ({active.length})</div>
      </div>
      <div className="projects-grid">
         {active.map((p: any) => (
           <ProjectItem key={p.id} project={p} onClick={() => navigate(`/tasks?project=${encodeURIComponent(p.name)}`)} />
         ))}
         {active.length === 0 && <div className="col-span-full p-12 text-center text-slate-400 border-[0.5px] border-dashed border-slate-300 rounded-xl">No active projects</div>}
      </div>
    </div>
  );
}

function ProjectItem({ project, onClick }: { project: Project, onClick: () => void, key?: any }) {
  const { state } = useApp();
  const pt = state?.tasks.filter(t => t.project === project.name) || [];
  const done = pt.filter(t => t.status === 'done').length;
  const progressPercent = pt.length > 0 ? Math.round((done / pt.length) * 100) : 0;

  return (
    <div className="project-card" onClick={onClick}>
      <div className="project-header text-left">
        <div className="project-name">{project.name}</div>
        <ProjectBadge status={project.status} />
      </div>
      <div className="project-desc text-left">{project.desc}</div>
      <div className="progress-bar"><div className="progress-fill" style={{ width: `${progressPercent}%` }}></div></div>
      <div className="progress-row"><span>Progress</span><span>{progressPercent}%</span></div>
      <div className="flex justify-between items-center">
        <div className="avatars">
           {project.members.map((m: any) => (
             <Avatar key={m} initials={m} />
           ))}
        </div>
        <span className="text-[10px] text-slate-400">{project.members.length} members</span>
      </div>
    </div>
  );
}

function ProjectBadge({ status }: { status: string }) {
  const badges: any = { active: 'badge-active Active', review: 'badge-review In Review', planning: 'badge-planning Planning', done: 'badge-done Done' };
  const [bClass, bText] = (badges[status] || 'badge-done ' + status).split(' ');
  return <span className={`project-badge ${bClass}`}>{bText}</span>;
}
