import React from 'react';
import { useApp } from '../contexts/AppContext';
import { Project } from '../types';
import TaskRow from '../components/ui/TaskRow';
import Avatar from '../components/ui/Avatar';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { state, today } = useApp();
  const navigate = useNavigate();

  if (!state) return null;

  const isOverdue = (d: string) => d && d < today;

  const activeProjects = state.projects.filter(p => p.status !== 'completed');
  const activeTasks = state.tasks.filter(t => {
    const p = state.projects.find(proj => proj.name === t.project);
    return !p || p.status !== 'completed';
  });

  const total = activeTasks.length;
  const done = activeTasks.filter(t => t.status === 'done').length;
  const ov = activeTasks.filter(t => t.status !== 'done' && isOverdue(t.due)).length;
  const activeCount = activeProjects.filter(p => p.status === 'active').length;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="metrics">
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-folder" style={{ color: '#185FA5' }}></i>Projects</div>
          <div className="metric-value">{activeProjects.length}</div>
          <div className="metric-sub">{activeCount} active</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-checkbox" style={{ color: '#1D9E75' }}></i>Done</div>
          <div className="metric-value">{done}</div>
          <div className="metric-sub">of {total} tasks</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-clock" style={{ color: '#185FA5' }}></i>In progress</div>
          <div className="metric-value">{total - done}</div>
          <div className="metric-sub">remaining</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-alert-circle" style={{ color: '#A32D2D' }}></i>Overdue</div>
          <div className="metric-value" style={ov > 0 ? { color: '#A32D2D' } : {}}>{ov}</div>
          <div className="metric-sub">{ov > 0 ? 'needs attention' : 'all on track'}</div>
        </div>
      </div>

      <div className="section-header">
        <div className="section-title">Projects</div>
        <button className="btn text-[11px] py-1 px-[9px]" onClick={() => navigate('/projects')}>See all</button>
      </div>

      <div className="projects-grid">
        {activeProjects.slice(0, 4).map((p: Project) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>

      <div className="section-header mt-4">
        <div className="section-title">Recent tasks</div>
      </div>
      <div className="tasks-panel text-left">
        <div className="task-list">
          {activeTasks.slice(0, 5).map((t: Task) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const { state } = useApp();
  const navigate = useNavigate();
  
  if (!state) return null;

  const pt = state.tasks.filter(t => t.project === project.name);
  const done = pt.filter(t => t.status === 'done').length;
  const badges: any = { 
    active: 'badge-active Active', 
    review: 'badge-review In Review', 
    planning: 'badge-planning Planning', 
    done: 'badge-done Done' 
  };
  const [bClass, bText] = (badges[project.status] || 'badge-done ' + project.status).split(' ');

  return (
    <div className="project-card" onClick={() => navigate(`/tasks?project=${encodeURIComponent(project.name)}`)}>
      <div className="project-header">
        <div className="project-name">{project.name}</div>
        <span className={`project-badge ${bClass}`}>{bText}</span>
      </div>
      <div className="project-desc">{project.desc}</div>
      <div className="progress-bar"><div className="progress-fill" style={{ width: `${project.progress}%` }}></div></div>
      <div className="progress-row"><span>{done}/{pt.length} tasks</span><span>{project.progress}%</span></div>
      <div className="flex justify-between items-center">
        <div className="avatars">{project.members.map((m: string) => <Avatar key={m} initials={m} />)}</div>
        <span className="text-[10px] text-slate-400">{project.members.length} members</span>
      </div>
    </div>
  );
}
