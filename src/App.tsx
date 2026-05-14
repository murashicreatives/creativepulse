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

function AppContent() {
  const { 
    state, 
    userEmail, 
    fetchError, 
    handleLogout, 
    isKanbanExpanded, 
    toasts, 
    showToast 
  } = useApp();

  if (!userEmail) {
    return <Login />;
  }

  if (!state) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="text-indigo-600 text-5xl mb-6 animate-bounce"><i className="ti ti-layout-kanban"></i></div>
        <div className="text-slate-600 text-xl font-semibold mb-2">Preparing your workspace...</div>
        <div className="text-slate-400 text-sm mb-8 max-w-sm">We're connecting to your database and loading your creative pulse dashboard.</div>
        
        {fetchError ? (
          <div className="mt-4 flex flex-col items-center max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-red-50 border border-red-100 rounded-xl p-6 mb-6 shadow-sm">
              <div className="text-red-600 font-bold flex items-center justify-center gap-2 mb-2">
                <i className="ti ti-alert-triangle-filled"></i> Synchronisation Issue
              </div>
              <div className="text-red-500 text-sm leading-relaxed">{fetchError}</div>
              <div className="text-[10px] text-red-400 mt-4 italic">Check your internet connection or verify your Supabase project status.</div>
            </div>
            <div className="flex gap-3">
               <button className="btn px-6 font-medium bg-white hover:bg-slate-50" onClick={() => window.location.reload()}>
                <i className="ti ti-refresh"></i> Refresh Page
               </button>
               <button className="btn bg-slate-800 text-white border-slate-800 hover:bg-slate-900" onClick={handleLogout}>
                <i className="ti ti-logout"></i> Sign Out
               </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-64 h-1.5 bg-slate-200 rounded-full overflow-hidden shadow-inner mb-4">
              <div className="loading-bar-fill h-full bg-indigo-500 w-1/2 animate-[loading_1s_infinite_ease-in-out]"></div>
            </div>
            <div className="text-slate-400 text-xs font-medium">Fetching details for <span className="text-slate-600 font-semibold">{userEmail}</span></div>
            <div className="mt-8 text-[11px] text-slate-300 animate-pulse">If this takes more than 10 seconds, try refreshing your browser.</div>
          </div>
        )}
      </div>
    );
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
