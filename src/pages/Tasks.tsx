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
    </div>
  );
}
