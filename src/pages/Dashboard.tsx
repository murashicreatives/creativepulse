import React from 'react';
import { useApp } from '../contexts/AppContext';
import { Project, Task } from '../types';
import TaskRow from '../components/ui/TaskRow';
import Avatar from '../components/ui/Avatar';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { state, today } = useApp();
  const navigate = useNavigate();

  if (!state) return null;

  const activeProjects = state.projects.filter(p => p.status !== 'completed');
  
  if (state.projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in duration-700">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-300">
          <i className="ti ti-folder-off text-4xl"></i>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">No projects found</h2>
        <p className="text-slate-500 text-sm max-w-sm mb-8">
          We couldn't find any projects in your workspace. If you created them recently, they might still be syncing.
        </p>
        <div className="flex gap-4">
          <button 
            className="btn btn-primary px-6" 
            onClick={() => window.location.reload()}
          >
            <i className="ti ti-refresh mr-2"></i> Refresh Data
          </button>
          <button 
             className="btn bg-white border-slate-200" 
             onClick={() => navigate('/projects')}
          >
            Go to Projects
          </button>
        </div>
      </div>
    );
  }

  const isOverdue = (d: string) => d && d < today;

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
        {activeProjects.slice(0, 4).map((p: any) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>

      <div className="section-header mt-4">
        <div className="section-title">Recent tasks</div>
      </div>
      <div className="tasks-panel text-left">
        <div className="task-list">
          {activeTasks.slice(0, 5).map((t: any) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project, key?: any }) {
  const { state } = useApp();
  const navigate = useNavigate();
  
  if (!state) return null;

  const pt = state.tasks.filter(t => t.project === project.name);
  const done = pt.filter(t => t.status === 'done').length;
  const progressPercent = pt.length > 0 ? Math.round((done / pt.length) * 100) : 0;
  
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
      <div className="progress-bar"><div className="progress-fill" style={{ width: `${progressPercent}%` }}></div></div>
      <div className="progress-row"><span>{done}/{pt.length} tasks</span><span>{progressPercent}%</span></div>
      <div className="flex justify-between items-center">
        <div className="avatars">{project.members.map((m: any) => <Avatar key={m} initials={m} />)}</div>
        <span className="text-[10px] text-slate-400">{project.members.length} members</span>
      </div>
    </div>
  );
}
