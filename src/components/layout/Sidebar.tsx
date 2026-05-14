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

  const NavItem = ({ icon, label, to }: { icon: string, label: string, to: string }) => (
    <NavLink 
      to={to} 
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      onClick={() => setIsSidebarOpen(false)}
    >
      <i className={`ti ti-${icon}`} aria-hidden="true"></i> {label}
    </NavLink>
  );

  return (
    <>
      <div className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>
      <aside className={`sidebar ${isSidebarOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo"><i className="ti ti-layout-kanban"></i> Creative Pulse</div>
        <nav className="sidebar-nav">
          <NavItem icon="home" label="Dashboard" to="/dashboard" />
          <NavItem icon="layout-columns" label="Kanban" to="/kanban" />
          <NavItem icon="folder" label="Projects" to="/projects" />
          <NavItem icon="checkbox" label="Tasks" to="/tasks" />
          <NavItem icon="users" label="Team" to="/team" />
          <NavItem icon="archive" label="Archive" to="/archive" />
          
          <div className="sidebar-section">Active Projects</div>
          {state?.projects.filter(p => p.status !== 'completed').map(p => (
            <NavLink 
              key={p.id} 
              to={`/tasks?project=${encodeURIComponent(p.name)}`}
              className={({ isActive }) => `nav-item ${isActive ? 'active font-medium' : ''}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <span className="w-1.5 h-1.5 rounded-full inline-block mr-2" style={{ background: p.color }}></span> {p.name}
            </NavLink>
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
    </>
  );
}
