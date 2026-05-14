import React from 'react';
import { useApp } from '../contexts/AppContext';
import { Project, Task } from '../types';
import TaskRow from '../components/ui/TaskRow';
import Avatar from '../components/ui/Avatar';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function Dashboard() {
  const { state, today, currentUser } = useApp();
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

  const totalCount = activeTasks.length;
  const doneCount = activeTasks.filter(t => t.status === 'done').length;
  const ov = activeTasks.filter(t => t.status !== 'done' && isOverdue(t.due)).length;
  const activeCount = activeProjects.filter(p => p.status === 'active').length;

  // Prepare chart data
  const chartData = activeProjects.slice(0, 6).map(p => {
    const pt = state.tasks.filter(t => t.project === p.name);
    const done = pt.filter(t => t.status === 'done').length;
    const progress = pt.length > 0 ? Math.round((done / pt.length) * 100) : 0;
    return { name: p.name, progress, color: p.color || '#6366f1' };
  });

  // Mock activity feed based on actual data
  const recentActivity = state.tasks
    .filter(t => t.status === 'done' || (t.comments && t.comments.length > 0))
    .slice(0, 5)
    .map(t => {
      if (t.status === 'done') {
        return {
          id: t.id,
          user: t.assignee,
          text: `completed task: ${t.name}`,
          time: 'Recently',
          icon: 'checkbox',
          color: '#10b981'
        };
      }
      const lastComment = t.comments[t.comments.length - 1];
      return {
        id: t.id + '-comment',
        user: lastComment.author,
        text: `commented on ${t.name}: "${lastComment.text.substring(0, 30)}${lastComment.text.length > 30 ? '...' : ''}"`,
        time: lastComment.time,
        icon: 'message',
        color: '#6366f1'
      };
    });

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-end mb-8 px-1">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bonjour, {currentUser?.name.split(' ')[0]}</h1>
          <p className="text-slate-500 text-sm mt-1">Here is what's happening in your workspace today.</p>
        </div>
        <div className="hidden md:block text-right">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Today</div>
          <div className="text-sm font-semibold text-slate-700">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>

      <div className="metrics mb-8">
        <div className="metric-card shadow-sm hover:shadow-md transition-shadow">
          <div className="metric-label"><i className="ti ti-folder text-indigo-500"></i>Projects</div>
          <div className="metric-value">{activeProjects.length}</div>
          <div className="metric-sub">{activeCount} active now</div>
        </div>
        <div className="metric-card shadow-sm hover:shadow-md transition-shadow">
          <div className="metric-label"><i className="ti ti-checkbox text-emerald-500"></i>Tasks Done</div>
          <div className="metric-value">{doneCount}</div>
          <div className="metric-sub">of {totalCount} total tasks</div>
        </div>
        <div className="metric-card shadow-sm hover:shadow-md transition-shadow">
          <div className="metric-label"><i className="ti ti-clock text-blue-500"></i>In Progress</div>
          <div className="metric-value">{totalCount - doneCount}</div>
          <div className="metric-sub">assigned tasks</div>
        </div>
        <div className="metric-card shadow-sm hover:shadow-md transition-shadow border-red-50">
          <div className="metric-label"><i className="ti ti-alert-circle text-rose-500"></i>Overdue</div>
          <div className="metric-value text-rose-600">{ov}</div>
          <div className="metric-sub">{ov > 0 ? 'needs attention' : 'on track'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Progress Chart */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider flex items-center gap-2">
              <i className="ti ti-chart-bar text-indigo-500 text-base"></i> Project Progress (%)
            </h3>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8' }} 
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                  />
                  <Bar dataKey="progress" radius={[4, 4, 0, 0]} barSize={32}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <div className="section-header mb-4">
              <div className="section-title text-slate-800 font-bold">Featured Projects</div>
              <button className="text-indigo-600 text-xs font-bold hover:underline bg-transparent border-none" onClick={() => navigate('/projects')}>View all</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeProjects.slice(0, 4).map((p: any) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full">
            <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-wider flex items-center gap-2">
              <i className="ti ti-history text-indigo-500 text-base"></i> Recent Activity
            </h3>
            <div className="space-y-6 flex-1">
              {recentActivity.length > 0 ? recentActivity.map((act) => (
                <div key={act.id} className="flex gap-4 group">
                  <div className="relative">
                    <Avatar initials={act.user} />
                    <div 
                      className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center text-[8px]"
                      style={{ backgroundColor: act.color, color: 'white' }}
                    >
                      <i className={`ti ti-${act.icon}`}></i>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] text-slate-600 leading-snug">
                      <span className="font-bold text-slate-900">{state.people.find(p => p.initials === act.user)?.name || act.user}</span> {act.text}
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium group-hover:text-slate-500 transition-colors">{act.time}</span>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-10 opacity-40">
                  <i className="ti ti-ghost text-4xl mb-2"></i>
                  <p className="text-xs">Quiet day today...</p>
                </div>
              )}
            </div>
            <button className="w-full py-2.5 mt-6 border-t border-slate-50 text-[11px] font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">
              View Audit Log
            </button>
          </div>
        </div>
      </div>

      <div className="section-header mb-4">
        <div className="section-title text-slate-800 font-bold">Priority Tasks</div>
      </div>
      <div className="tasks-panel border-none shadow-sm overflow-visible bg-transparent">
        <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
          {activeTasks.filter(t => t.priority === 'high' && t.status !== 'done').slice(0, 5).map((t: any) => (
            <TaskRow key={t.id} task={t} />
          ))}
          {activeTasks.filter(t => t.priority === 'high' && t.status !== 'done').length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs italic">All high priority tasks are handled!</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project, key?: any }) {
  const { state, setModal, userPerms } = useApp();
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
    <div className="project-card group relative" onClick={() => navigate(`/tasks?project=${encodeURIComponent(project.name)}`)}>
      <div className="project-header">
        <div className="project-name">{project.name}</div>
        <div className="flex items-center gap-2">
          <span className={`project-badge ${bClass}`}>{bText}</span>
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
      <div className="project-desc">{project.desc}</div>
      <div className="progress-bar mt-2"><div className="progress-fill" style={{ width: `${progressPercent}%`, backgroundColor: project.color }}></div></div>
      <div className="progress-row mt-1"><span>{done}/{pt.length} tasks</span><span>{progressPercent}%</span></div>
      <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50">
        <div className="avatars">{project.members.map((m: any) => <Avatar key={m} initials={m} />)}</div>
        <span className="text-[10px] text-slate-400 font-medium">{project.members.length} contributors</span>
      </div>
    </div>
  );
}
