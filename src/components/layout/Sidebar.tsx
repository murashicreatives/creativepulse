import React from 'react';
import { NavLink } from 'react-router-dom';
import { useApp, COLORS } from '../../contexts/AppContext';

export default function Sidebar() {
  const { state, currentUser, handleLogout, isSidebarOpen, setIsSidebarOpen, userPerms, setModal, saveStatus } = useApp();

  const Avatar = ({ initials, size = 'sm' }: { initials: string, size?: 'sm' | 'lg' | 'detail' }) => {
    const person = state?.people.find(x => x.initials === initials);
    const c = person?.color || COLORS[0];
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

  const NavItem = ({ icon, label, to, count }: { icon: string, label: string, to: string, count?: number }) => (
    <NavLink 
      to={to} 
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      onClick={() => setIsSidebarOpen(false)}
    >
      <div className="flex items-center gap-3 flex-1">
        <i className={`ti ti-${icon} text-lg`} aria-hidden="true"></i> 
        <span>{label}</span>
      </div>
      {count !== undefined && count > 0 && (
        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </NavLink>
  );

  const activeProjectsCount = state?.projects.filter(p => p.status !== 'completed').length || 0;
  const activeTasksCount = state?.tasks.filter(t => t.status !== 'done').length || 0;
  const teamCount = state?.people.length || 0;

  return (
    <>
      <div className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>
      <aside className={`sidebar ${isSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-1">
            <i className="ti ti-layout-kanban text-white text-lg"></i>
          </div>
          <span>Pulse</span>
        </div>
        <nav className="sidebar-nav">
          <NavItem icon="home" label="Dashboard" to="/dashboard" />
          <NavItem icon="layout-columns" label="Kanban" to="/kanban" count={activeTasksCount} />
          <NavItem icon="folder" label="Projects" to="/projects" count={activeProjectsCount} />
          <NavItem icon="checkbox" label="Tasks" to="/tasks" />
          <NavItem icon="users" label="Team" to="/team" count={teamCount} />
          <NavItem icon="archive" label="Archive" to="/archive" />
          
          <div className="sidebar-section mt-4">Live Projects</div>
          {state?.projects.filter(p => p.status !== 'completed').map(p => {
            const pt = state.tasks.filter(t => t.project === p.name);
            const done = pt.filter(t => t.status === 'done').length;
            const progress = pt.length > 0 ? Math.round((done / pt.length) * 100) : 0;
            
            return (
              <NavLink 
                key={p.id} 
                to={`/tasks?project=${encodeURIComponent(p.name)}`}
                className={({ isActive }) => `sidebar-project-item ${isActive ? 'active' : ''}`}
                onClick={() => setIsSidebarOpen(false)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center truncate">
                    <span className="w-1.5 h-1.5 rounded-full inline-block mr-2 shrink-0" style={{ background: p.color }}></span>
                    <span className="truncate">{p.name}</span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-400">{progress}%</span>
                </div>
                <div className="h-0.5 w-full bg-slate-200/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-400 transition-all duration-500" 
                    style={{ width: `${progress}%`, backgroundColor: p.color }}
                  ></div>
                </div>
              </NavLink>
            );
          })}
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
    </>
  );
}
