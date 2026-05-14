import React, { useState } from 'react';
import { useApp, COLORS } from '../../contexts/AppContext';
import { Task, Project, Person, Comment } from '../../types';
import Avatar from '../ui/Avatar';

export default function ModalManager() {
  const { modal, setModal, state, updateState, userPerms, userEmail, currentUser, today } = useApp();

  if (!modal) return null;
  const { type, data } = modal;

  const fmtDate = (d: string) => {
    if (!d) return '';
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
      return d;
    }
  };

  const getColor = (initials: string) => state?.people.find(x => x.initials === initials)?.color || COLORS[0];

  const ModalWrapper = ({ children, title }: { children: React.ReactNode, title: string }) => (
    <div className="modal-overlay" onClick={() => setModal(null)}>
      <div className="modal animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          {title} 
          <button className="modal-close" onClick={() => setModal(null)}><i className="ti ti-x"></i></button>
        </div>
        {children}
      </div>
    </div>
  );

  if (type === 'task') {
    return (
      <ModalWrapper title="Add task">
        <form onSubmit={e => {
          e.preventDefault();
          const f = e.target as any;
          const newTask: Task = {
            id: crypto.randomUUID(),
            name: f['f-name'].value,
            project: f['f-project'].value,
            assignee: f['f-assignee'].value,
            due: f['f-due'].value,
            priority: f['f-priority'].value,
            status: 'todo',
            comments: []
          };
          updateState(prev => ({ ...prev, tasks: [...prev.tasks, newTask] }), { type: 'task', data: newTask });
          setModal(null);
        }}>
          <div className="form-group"><label className="form-label">Task name</label><input className="form-input" name="f-name" placeholder="What needs to be done?" required /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Project</label><select className="form-select" name="f-project">{state?.projects.map(p => <option key={p.id}>{p.name}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Assignee</label><select className="form-select" name="f-assignee">{state?.people.map(p => <option key={p.initials} value={p.initials}>{p.name}</option>)}</select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Due date</label><input type="date" className="form-input" name="f-due" /></div>
            <div className="form-group"><label className="form-label">Priority</label><select className="form-select" name="f-priority"><option value="high">High</option><option value="med" selected>Medium</option><option value="low">Low</option></select></div>
          </div>
          <div className="modal-actions"><button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="btn btn-primary">Add task</button></div>
        </form>
      </ModalWrapper>
    );
  }

  if (type === 'project') {
    const project = data as Project | undefined;
    const [selectedMembers, setSelectedMembers] = useState<string[]>(project?.members || []);

    const toggleMember = (initials: string) => {
      setSelectedMembers(prev => 
        prev.includes(initials) 
          ? prev.filter(m => m !== initials) 
          : [...prev, initials]
      );
    };

    return (
      <ModalWrapper title={project ? 'Edit project' : 'New project'}>
        <form onSubmit={e => {
          e.preventDefault();
          const f = e.target as any;
          
          if (project) {
            const updatedProj: Project = {
              ...project,
              name: f['f-pname'].value,
              desc: f['f-pdesc'].value,
              status: f['f-pstatus'].value as any,
              members: selectedMembers
            };
            updateState(prev => ({
              ...prev,
              projects: prev.projects.map(p => p.id === project.id ? updatedProj : p)
            }), { type: 'project', data: updatedProj });
          } else {
            const newProj: Project = {
              id: crypto.randomUUID(),
              name: f['f-pname'].value,
              desc: f['f-pdesc'].value || 'New project',
              status: f['f-pstatus'].value as any,
              progress: 0,
              members: selectedMembers,
              color: '#185FA5'
            };
            updateState(prev => ({ ...prev, projects: [...prev.projects, newProj] }), { type: 'project', data: newProj });
          }
          setModal(null);
        }}>
          <div className="form-group">
            <label className="form-label">Project name</label>
            <input className="form-input" name="f-pname" defaultValue={project?.name} placeholder="e.g. Website Redesign" required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" name="f-pdesc" defaultValue={project?.desc} placeholder="What is this project about?"></textarea>
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" name="f-pstatus" defaultValue={project?.status || 'planning'}>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="review">In Review</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Project Team ({selectedMembers.length})</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {state?.people.map(p => {
                const isSelected = selectedMembers.includes(p.initials);
                return (
                  <button
                    key={p.initials}
                    type="button"
                    onClick={() => toggleMember(p.initials)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                      isSelected 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Avatar initials={p.initials} size="detail" />
                    <span className="text-xs font-medium">{p.name}</span>
                    {isSelected && <i className="ti ti-check text-[10px]"></i>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{project ? 'Save Changes' : 'Create Project'}</button>
          </div>
        </form>
      </ModalWrapper>
    );
  }

  if (type === 'person') {
    const person = data as Person | undefined;
    const isMe = person?.email === userEmail;
    // Local state for color picker in modal
    return <PersonModal person={person} isMe={isMe} />;
  }

  if (type === 'task-detail') {
    const task = data as Task;
    return <TaskDetailModal task={task} />;
  }

  return null;
}

function PersonModal({ person, isMe }: { person?: Person, isMe: boolean }) {
  const { userEmail, userPerms, updateState, setModal, state } = useApp();
  const [selectedColor, setSelectedColor] = useState(person?.color || COLORS[0]);

  return (
    <div className="modal-overlay" onClick={() => setModal(null)}>
      <div className="modal animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          {person ? (isMe ? 'Edit your profile' : 'Edit member') : 'Add member'} 
          <button className="modal-close" onClick={() => setModal(null)}><i className="ti ti-x"></i></button>
        </div>
        <form onSubmit={e => {
          e.preventDefault();
          const f = e.target as any;
          const initials = f['f-uinitials'].value.toUpperCase();
          
          if (person) {
            const updatedPerson = {
              ...person,
              initials,
              name: f['f-uname'].value,
              email: f['f-uemail'].value,
              permissions: (f['f-uperms']?.value || person.permissions) as any,
              role: f['f-urole'].value || 'Team Member',
              workspace_id: state?.workspace_id,
              color: selectedColor
            };
            updateState(prev => ({
              ...prev,
              people: prev.people.map(p => p.email === person.email ? updatedPerson : p),
              tasks: prev.tasks.map(t => t.assignee === person.initials ? { ...t, assignee: initials } : t)
            }), { type: 'person', data: updatedPerson });
          } else {
            const newPerson: Person & { id: string; workspace_id?: string } = {
              id: crypto.randomUUID(),
              initials,
              name: f['f-uname'].value,
              email: f['f-uemail'].value,
              permissions: f['f-uperms'].value as any,
              role: f['f-urole'].value || 'Team Member',
              color: selectedColor,
              workspace_id: state?.workspace_id
            };
            updateState(prev => ({ ...prev, people: [...prev.people, newPerson] }), { type: 'person', data: newPerson });
          }
          setModal(null);
        }}>
          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label">Full name</label>
              <input className="form-input" name="f-uname" defaultValue={person?.name} placeholder="Full name" required />
            </div>
            <div className="form-group w-32">
              <label className="form-label">Initials</label>
              <input className="form-input" name="f-uinitials" defaultValue={person?.initials} placeholder="e.g. AB" maxLength={2} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Profile Theme</label>
            <div className="flex gap-2.5 mt-2 flex-wrap">
              {COLORS.map((c, i) => (
                <button 
                  key={i} 
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${selectedColor.bg === c.bg ? 'border-indigo-600 scale-110 shadow-sm' : 'border-transparent'}`}
                  style={{ background: c.bg, color: c.txt }}
                  onClick={() => setSelectedColor(c)}
                >
                  {selectedColor.bg === c.bg && <i className="ti ti-check text-xs"></i>}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input type="email" className="form-input" name="f-uemail" defaultValue={person?.email} placeholder="email@company.com" required disabled={!!person && !userPerms.manageTeam} />
          </div>
          
          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label">Role</label>
              <input className="form-input" name="f-urole" defaultValue={person?.role} placeholder="e.g. Product Designer" />
            </div>
            <div className="form-group flex-1">
              <label className="form-label">Permissions Level</label>
              <select 
                className="form-select" 
                name="f-uperms" 
                defaultValue={person?.permissions || 'viewer'} 
                disabled={!userPerms.manageTeam}
              >
                <option value="viewer">Viewer (Read-only)</option>
                <option value="editor">Editor (Edit everything)</option>
                <option value="admin">Admin (Full Control)</option>
              </select>
            </div>
          </div>
          <div className="modal-actions">
            {person && userPerms.manageTeam && !isMe && (
              <button type="button" className="btn mr-auto text-red-600 hover:bg-red-50" onClick={() => {
                if (confirm(`Are you sure you want to remove ${person.name}?`)) {
                  updateState(prev => ({
                    ...prev,
                    people: prev.people.filter(p => p.email !== person.email)
                  }));
                  setModal(null);
                }
              }}><i className="ti ti-trash"></i> Remove Member</button>
            )}
            {isMe && (
              <button type="button" className="btn mr-auto text-red-600 hover:bg-red-50" onClick={async () => {
                if (confirm('Are you sure you want to delete your profile? This will log you out.')) {
                  try {
                    // 1. Remove profile from DB
                    await updateState(prev => ({
                      ...prev,
                      people: prev.people.filter(p => p.email !== person.email)
                    }));
                    // 2. Log out
                    const { supabase } = await import('../../lib/supabase');
                    await supabase.auth.signOut();
                    // AppContext should catch this and set userEmail to null, triggering redirect in App.tsx
                    setModal(null);
                  } catch (err) {
                    alert('Failed to delete account. Please try again.');
                  }
                }
              }}><i className="ti ti-trash"></i> Delete My Account</button>
            )}
            <button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{person ? 'Save Changes' : 'Update Profile'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskDetailModal({ task }: { task: Task }) {
  const { setModal, state, updateState, userPerms, currentUser } = useApp();

  const fmtDate = (d: string) => {
    if (!d) return '';
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
      return d;
    }
  };

  const getColor = (initials: string) => state?.people.find(x => x.initials === initials)?.color || COLORS[0];

  const addComment = (text: string) => {
    if (!text.trim()) return;
    const newComm: Comment = { author: currentUser?.initials || 'AN', text, time: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
    const updatedTask = { ...task, comments: [...(task.comments || []), newComm] };
    updateState(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === task.id ? updatedTask : t)
    }), { type: 'task', data: updatedTask });
    setModal({ type: 'task-detail', data: updatedTask });
  };

  return (
    <div className="modal-overlay" onClick={() => setModal(null)}>
      <div className="modal animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{task.name} <button className="modal-close" onClick={() => setModal(null)}><i className="ti ti-x"></i></button></div>
        <div className="detail-grid text-left">
          <div><div className="detail-label">Project</div><div className="detail-val">{task.project}</div></div>
          <div><div className="detail-label">Status</div><div className="detail-val">
            {userPerms.edit ? (
              <select className="form-select py-1 px-1.5 text-[11px]" value={task.status} onChange={e => {
                const status = e.target.value as any;
                updateState(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === task.id ? { ...t, status } : t) }), { type: 'task', data: { ...task, status } });
              }}>
                <option value="todo">To do</option>
                <option value="inprogress">In progress</option>
                <option value="done">Done</option>
              </select>
            ) : (
              <div className="capitalize">{task.status}</div>
            )}
          </div></div>
          <div><div className="detail-label">Assignee</div><div className="detail-val flex items-center gap-1.5"><Avatar initials={task.assignee} /> {state?.people.find(p => p.initials === task.assignee)?.name || task.assignee}</div></div>
          <div><div className="detail-label">Due date</div><div className="detail-val">{fmtDate(task.due) || 'None'}</div></div>
          <div><div className="detail-label">Priority</div><div className="detail-val flex items-center gap-1"><span className={`priority-dot p-${task.priority}`}></span> {task.priority}</div></div>
        </div>
        <div className="detail-section text-left">
          <div className="detail-label">Comments ({(task.comments || []).length})</div>
          <div className="comments-list">
            {(task.comments || []).map((c, i) => {
              const col = getColor(c.author);
              return (
                <div key={i} className="comment-item">
                  <div className="comment-avatar" style={{ background: col.bg, color: col.txt }}>{c.author}</div>
                  <div className="comment-body">
                    <div className="comment-author">{state?.people.find(p => p.initials === c.author)?.name || c.author}</div>
                    <div className="comment-text">{c.text}</div>
                    <div className="comment-time">{c.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <form className="comment-input-row" onSubmit={e => {
            e.preventDefault();
            const t = (e.target as any).comment;
            addComment(t.value);
            t.value = '';
          }}>
            <Avatar initials={currentUser?.initials || 'AN'} size="detail" />
            <textarea className="form-textarea min-h-[44px] text-[12px]" name="comment" placeholder="Add a comment…" rows={2}></textarea>
            <button type="submit" className="btn btn-primary py-1.5 px-2.5 text-[11px] self-end"><i className="ti ti-send"></i></button>
          </form>
        </div>
        <div className="modal-actions">
          {userPerms.delete && (
            <button className="btn" onClick={() => {
              updateState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== task.id) }));
              setModal(null);
            }}><i className="ti ti-trash text-[#A32D2D]"></i> Delete</button>
          )}
          <button className="btn" onClick={() => setModal(null)}>Close</button>
        </div>
      </div>
    </div>
  );
}
