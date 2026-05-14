import React from 'react';
import { useApp } from '../../contexts/AppContext';
import { useLocation, useSearchParams } from 'react-router-dom';

export default function Topbar() {
  const { 
    setIsSidebarOpen, 
    userPerms, 
    setModal, 
    archiveProject 
  } = useApp();

  const location = useLocation();
  const [searchParams] = useSearchParams();
  const filterProject = searchParams.get('project');

  const navTitles: any = { 
    '/dashboard': 'Dashboard', 
    '/kanban': 'Kanban Board', 
    '/projects': 'Projects', 
    '/tasks': 'Tasks', 
    '/team': 'Team', 
    '/archive': 'Archive' 
  };
  
  const navSubs: any = { 
    '/dashboard': 'Overview of all projects and tasks', 
    '/kanban': 'Drag tasks across stages', 
    '/projects': 'Active business projects', 
    '/tasks': 'Track and manage tasks', 
    '/team': 'Team members and assignments', 
    '/archive': 'Completed and archived projects' 
  };

  const currentPath = location.pathname;
  const title = filterProject || navTitles[currentPath] || 'Creative Pulse';
  const sub = filterProject ? 'Project tasks' : (navSubs[currentPath] || 'Workspace');

  return (
    <div className="topbar">
      <div className="flex items-center gap-3">
        <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
          <i className="ti ti-menu-2"></i>
        </button>
        <div className="text-left">
          <div className="topbar-title">{title}</div>
          <div className="topbar-sub">{sub}</div>
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
  );
}
