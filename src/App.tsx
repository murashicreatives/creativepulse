/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AppState, Project, Task, Person, Comment } from './types';
import { supabase } from './lib/supabase';

const COLORS = [
  { bg: '#E6F1FB', txt: '#0C447C' },
  { bg: '#EAF3DE', txt: '#3B6D11' },
  { bg: '#FAEEDA', txt: '#854F0B' },
  { bg: '#FBEAF0', txt: '#72243E' },
  { bg: '#EEEDFE', txt: '#3C3489' },
  { bg: '#FAECE7', txt: '#712B13' }
];

const DEFAULT_DATA = (workspaceId: string): AppState => ({
  workspace_id: workspaceId,
  projects: [],
  tasks: [],
  people: []
});

const PERMISSIONS = {
  admin: { create: true, edit: true, delete: true, manageTeam: true },
  editor: { create: true, edit: true, delete: false, manageTeam: false },
  viewer: { create: false, edit: false, delete: false, manageTeam: false }
};

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [view, setView] = useState('dashboard');
  const [taskTab, setTaskTab] = useState('all');
  const [filterProject, setFilterProject] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem('user_email'));
  const [modal, setModal] = useState<{ type: string, data?: any } | null>(null);
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [toasts, setToasts] = useState<{ id: number, msg: string }[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isKanbanExpanded, setIsKanbanExpanded] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const currentUser = state?.people.find(p => p.email === userEmail);
  const userPerms = currentUser ? (PERMISSIONS[currentUser.permissions] || PERMISSIONS.viewer) : PERMISSIONS.viewer;

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    // Listen for auth changes to sync profile and initials
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const email = session.user.email;
        if (!email) return;

        // Fetch profile with workspace_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email)
          .single();

        if (profile) {
          setUserEmail(email);
          localStorage.setItem('user_email', email);
          
          // Link ID if missing (staff login case)
          if (!profile.id) {
            await supabase.from('profiles').update({ id: session.user.id }).eq('email', email);
          }
        } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          // No profile found yet, might be waiting for signup logic to finish
          setUserEmail(null);
        }
      } else {
        setUserEmail(null);
        localStorage.removeItem('user_email');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!userEmail) return;
      
      try {
        const { data: profile } = await supabase.from('profiles').select('workspace_id').eq('email', userEmail).single();
        if (!profile) return;
        const workspace_id = profile.workspace_id;

        const [pRes, tRes, uRes] = await Promise.all([
          supabase.from('projects').select('*').eq('workspace_id', workspace_id),
          supabase.from('tasks').select('*').eq('workspace_id', workspace_id),
          supabase.from('profiles').select('*').eq('workspace_id', workspace_id)
        ]);

        if (pRes.error || tRes.error || uRes.error) throw new Error('Supabase fetch failed');

        setState({
          workspace_id,
          projects: (pRes.data || []).map(p => ({
            ...p,
            completedAt: p.completed_at
          })) as Project[],
          tasks: (tRes.data || []) as Task[],
          people: (uRes.data || []) as Person[]
        });
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [userEmail]);

  const saveData = useCallback(async (newState: AppState, updatedItem?: { type: 'project' | 'task' | 'person', data: any }) => {
    setSaveStatus('Saving…');
    try {
      if (!updatedItem) {
        // Fallback for full state save (though we prefer targeted updates)
        setSaveStatus('Saved');
        return;
      }

      let error;
      const workspace_id = state.workspace_id;

      if (updatedItem.type === 'project') {
        const dbData = { ...updatedItem.data };
        delete dbData.id;
        const { error: err } = await supabase.from('projects').upsert({
          id: updatedItem.data.id,
          workspace_id,
          name: updatedItem.data.name,
          desc: updatedItem.data.desc,
          status: updatedItem.data.status,
          progress: updatedItem.data.progress,
          members: updatedItem.data.members,
          color: updatedItem.data.color,
          completed_at: updatedItem.data.completedAt
        });
        error = err;
      } else if (updatedItem.type === 'task') {
        const { error: err } = await supabase.from('tasks').upsert({
          ...updatedItem.data,
          workspace_id
        });
        error = err;
      } else if (updatedItem.type === 'person') {
        const { error: err } = await supabase.from('profiles').upsert({
          ...updatedItem.data,
          workspace_id
        });
        error = err;
      }

      if (error) throw error;
      setSaveStatus('Saved');
    } catch (e) {
      console.error(e);
      setSaveStatus('Save failed');
    }
  }, []);

  const updateState = (updater: (prev: AppState) => AppState, updatedItem?: { type: 'project' | 'task' | 'person', data: any }) => {
    if (!state) return;
    const newState = updater(state);
    setState(newState);
    saveData(newState, updatedItem);
  };

  const showToast = (msg: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const notify = (task: Task, type: string) => {
    const msgs: Record<string, string> = {
      status: `Task "${task.name}" moved to ${task.status}.`,
      assign: `Task "${task.name}" assigned to ${task.assignee}.`,
      comment: `New comment on "${task.name}".`
    };
    const body = msgs[type] || 'Notification sent.';
    
    // UI Toast
    showToast(body);

    // Brower Notification
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Creative Pulse", {
        body,
        icon: "/favicon.ico"
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    const f = e.target as any;
    const email = f.email.value;
    const password = f.password.value;
    const workspaceName = isSignUp ? f.workspaceName.value : null;

    try {
      if (isSignUp) {
        // 0. Check if a profile already exists for this email (Staff invite)
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        // 1. Sign Up
        const { data: authData, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (authData.user) {
          if (existingProfile) {
            // STAFF JOIN: Link existing profile to this new auth user
            const { error: linkErr } = await supabase
              .from('profiles')
              .update({ id: authData.user.id })
              .eq('email', email);
            
            if (linkErr) throw linkErr;
            
            const initials = existingProfile.initials;
            if (authData.session) {
               setUserEmail(email);
               localStorage.setItem('user_email', email);
            } else {
              setLoginError('Verification email sent. Please check your inbox.');
            }
          } else {
            // NEW OWNER: Create Workspace and Admin Profile
            const { data: ws, error: wsErr } = await supabase
              .from('workspaces')
              .insert({ name: workspaceName, owner_id: authData.user.id })
              .select()
              .single();
            
            if (wsErr) throw wsErr;

            const initials = email.substring(0, 2).toUpperCase();
            const { error: profErr } = await supabase.from('profiles').insert({
              id: authData.user.id,
              workspace_id: ws.id,
              initials,
              name: email.split('@')[0],
              email,
              role: 'Workspace Owner',
              permissions: 'admin',
              color: COLORS[0]
            });

            if (profErr) throw profErr;

            if (authData.session) {
               setUserEmail(email);
               localStorage.setItem('user_email', email);
            } else {
              setLoginError('Verification email sent. Please check your inbox.');
            }
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // On successful sign in, the onAuthStateChange listener will handle fetching the profile
      }
    } catch (e: any) {
      setLoginError(e.message || 'Authentication failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserEmail(null);
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_initials');
  };

  if (!userEmail) {
    return (
      <div className="login-screen">
        <div className="login-box">
          <div className="login-logo"><i className="ti ti-layout-kanban"></i> Creative Pulse</div>
          <div className="login-title">{isSignUp ? 'Create your workspace account' : 'Sign in to your workspace'}</div>
          
          {loginError && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-medium flex items-center gap-2">
              <i className="ti ti-alert-circle"></i> {loginError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            {isSignUp && (
              <div className="form-group">
                <label className="form-label">Workspace Name</label>
                <input type="text" name="workspaceName" className="form-input" placeholder="Acme Corp" required />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" name="email" className="form-input" placeholder="name@company.com" required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" name="password" className="form-input" placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn btn-primary w-full py-2.5 mt-2" disabled={isLoggingIn}>
              {isLoggingIn ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
            <div className="mt-4 text-[11px] text-center">
              <span className="text-slate-400">{isSignUp ? 'Already have an account?' : 'New here?'} </span>
              <button 
                type="button" 
                className="text-indigo-600 font-medium hover:underline border-none bg-none p-0" 
                onClick={() => { setIsSignUp(!isSignUp); setLoginError(null); }}
              >
                {isSignUp ? 'Sign In' : 'Create Account'}
              </button>
            </div>
            {!isSignUp && (
              <div className="mt-4 text-[10px] text-slate-400 pt-4 border-t border-slate-100 italic text-center">
                Secure enterprise workspace. Please contact your administrator if you cannot sign in.
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  if (!state) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50">
      <div className="text-indigo-600 text-3xl mb-4 animate-bounce"><i className="ti ti-layout-kanban"></i></div>
      <div className="text-slate-500 font-medium">Preparing your workspace...</div>
      <div className="mt-2 w-48 h-1 bg-slate-200 rounded-full overflow-hidden">
        <div className="loading-bar-fill h-full bg-indigo-500 w-1/3 animate-[loading_1.5s_infinite_ease-in-out]"></div>
      </div>
    </div>
  );

  const today = new Date().toISOString().split('T')[0];
  const isOverdue = (d: string) => d && d < today;
  const fmtDate = (d: string) => {
    if (!d) return '';
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
      return d;
    }
  };

  const getColor = (initials: string) => state.people.find(x => x.initials === initials)?.color || COLORS[0];
  
  const Avatar = ({ initials, size = 'sm' }: { initials: string, size?: 'sm' | 'lg' | 'detail', key?: string | number }) => {
    const c = getColor(initials);
    const s = size === 'lg' ? 'w-10 h-10 text-[13px]' : size === 'detail' ? 'w-[22px] h-[22px] text-[9px]' : 'w-5 h-5 text-[8px]';
    return (
      <div 
        className={`${s} rounded-full flex items-center justify-center font-medium shrink-0`}
        style={{ background: c.bg, color: c.txt }}
      >
        {initials}
      </div>
    );
  };

  const NavItem = ({ id, icon, label, active, onClick }: any) => (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      <i className={`ti ti-${icon}`} aria-hidden="true"></i> {label}
    </button>
  );

  const ProjectCard = ({ project }: { project: Project, key?: string | number }) => {
    const pt = state.tasks.filter(t => t.project === project.name);
    const done = pt.filter(t => t.status === 'done').length;
    const badges: any = { active: 'badge-active Active', review: 'badge-review In Review', planning: 'badge-planning Planning', done: 'badge-done Done' };
    const [bClass, bText] = (badges[project.status] || 'badge-done ' + project.status).split(' ');

    return (
      <div className="project-card" onClick={() => { setView(view === 'kanban' ? 'kanban' : 'tasks'); setFilterProject(project.name); setTaskTab('all'); }}>
        <div className="project-header">
          <div className="project-name">{project.name}</div>
          <span className={`project-badge ${bClass}`}>{bText}</span>
        </div>
        <div className="project-desc">{project.desc}</div>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${project.progress}%` }}></div></div>
        <div className="progress-row"><span>{done}/{pt.length} tasks</span><span>{project.progress}%</span></div>
        <div className="flex justify-between items-center">
          <div className="avatars">{project.members.map(m => <Avatar key={m} initials={m} />)}</div>
          <span className="text-[10px] text-slate-400">{project.members.length} members</span>
        </div>
      </div>
    );
  };

  const TaskRow = ({ task }: { task: Task, key?: string | number }) => {
    const ov = task.status !== 'done' && isOverdue(task.due);
    return (
      <div className="task-row" onClick={() => setModal({ type: 'task-detail', data: task })}>
        <div 
          className={`task-check ${task.status === 'done' ? 'done' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!userPerms.edit) {
              showToast('You do not have permission to edit tasks.');
              return;
            }
            updateState(prev => ({
              ...prev,
              tasks: prev.tasks.map(t => t.id === task.id ? { ...t, status: t.status === 'done' ? 'todo' : 'done' } : t)
            }), { type: 'task', data: { ...task, status: task.status === 'done' ? 'todo' : 'done' } });
          }}
        >
          {task.status === 'done' && <i className="ti ti-check" aria-hidden="true"></i>}
        </div>
        <div className="task-info">
          <div className="flex items-center gap-2">
            <div className={`task-name ${task.status === 'done' ? 'done' : ''}`}>{task.name}</div>
          </div>
          <div className="task-meta">
            <span className="task-project-tag">{task.project}</span>
            {task.due && <span className={`task-due ${ov ? 'overdue' : ''}`}><i className="ti ti-calendar" aria-hidden="true"></i> {fmtDate(task.due)}</span>}
            {task.comments.length > 0 && <span className="comment-count"><i className="ti ti-message" aria-hidden="true"></i>{task.comments.length}</span>}
          </div>
        </div>
        <span className={`priority-dot p-${task.priority}`}></span>
        <Avatar initials={task.assignee} />
      </div>
    );
  };

  const Dashboard = () => {
    const activeProjects = state.projects.filter(p => p.status !== 'completed');
    const activeTasks = state.tasks.filter(t => {
      const p = state.projects.find(proj => proj.name === t.project);
      return !p || p.status !== 'completed';
    });

    const total = activeTasks.length, 
          done = activeTasks.filter(t => t.status === 'done').length, 
          ov = activeTasks.filter(t => t.status !== 'done' && isOverdue(t.due)).length, 
          activeCount = activeProjects.filter(p => p.status === 'active').length;
    
    return (
      <>
        <div className="metrics">
          <div className="metric-card"><div className="metric-label"><i className="ti ti-folder" style={{ color: '#185FA5' }}></i>Projects</div><div className="metric-value">{activeProjects.length}</div><div className="metric-sub">{activeCount} active</div></div>
          <div className="metric-card"><div className="metric-label"><i className="ti ti-checkbox" style={{ color: '#1D9E75' }}></i>Done</div><div className="metric-value">{done}</div><div className="metric-sub">of {total} tasks</div></div>
          <div className="metric-card"><div className="metric-label"><i className="ti ti-clock" style={{ color: '#185FA5' }}></i>In progress</div><div className="metric-value">{total - done}</div><div className="metric-sub">remaining</div></div>
          <div className="metric-card"><div className="metric-label"><i className="ti ti-alert-circle" style={{ color: '#A32D2D' }}></i>Overdue</div><div className="metric-value" style={ov > 0 ? { color: '#A32D2D' } : {}}>{ov}</div><div className="metric-sub">{ov > 0 ? 'needs attention' : 'all on track'}</div></div>
        </div>
        <div className="section-header"><div className="section-title">Projects</div><button className="btn text-[11px] py-1 px-[9px]" onClick={() => setView('projects')}>See all</button></div>
        <div className="projects-grid">{activeProjects.slice(0, 4).map(p => <ProjectCard key={p.id} project={p} />)}</div>
        <div className="section-header mt-4"><div className="section-title">Recent tasks</div></div>
        <div className="tasks-panel text-left"><div className="task-list">{activeTasks.slice(0, 5).map(t => <TaskRow key={t.id} task={t} />)}</div></div>
      </>
    );
  };

  const Kanban = () => {
    const cols = [{ id: 'todo', label: 'To do', color: '#888' }, { id: 'inprogress', label: 'In progress', color: '#185FA5' }, { id: 'done', label: 'Done', color: '#1D9E75' }];
    const tasks = filterProject ? state.tasks.filter(t => t.project === filterProject) : state.tasks;

    const moveTask = (task: Task, status: string) => {
      if (!userPerms.edit) {
        showToast('You do not have permission to edit tasks.');
        return;
      }
      updateState(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === task.id ? { ...t, status: status as any } : t)
      }), { type: 'task', data: { ...task, status: status as any } });
      notify({ ...task, status: status as any }, 'status');
    };

    return (
      <div className="h-full overflow-hidden pb-1 flex flex-col">
        <div className="section-header mb-3">
          <div className="flex items-center gap-2">
            <div className="section-title">{filterProject ? filterProject + ' — Kanban' : 'Kanban board'}</div>
            <button 
              className={`btn text-[10px] py-0.5 px-1.5 ${isKanbanExpanded ? 'bg-blue-50 border-blue-200 text-blue-600' : ''}`}
              onClick={() => setIsKanbanExpanded(!isKanbanExpanded)}
              title={isKanbanExpanded ? "Exit Meeting Mode" : "Expand for Meeting"}
            >
              <i className={`ti ti-${isKanbanExpanded ? 'minimize' : 'maximize'}`}></i>
              {isKanbanExpanded ? ' Exit Focus' : ' Focus View'}
            </button>
          </div>
          <button className="btn btn-primary text-[11px] py-1 px-[10px]" onClick={() => setModal({ type: 'task' })}><i className="ti ti-plus"></i> Add task</button>
        </div>
        <div className="kanban flex-1">
          {cols.map(col => {
            const ct = tasks.filter(t => t.status === col.id);
            return (
              <div key={col.id} className="kcolumn">
                <div className="kcolumn-header">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: col.color }}></span>{col.label}</span>
                  <span className="kcount">{ct.length}</span>
                </div>
                {ct.map(t => {
                  const ov = isOverdue(t.due);
                  const prevs: any = { todo: '', inprogress: 'todo', done: 'inprogress' };
                  const nexts: any = { todo: 'inprogress', inprogress: 'done', done: '' };
                  return (
                    <div key={t.id} className="kcard" onClick={() => setModal({ type: 'task-detail', data: t })}>
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div className="kcard-name">{t.name}</div>
                      </div>
                      <div className="kcard-project">{t.project}</div>
                      <div className="flex items-center gap-1 mb-2">
                        <span className={`priority-dot p-${t.priority}`}></span>
                        <Avatar initials={t.assignee} />
                        {t.comments.length > 0 && <span className="comment-count text-[10px] flex items-center gap-0.5"><i className="ti ti-message text-[11px]"></i>{t.comments.length}</span>}
                      </div>
                      <div className="kcard-footer">
                        <span className={`kcard-due ${ov ? 'overdue' : ''}`}>{t.due ? fmtDate(t.due) : ''}</span>
                        <div className="flex gap-1">
                          {prevs[t.status] && <button className="kmove-btn" onClick={(e) => { e.stopPropagation(); moveTask(t, prevs[t.status]); }}>←</button>}
                          {nexts[t.status] && <button className="kmove-btn" onClick={(e) => { e.stopPropagation(); moveTask(t, nexts[t.status]); }}>→</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {ct.length === 0 && <div className="text-[11px] text-slate-400 p-2.5 text-center">Empty</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const Tasks = () => {
    const tasks = filterProject ? state.tasks.filter(t => t.project === filterProject) : state.tasks;
    const tabMap: any = { all: tasks, todo: tasks.filter(t => t.status === 'todo'), inprogress: tasks.filter(t => t.status === 'inprogress'), done: tasks.filter(t => t.status === 'done'), overdue: tasks.filter(t => t.status !== 'done' && isOverdue(t.due)) };
    const shown = tabMap[taskTab] || tasks;
    const tabs = [{ id: 'all', label: 'All' }, { id: 'todo', label: 'To do' }, { id: 'inprogress', label: 'In progress' }, { id: 'done', label: 'Done' }, { id: 'overdue', label: 'Overdue' }];

    return (
      <>
        <div className="section-header">
          <div className="section-title">{filterProject ? filterProject + ' — Tasks' : 'All tasks'} ({tasks.length})</div>
          <button className="btn btn-primary text-[11px] py-1 px-[10px]" onClick={() => setModal({ type: 'task' })}><i className="ti ti-plus"></i> Add</button>
        </div>
        <div className="tasks-panel text-left">
          <div className="tasks-tabs">
            {tabs.map(t => (
              <button key={t.id} className={`task-tab ${taskTab === t.id ? 'active' : ''}`} onClick={() => setTaskTab(t.id)}>
                {t.label} <span className="text-slate-400 text-[10px] ml-0.5">{tabMap[t.id].length}</span>
              </button>
            ))}
          </div>
          <div className="task-list">
            {shown.length ? shown.map((t: Task) => <TaskRow key={t.id} task={t} />) : <div className="empty-state"><i className="ti ti-circle-check"></i>Nothing here</div>}
          </div>
        </div>
      </>
    );
  };

  const Team = () => (
    <>
      <div className="section-header">
        <div className="section-title">Team members</div>
        {userPerms.manageTeam && <button className="btn btn-primary text-[11px] py-1 px-[10px]" onClick={() => setModal({ type: 'person' })}><i className="ti ti-user-plus"></i> Add</button>}
      </div>
      <div className="people-grid">
        {state.people.map(p => {
          const a = state.tasks.filter(t => t.assignee === p.initials), d = a.filter(t => t.status === 'done').length;
          return (
            <div key={p.initials} className="person-card relative group">
              {userPerms.manageTeam && (
                <button 
                  className="absolute top-2 right-2 p-1 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-slate-600"
                  onClick={() => setModal({ type: 'person', data: p })}
                >
                  <i className="ti ti-edit text-sm"></i>
                </button>
              )}
              <Avatar initials={p.initials} size="lg" />
              <div className="person-name">{p.name}</div>
              <div className="person-role">{p.role}</div>
              <div className="text-[10px] text-slate-400 mt-1">{p.email}</div>
              <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mt-2 bg-slate-100 rounded px-1.5 py-0.5 inline-block">{p.permissions}</div>
              <div className="person-stats mt-4">
                <div className="pstat"><strong>{a.length}</strong>tasks</div>
                <div className="pstat"><strong>{d}</strong>done</div>
                <div className="pstat"><strong>{a.length - d}</strong>open</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-[20px]"><div className="section-header"><div className="section-title">Open assignments</div></div><div className="tasks-panel text-left"><div className="task-list">{state.tasks.filter(t => t.status !== 'done').map(t => <TaskRow key={t.id} task={t} />)}</div></div></div>
    </>
  );

  const Modal = () => {
    if (!modal) return null;
    const { type, data } = modal;

    if (type === 'task') {
      return (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add task <button className="modal-close" onClick={() => setModal(null)}><i className="ti ti-x"></i></button></div>
            <form onSubmit={e => {
              e.preventDefault();
              const f = e.target as any;
              const newTask: Task = {
                id: Math.max(...state.tasks.map(t => t.id), 0) + 1,
                name: f['f-name'].value,
                project: f['f-project'].value,
                assignee: f['f-assignee'].value,
                due: f['f-due'].value,
                priority: f['f-priority'].value,
                status: 'todo',
                comments: []
              };
              updateState(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }), { type: 'task', data: newTask });
              notify(newTask, 'assign');
              setModal(null);
            }}>
              <div className="form-group"><label className="form-label">Task name</label><input className="form-input" name="f-name" placeholder="What needs to be done?" required /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Project</label><select className="form-select" name="f-project">{state.projects.map(p => <option key={p.id}>{p.name}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Assignee</label><select className="form-select" name="f-assignee">{state.people.map(p => <option key={p.initials} value={p.initials}>{p.name}</option>)}</select></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Due date</label><input type="date" className="form-input" name="f-due" /></div>
                <div className="form-group"><label className="form-label">Priority</label><select className="form-select" name="f-priority"><option value="high">High</option><option value="med" selected>Medium</option><option value="low">Low</option></select></div>
              </div>
              <div className="modal-actions"><button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="btn btn-primary">Add task</button></div>
            </form>
          </div>
        </div>
      );
    }

    if (type === 'project') {
      return (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">New project <button className="modal-close" onClick={() => setModal(null)}><i className="ti ti-x"></i></button></div>
            <form onSubmit={e => {
              e.preventDefault();
              const f = e.target as any;
              const newProj: Project = {
                id: Math.max(...state.projects.map(p => p.id), 0) + 1,
                name: f['f-pname'].value,
                desc: f['f-pdesc'].value || 'New project',
                status: f['f-pstatus'].value as any,
                progress: 0,
                members: [],
                color: '#888'
              };
              updateState(prev => ({ ...prev, projects: [...prev.projects, newProj] }), { type: 'project', data: newProj });
              setModal(null);
            }}>
              <div className="form-group"><label className="form-label">Project name</label><input className="form-input" name="f-pname" placeholder="Project name" required /></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" name="f-pdesc" placeholder="What is this project about?"></textarea></div>
              <div className="form-group"><label className="form-label">Status</label><select className="form-select" name="f-pstatus"><option value="planning">Planning</option><option value="active">Active</option><option value="review">In Review</option></select></div>
              <div className="modal-actions"><button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="btn btn-primary">Create</button></div>
            </form>
          </div>
        </div>
      );
    }

    if (type === 'person') {
       const person = data as Person | undefined;
       return (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{person ? 'Edit member' : 'Add member'} <button className="modal-close" onClick={() => setModal(null)}><i className="ti ti-x"></i></button></div>
            <form onSubmit={e => {
              e.preventDefault();
              const f = e.target as any;
              const initials = f['f-uinitials'].value.toUpperCase();
              
              if (person) {
                const updatedPerson = {
                  ...person,
                  initials,
                  name: f['f-uname'].value,
                  email: f['f-uemail'].value,
                  password: f['f-upass'].value || person.password,
                  permissions: f['f-uperms'].value as any,
                  role: f['f-urole'].value || 'Team Member',
                  workspace_id: state.workspace_id
                };
                updateState(prev => ({
                  ...prev,
                  people: prev.people.map(p => p.initials === person.initials ? updatedPerson : p),
                  tasks: prev.tasks.map(t => t.assignee === person.initials ? { ...t, assignee: initials } : t)
                }), { type: 'person', data: updatedPerson });
              } else {
                const newPerson: Person = {
                  initials,
                  name: f['f-uname'].value,
                  email: f['f-uemail'].value,
                  password: f['f-upass'].value || 'password123',
                  permissions: f['f-uperms'].value as any,
                  role: f['f-urole'].value || 'Team Member',
                  color: COLORS[state.people.length % COLORS.length]
                };
                updateState(prev => ({ ...prev, people: [...prev.people, newPerson] }), { type: 'person', data: { ...newPerson, workspace_id: state.workspace_id } });
              }
              setModal(null);
            }}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Full name</label><input className="form-input" name="f-uname" defaultValue={person?.name} placeholder="Full name" required /></div>
                <div className="form-group"><label className="form-label">Initials (2 letters)</label><input className="form-input" name="f-uinitials" defaultValue={person?.initials} placeholder="e.g. AB" maxLength={2} required /></div>
              </div>
              <div className="form-group"><label className="form-label">Email Address</label><input type="email" className="form-input" name="f-uemail" defaultValue={person?.email} placeholder="email@company.com" required /></div>
              <div className="form-group"><label className="form-label">{person ? 'Change Password' : 'Temporary Password'}</label><input type="text" className="form-input" name="f-upass" placeholder={person ? "Leave blank to keep current" : "Leave blank for password123"} /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Role</label><input className="form-input" name="f-urole" defaultValue={person?.role} placeholder="e.g. Product Designer" /></div>
                <div className="form-group">
                  <label className="form-label">Permissions Level</label>
                  <select className="form-select" name="f-uperms" defaultValue={person?.permissions || 'viewer'}>
                    <option value="viewer">Viewer (Read-only)</option>
                    <option value="editor">Editor (Edit everything)</option>
                    <option value="admin">Admin (Full Control)</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                {person && (
                  <button type="button" className="btn mr-auto text-[#A32D2D] hover:bg-red-50" onClick={() => {
                    if (confirm(`Are you sure you want to remove ${person.name}?`)) {
                      updateState(prev => ({
                        ...prev,
                        people: prev.people.filter(p => p.initials !== person.initials)
                      }));
                      setModal(null);
                    }
                  }}><i className="ti ti-trash"></i> Delete</button>
                )}
                <button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{person ? 'Save Changes' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      );
    }

    if (type === 'task-detail') {
      const task = data as Task;
      const addComment = (text: string) => {
        if (!text.trim()) return;
        const newComm: Comment = { author: currentUser?.initials || 'AN', text, time: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
        const updatedTask = { ...task, comments: [...task.comments, newComm] };
        updateState(prev => ({
          ...prev,
          tasks: prev.tasks.map(t => t.id === task.id ? updatedTask : t)
        }), { type: 'task', data: updatedTask });
        notify(updatedTask, 'comment');
        setModal({ type: 'task-detail', data: updatedTask });
      };

      return (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{task.name} <button className="modal-close" onClick={() => setModal(null)}><i className="ti ti-x"></i></button></div>
            <div className="detail-grid text-left">
              <div><div className="detail-label">Project</div><div className="detail-val">{task.project}</div></div>
              <div><div className="detail-label">Status</div><div className="detail-val">
                {userPerms.edit ? (
                  <select className="form-select py-1 px-1.5 text-[11px]" value={task.status} onChange={e => {
                    const status = e.target.value as any;
                    updateState(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? { ...t, status } : t) }));
                    notify({ ...task, status }, 'status');
                  }}>
                    <option value="todo">To do</option>
                    <option value="inprogress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                ) : (
                  <div className="capitalize">{task.status}</div>
                )}
              </div></div>
              <div><div className="detail-label">Assignee</div><div className="detail-val flex items-center gap-1.5"><Avatar initials={task.assignee} /> {state.people.find(p => p.initials === task.assignee)?.name || task.assignee}</div></div>
              <div><div className="detail-label">Due date</div><div className="detail-val">{fmtDate(task.due) || 'None'}</div></div>
              <div><div className="detail-label">Priority</div><div className="detail-val flex items-center gap-1"><span className={`priority-dot p-${task.priority}`}></span> {task.priority}</div></div>
            </div>
            <div className="detail-section text-left">
              <div className="detail-label">Comments ({task.comments.length})</div>
              <div className="comments-list">
                {task.comments.map((c, i) => {
                  const col = getColor(c.author);
                  return (
                    <div key={i} className="comment-item">
                      <div className="comment-avatar" style={{ background: col.bg, color: col.txt }}>{c.author}</div>
                      <div className="comment-body">
                        <div className="comment-author">{state.people.find(p => p.initials === c.author)?.name || c.author}</div>
                        <div className="comment-text">{c.text}</div>
                        <div className="comment-time">{c.time}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <form className="comment-input-row" onSubmit={e => {
                e.preventDefault();
                const t = (e.target as any).comment;
                addComment(t.value);
                t.value = '';
              }}>
                <Avatar initials={currentUser?.initials || 'AN'} size="detail" />
                <textarea className="form-textarea min-h-[44px] text-[12px]" name="comment" placeholder="Add a comment…" rows={2}></textarea>
                <button type="submit" className="btn btn-primary py-1.5 px-2.5 text-[11px] self-end"><i className="ti ti-send"></i></button>
              </form>
            </div>
            <div className="modal-actions">
              {userPerms.delete && (
                <button className="btn" onClick={() => {
                  updateState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== task.id) }));
                  setModal(null);
                }}><i className="ti ti-trash text-[#A32D2D]"></i> Delete</button>
              )}
              <button className="btn" onClick={() => setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const navTitles: any = { dashboard: 'Dashboard', kanban: 'Kanban Board', projects: 'Projects', tasks: 'Tasks', people: 'Team', completed: 'Archive' };
  const navSubs: any = { dashboard: 'Overview of all projects and tasks', kanban: 'Drag tasks across stages', projects: 'Active business projects', tasks: 'Track and manage tasks', people: 'Team members and assignments', completed: 'Completed and archived projects' };

  const archiveProject = async (projectName: string) => {
    const projectToArchive = state.projects.find(p => p.name === projectName);
    if (!projectToArchive) return;
    const workspace_id = state.workspace_id;

    const updatedProject = { ...projectToArchive, status: 'completed' as any, progress: 100, completedAt: new Date().toISOString() };
    updateState(prev => ({
      ...prev,
      projects: prev.projects.map(p => p.name === projectName ? updatedProject : p),
      tasks: prev.tasks.map(t => t.project === projectName ? { ...t, status: 'done' as any } : t)
    }), { type: 'project', data: updatedProject });

    // Persist tasks completion to Supabase
    try {
      await supabase.from('tasks').update({ status: 'done' }).eq('project', projectName).eq('workspace_id', workspace_id);
    } catch (err) {
      console.error('Archive tasks error:', err);
    }
    
    setFilterProject(null);
    setView('projects');
    showToast(`Project "${projectName}" has been moved to the Archive.`);
  };

  return (
    <div className={`app ${isKanbanExpanded ? 'kanban-expanded' : ''}`}>
      <div className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>
      <aside className={`sidebar ${isSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo"><i className="ti ti-layout-kanban"></i> Creative Pulse</div>
        <nav className="sidebar-nav">
          <NavItem id="dashboard" icon="home" label="Dashboard" active={view === 'dashboard' && !filterProject} onClick={() => { setView('dashboard'); setFilterProject(null); setIsSidebarOpen(false); }} />
          <NavItem id="kanban" icon="layout-columns" label="Kanban" active={view === 'kanban' && !filterProject} onClick={() => { setView('kanban'); setFilterProject(null); setIsSidebarOpen(false); }} />
          <NavItem id="projects" icon="folder" label="Projects" active={view === 'projects'} onClick={() => { setView('projects'); setFilterProject(null); setIsSidebarOpen(false); }} />
          <NavItem id="tasks" icon="checkbox" label="Tasks" active={view === 'tasks' && !filterProject} onClick={() => { setView('tasks'); setFilterProject(null); setIsSidebarOpen(false); }} />
          <NavItem id="people" icon="users" label="Team" active={view === 'people'} onClick={() => { setView('people'); setFilterProject(null); setIsSidebarOpen(false); }} />
          <NavItem id="completed" icon="archive" label="Archive" active={view === 'completed'} onClick={() => { setView('completed'); setFilterProject(null); setIsSidebarOpen(false); }} />
          
          <div className="sidebar-section">Active Projects</div>
          {state.projects.filter(p => p.status !== 'completed').map(p => (
            <button key={p.id} className={`nav-item ${filterProject === p.name ? 'active font-medium' : ''}`} onClick={() => { setView('tasks'); setFilterProject(p.name); setTaskTab('all'); setIsSidebarOpen(false); }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block mr-2" style={{ background: p.color }}></span> {p.name}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="flex items-center gap-2 mb-2 px-2.5">
            <Avatar initials={currentUser?.initials || '??'} />
            <div className="overflow-hidden">
               <div className="text-[11px] font-medium truncate">{currentUser?.name}</div>
               <div className="text-[9px] text-slate-500 capitalize">{currentUser?.permissions}</div>
            </div>
            <button className="ml-auto text-slate-400 hover:text-slate-600" onClick={handleLogout} title="Logout">
              <i className="ti ti-logout"></i>
            </button>
          </div>
          {userPerms.create && <button className="nav-item" onClick={() => { setModal({ type: 'task' }); setIsSidebarOpen(false); }}><i className="ti ti-plus"></i> New Task</button>}
          <div className="save-indicator px-2.5 py-1 mt-0.5"><i className="ti ti-cloud-check"></i> <span>{saveStatus}</span></div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="flex items-center gap-3">
            <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
              <i className="ti ti-menu-2"></i>
            </button>
            <div className="text-left">
              <div className="topbar-title">{filterProject || navTitles[view]}</div>
              <div className="topbar-sub">{filterProject ? 'Project tasks' : navSubs[view]}</div>
            </div>
          </div>
          <div className="topbar-actions">
            {filterProject && userPerms.edit && (
              <button className="btn text-green-600 hover:bg-green-50 border-green-200" onClick={() => archiveProject(filterProject)}>
                <i className="ti ti-circle-check"></i> Complete Project
              </button>
            )}
            {userPerms.create && <button className="btn" onClick={() => setModal({ type: 'project' })}><i className="ti ti-folder-plus"></i> New Project</button>}
            {userPerms.create && <button className="btn btn-primary" onClick={() => setModal({ type: 'task' })}><i className="ti ti-plus"></i> Add Task</button>}
          </div>
        </div>
        <div className="content">
          {view === 'dashboard' && !filterProject && <Dashboard />}
          {view === 'kanban' && <Kanban />}
          {view === 'projects' && !filterProject && <ProjectsGrid projects={state.projects} onSelect={(p: Project) => { setView('tasks'); setFilterProject(p.name); }} state={state} />}
          {view === 'completed' && <CompletedProjects state={state} onSelect={(p: Project) => { setView('tasks'); setFilterProject(p.name); }} />}
          {view === 'tasks' && <Tasks />}
          {view === 'people' && <Team />}
        </div>
      </div>

      <Modal />
      {toasts.map(t => (
        <div key={t.id} className="toast">
          <i className="ti ti-bell"></i>
          <div className="text-left">
            <div className="font-medium mb-px">Notification</div>
            <div className="text-slate-500">{t.msg}</div>
          </div>
          <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="border-none bg-none cursor-pointer text-slate-400 text-base ml-2"><i className="ti ti-x"></i></button>
        </div>
      ))}
    </div>
  );
}

function ProjectsGrid({ projects, onSelect, state }: any) {
  const active = projects.filter((p: Project) => p.status !== 'completed');
  return (
    <>
      <div className="section-header"><div className="section-title">Active projects ({active.length})</div><div className="flex gap-2"></div></div>
      <div className="projects-grid">
         {active.map((p: Project) => (
           <ProjectItem key={p.id} project={p} onClick={() => onSelect(p)} state={state} />
         ))}
         {active.length === 0 && <div className="col-span-full p-12 text-center text-slate-400 border-[0.5px] border-dashed border-slate-300 rounded-xl">No active projects</div>}
      </div>
    </>
  );
}

function CompletedProjects({ state, onSelect }: { state: AppState, onSelect: (p: Project) => void }) {
  const completed = state.projects.filter(p => p.status === 'completed');
  return (
    <>
      <div className="section-header"><div className="section-title">Archive ({completed.length})</div></div>
      <div className="projects-grid">
        {completed.map(p => (
          <div key={p.id} className="project-card opacity-80 hover:opacity-100" onClick={() => onSelect(p)}>
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
    </>
  );
}

function ProjectItem({ project, onClick, state }: any) {
  const getColor = (initials: string) => state.people.find((x: any) => x.initials === initials)?.color || { bg: '#eee', txt: '#666' };
  
  return (
    <div className="project-card" onClick={onClick}>
      <div className="project-header text-left">
        <div className="project-name">{project.name}</div>
        <ProjectBadge status={project.status} />
      </div>
      <div className="project-desc text-left">{project.desc}</div>
      <div className="progress-bar"><div className="progress-fill" style={{ width: `${project.progress}%` }}></div></div>
      <div className="progress-row"><span>Progress</span><span>{project.progress}%</span></div>
      <div className="flex justify-between items-center">
        <div className="avatars">
           {project.members.map((m: string) => {
             const c = getColor(m);
             return (
               <div 
                 key={m} 
                 className="avatar" 
                 style={{ background: c.bg, color: c.txt }}
               >
                 {m}
               </div>
             );
           })}
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
