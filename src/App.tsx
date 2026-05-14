import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';

// Layout
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';

// Pages
import Dashboard from './pages/Dashboard';
import Kanban from './pages/Kanban';
import Projects from './pages/Projects';
import Tasks from './pages/Tasks';
import Team from './pages/Team';
import Archive from './pages/Archive';
import Login from './pages/Login';

// Modals & UI
import ModalManager from './components/modals/ModalManager';
import LoadingScreen from './components/ui/LoadingScreen';

function AppContent() {
  const { 
    state, 
    userEmail, 
    isKanbanExpanded, 
    toasts, 
  } = useApp();

  if (!userEmail) {
    return <Login />;
  }

  if (!state) {
    return <LoadingScreen />;
  }

  return (
    <div className={`app ${isKanbanExpanded ? 'kanban-expanded' : ''}`}>
      <Sidebar />
      <div className="main">
        <Topbar />
        <div className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/kanban" element={<Kanban />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/team" element={<Team />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>

      <ModalManager />

      {toasts.map(t => (
        <div key={t.id} className="toast">
          <i className="ti ti-bell"></i>
          <div className="text-left">
            <div className="font-medium mb-px">Notification</div>
            <div className="text-slate-500">{t.msg}</div>
          </div>
          <button className="border-none bg-none cursor-pointer text-slate-400 text-base ml-2"><i className="ti ti-x"></i></button>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
