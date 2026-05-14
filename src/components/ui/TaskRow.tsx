import React from 'react';
import { Task } from '../../types';
import { useApp } from '../../contexts/AppContext';
import Avatar from './Avatar';

export default function TaskRow({ task }: { task: Task, key?: any }) {
  const { updateState, setModal, userPerms, showToast, today } = useApp();

  const isOverdue = (d: string) => d && d < today;
  const fmtDate = (d: string) => {
    if (!d) return '';
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
      return d;
    }
  };

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
          {task.comments && task.comments.length > 0 && <span className="comment-count"><i className="ti ti-message" aria-hidden="true"></i>{task.comments.length}</span>}
        </div>
      </div>
      <span className={`priority-dot p-${task.priority}`}></span>
      <Avatar initials={task.assignee} />
    </div>
  );
}
