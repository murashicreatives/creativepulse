import React from 'react';
import { useApp } from '../contexts/AppContext';
import { Task } from '../types';
import TaskRow from '../components/ui/TaskRow';
import Avatar from '../components/ui/Avatar';

export default function Team() {
  const { state, userPerms, setModal, userEmail } = useApp();

  if (!state) return null;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div className="section-title">Team members</div>
        {userPerms.manageTeam && <button className="btn btn-primary text-[11px] py-1 px-[10px]" onClick={() => setModal({ type: 'person' })}><i className="ti ti-user-plus"></i> Add</button>}
      </div>
      <div className="people-grid">
        {state.people.map(p => {
          const a = state.tasks.filter(t => t.assignee === p.initials), d = a.filter(t => t.status === 'done').length;
          const isMe = p.email === userEmail;
          const canEdit = userPerms.manageTeam || isMe;
          
          return (
            <div key={p.email} className={`person-card relative group ${isMe ? 'border-indigo-200 bg-indigo-50/30' : ''}`}>
              {canEdit && (
                <button 
                  className="absolute top-2 right-2 p-1 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-slate-600 focus:opacity-100"
                  onClick={() => setModal({ type: 'person', data: p })}
                  title={isMe ? "Edit profile" : "Manage member"}
                >
                  <i className="ti ti-edit text-sm"></i>
                </button>
              )}
              {isMe && <div className="absolute top-2 left-2 text-[8px] font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 px-1 rounded">You</div>}
              <Avatar initials={p.initials} size="lg" />
              <div className="person-name">{p.name}</div>
              <div className="person-role">{p.role}</div>
              <div className="text-[10px] text-slate-400 mt-1">{p.email}</div>
              <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mt-2 bg-white/60 border border-slate-100 rounded px-1.5 py-0.5 inline-block">{p.permissions}</div>
              <div className="person-stats mt-4">
                <div className="pstat"><strong>{a.length}</strong>tasks</div>
                <div className="pstat"><strong>{d}</strong>done</div>
                <div className="pstat"><strong>{a.length - d}</strong>open</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-[20px]">
        <div className="section-header">
          <div className="section-title">Open assignments</div>
        </div>
        <div className="tasks-panel text-left">
          <div className="task-list">
            {state.tasks.filter(t => t.status !== 'done').map((t: any) => <TaskRow key={t.id} task={t} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
