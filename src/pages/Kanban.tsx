import React from 'react';
import { useApp } from '../contexts/AppContext';
import { Task } from '../types';
import Avatar from '../components/ui/Avatar';
import { useSearchParams } from 'react-router-dom';

export default function Kanban() {
  const { state, updateState, setModal, userPerms, showToast, isKanbanExpanded, setIsKanbanExpanded, today } = useApp();
  const [searchParams] = useSearchParams();
  const filterProject = searchParams.get('project');

  if (!state) return null;

  const isOverdue = (d: string) => d && d < today;
  const fmtDate = (d: string) => {
    if (!d) return '';
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
      return d;
    }
  };

  const cols = [
    { id: 'todo', label: 'To do', color: '#888' }, 
    { id: 'inprogress', label: 'In progress', color: '#185FA5' }, 
    { id: 'done', label: 'Done', color: '#1D9E75' }
  ];
  
  const tasks = filterProject ? state.tasks.filter(t => t.project === filterProject) : state.tasks;
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const progressPercent = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  const moveTask = (task: Task, status: string) => {
    if (!userPerms.edit) {
      showToast('You do not have permission to edit tasks.');
      return;
    }
    updateState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === task.id ? { ...t, status: status as any } : t)
    }), { type: 'task', data: { ...task, status: status as any } });
  };

  return (
    <div className="h-full overflow-hidden pb-1 flex flex-col animate-in fade-in duration-500">
      <div className="section-header mb-3">
        <div className="flex items-center gap-2">
          <div className="section-title">{filterProject ? filterProject + ' — Kanban' : 'Kanban board'}</div>
          <button 
            className={`btn text-[10px] py-0.5 px-1.5 ${isKanbanExpanded ? 'bg-blue-50 border-blue-200 text-blue-600' : ''}`}
            onClick={() => setIsKanbanExpanded(!isKanbanExpanded)}
            title={isKanbanExpanded ? "Exit Focus" : "Expand for Focus"}
          >
            <i className={`ti ti-${isKanbanExpanded ? 'minimize' : 'maximize'}`}></i>
            {isKanbanExpanded ? ' Exit Focus' : ' Focus View'}
          </button>
        </div>
        <button className="btn btn-primary text-[11px] py-1 px-[10px]" onClick={() => setModal({ type: 'task' })}><i className="ti ti-plus"></i> Add task</button>
      </div>

      {filterProject && (
        <div className="mb-4 mx-1">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Project Progress</span>
            <span className="text-[12px] font-bold text-blue-600">{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-700 ease-out" 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      )}

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
                      {t.comments && t.comments.length > 0 && <span className="comment-count text-[10px] flex items-center gap-0.5"><i className="ti ti-message text-[11px]"></i>{t.comments.length}</span>}
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
}
