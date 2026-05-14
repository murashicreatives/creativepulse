import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { Task } from '../types';
import TaskRow from '../components/ui/TaskRow';
import { useSearchParams } from 'react-router-dom';

export default function Tasks() {
  const { state, setModal, today } = useApp();
  const [searchParams] = useSearchParams();
  const filterProject = searchParams.get('project');
  const [taskTab, setTaskTab] = useState('all');

  if (!state) return null;

  const isOverdue = (d: string) => d && d < today;

  const tasks = filterProject ? state.tasks.filter(t => t.project === filterProject) : state.tasks;
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const progressPercent = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  const tabMap: any = { 
    all: tasks, 
    todo: tasks.filter(t => t.status === 'todo'), 
    inprogress: tasks.filter(t => t.status === 'inprogress'), 
    done: tasks.filter(t => t.status === 'done'), 
    overdue: tasks.filter(t => t.status !== 'done' && isOverdue(t.due)) 
  };
  const shown = tabMap[taskTab] || tasks;
  const tabs = [
    { id: 'all', label: 'All' }, 
    { id: 'todo', label: 'To do' }, 
    { id: 'inprogress', label: 'In progress' }, 
    { id: 'done', label: 'Done' }, 
    { id: 'overdue', label: 'Overdue' }
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="section-header">
        <div className="section-title">{filterProject ? filterProject + ' — Tasks' : 'All tasks'} ({tasks.length})</div>
        <button className="btn btn-primary text-[11px] py-1 px-[10px]" onClick={() => setModal({ type: 'task' })}><i className="ti ti-plus"></i> Add</button>
      </div>

      {filterProject && (
        <div className="mb-6 p-5 bg-white border-[0.5px] border-slate-200 rounded-xl shadow-sm">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-[13px] font-semibold text-slate-700">Project Progress</span>
            <span className="text-[13px] font-bold text-blue-600">{progressPercent}%</span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border-[0.5px] border-slate-100">
            <div 
              className="h-full bg-blue-500 transition-all duration-700 ease-out" 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <div className="mt-2.5 flex justify-between items-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
              {doneCount} of {tasks.length} tasks completed
            </span>
            {progressPercent === 100 && <span className="text-[10px] text-green-600 font-bold uppercase tracking-tight flex items-center gap-1"><i className="ti ti-circle-check"></i> Project Ready</span>}
          </div>
        </div>
      )}

      <div className="tasks-panel text-left">
        <div className="tasks-tabs">
          {tabs.map(t => (
            <button key={t.id} className={`task-tab ${taskTab === t.id ? 'active' : ''}`} onClick={() => setTaskTab(t.id)}>
              {t.label} <span className="text-slate-400 text-[10px] ml-0.5">{tabMap[t.id].length}</span>
            </button>
          ))}
        </div>
        <div className="task-list">
          {shown.length ? shown.map((t: any) => <TaskRow key={t.id} task={t} />) : <div className="empty-state"><i className="ti ti-circle-check"></i>Nothing here</div>}
        </div>
      </div>
    </div>
  );
}
