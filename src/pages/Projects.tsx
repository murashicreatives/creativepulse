import React from 'react';
import { useApp } from '../contexts/AppContext';
import { Project } from '../types';
import Avatar from '../components/ui/Avatar';
import { useNavigate } from 'react-router-dom';

export default function Projects() {
  const { state, setModal, userPerms } = useApp();
  const navigate = useNavigate();

  if (!state) return null;

  const active = state.projects.filter(p => p.status !== 'completed');

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Projects</h1>
          <p className="text-slate-500 text-sm">Manage your workspace development initiatives</p>
        </div>
        {userPerms.create && (
          <button className="btn btn-primary" onClick={() => setModal({ type: 'project' })}>
            <i className="ti ti-plus"></i> New Project
          </button>
        )}
      </div>
      <div className="projects-grid">
         {active.map((p: any) => (
           <ProjectItem key={p.id} project={p} onClick={() => navigate(`/tasks?project=${encodeURIComponent(p.name)}`)} />
         ))}
         {active.length === 0 && <div className="col-span-full p-20 text-center text-slate-400 border-[0.5px] border-dashed border-slate-200 rounded-2xl bg-white/50">No active projects found</div>}
      </div>
    </div>
  );
}

function ProjectItem({ project, onClick }: { project: Project, onClick: () => void, key?: any }) {
  const { state, userPerms, setModal } = useApp();
  const pt = state?.tasks.filter(t => t.project === project.name) || [];
  const done = pt.filter(t => t.status === 'done').length;
  const progressPercent = pt.length > 0 ? Math.round((done / pt.length) * 100) : 0;

  return (
    <div className="project-card group relative" onClick={onClick}>
      <div className="project-header text-left">
        <div className="project-name">{project.name}</div>
        <div className="flex items-center gap-2">
          <ProjectBadge status={project.status} />
          {userPerms.edit && (
            <button 
              className="p-1.5 rounded-full hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity" 
              onClick={(e) => {
                e.stopPropagation();
                setModal({ type: 'project', data: project });
              }}
            >
              <i className="ti ti-edit text-slate-400"></i>
            </button>
          )}
        </div>
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
