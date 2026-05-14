import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppState, Project, Task, Person, Color } from '../types';
import { supabase } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';

export const COLORS = [
  { bg: '#E6F1FB', txt: '#0C447C' },
  { bg: '#EAF3DE', txt: '#3B6D11' },
  { bg: '#FAEEDA', txt: '#854F0B' },
  { bg: '#FBEAF0', txt: '#72243E' },
  { bg: '#EEEDFE', txt: '#3C3489' },
  { bg: '#FAECE7', txt: '#712B13' }
];

export const PERMISSIONS = {
  admin: { create: true, edit: true, delete: true, manageTeam: true },
  editor: { create: true, edit: true, delete: false, manageTeam: false },
  viewer: { create: false, edit: false, delete: false, manageTeam: false }
};

interface AppContextType {
  state: AppState | null;
  userEmail: string | null;
  userPerms: typeof PERMISSIONS.viewer;
  currentUser: Person | undefined;
  saveStatus: string;
  loadingStatus: string;
  fetchError: string | null;
  refreshTrigger: number;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isKanbanExpanded: boolean;
  setIsKanbanExpanded: (expanded: boolean) => void;
  modal: { type: string, data?: any } | null;
  setModal: (modal: { type: string, data?: any } | null) => void;
  updateState: (updater: (prev: AppState) => AppState, updatedItem?: { type: 'project' | 'task' | 'person', data: any }) => void;
  handleLogout: () => Promise<void>;
  showToast: (msg: string) => void;
  toasts: { id: number, msg: string }[];
  today: string;
  archiveProject: (projectName: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem('user_email')?.toLowerCase() || null);
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>('Initializing...');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [toasts, setToasts] = useState<{ id: number, msg: string }[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isKanbanExpanded, setIsKanbanExpanded] = useState(false);
  const [modal, setModal] = useState<{ type: string, data?: any } | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const currentUser = state?.people.find(p => p.email === userEmail);
  const userPerms = currentUser ? (PERMISSIONS[currentUser.permissions] || PERMISSIONS.viewer) : PERMISSIONS.viewer;

  const today = new Date().toISOString().split('T')[0];

  const showToast = (msg: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Helper for resilient Supabase queries with timeout and retry
  const sbQuery = async <T,>(promiseFn: () => Promise<any>, timeoutMs = 45000, retries = 1): Promise<{data: T | null, error: any, status: number}> => {
    const execute = async () => {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
      );
      try {
        const response = await Promise.race([promiseFn(), timeoutPromise]) as any;
        return response;
      } catch (e: any) {
        return { data: null, error: { message: e.message || 'Timeout' }, status: 408 };
      }
    };

    let result = await execute();
    if (result.status === 408 && retries > 0) {
      await new Promise(r => setTimeout(r, 2000));
      result = await execute();
    }
    
    if (result.error && result.status === 408) {
      console.error('[Supabase] Fatal Timeout after retries.');
    }
    return result;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const email = session.user.email?.toLowerCase();
        if (!email) return;

        if (userEmail !== email) {
          setUserEmail(email);
          localStorage.setItem('user_email', email);
        }
        
        // Only trigger fetch on critical events or if we have no state
        const criticalEvents = ['SIGNED_IN', 'INITIAL_SESSION', 'USER_UPDATED'];
        if (criticalEvents.includes(event) || !state) {
          setRefreshTrigger(prev => prev + 1);
        }
      } else {
        setUserEmail(null);
        localStorage.removeItem('user_email');
        setState(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [userEmail]);

  // Consolidated Initialisation & Sync Logic
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;
    
    const fetchData = async (retries = 3) => {
      if (!userEmail) return;
      
      try {
        setFetchError(null);
        setLoadingStatus('Connecting to server...');
        
        // 1. Get/Verify session first (id check)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setLoadingStatus('Session expired. Please log in.');
          return;
        }

        // 2. Verify Profile & Workspace (Sequential to avoid race conditions)
        setLoadingStatus('Verifying profile...');
        let { data: profile, error: pErr, status } = await sbQuery<any>(
          () => supabase.from('profiles').select('id, email, workspace_id').eq('id', session.user.id).maybeSingle() as any
        );

        // Fallback to email lookup if not found by ID
        if (!profile && !pErr) {
          const { data: pByEmail } = await sbQuery<any>(
            () => supabase.from('profiles').select('*').ilike('email', userEmail).maybeSingle() as any
          );
          if (pByEmail) {
            await sbQuery(() => supabase.from('profiles').update({ id: session.user.id }).eq('email', pByEmail.email) as any);
            profile = pByEmail;
          }
        }

        if (pErr) {
          throw new Error(`Profile query timed out. The database project might be starting up from a cold state. Status: ${status}`);
        }

        // 3. Auto-Initialize if missing
        if (!profile) {
          setLoadingStatus('Setting up new account...');
          let { data: ws, error: wsSearchErr } = await sbQuery<any>(
            () => supabase.from('workspaces').select('*').eq('owner_id', session.user.id).limit(1).maybeSingle() as any
          );

          if (wsSearchErr) {
            console.error('[Sync] Workspace search error:', wsSearchErr);
          }

          if (!ws) {
            const { data: newWs, error: wsErr } = await sbQuery<any>(
              () => supabase.from('workspaces').insert({ 
                name: 'My Workspace', 
                owner_id: session.user.id 
              }).select().maybeSingle() as any
            );
            if (wsErr) throw new Error(`Workspace setup failed: ${wsErr.message}`);
            ws = newWs;
          }

          if (ws) {
            const initials = userEmail.substring(0, 2).toUpperCase();
            const { error: profErr } = await sbQuery(() => supabase.from('profiles').upsert({
              id: session.user.id,
              workspace_id: ws.id,
              initials,
              name: userEmail.split('@')[0],
              email: userEmail,
              role: 'Workspace Owner',
              permissions: 'admin',
              color: COLORS[0]
            }) as any);
            
            if (profErr) {
              console.error('[Sync] Profile upsert error:', profErr);
              throw new Error(`Profile setup failed: ${profErr.message}`);
            }
            
            // Re-fetch profile after creation to ensure we have the correct state
            const { data: refreshedProf } = await sbQuery<any>(() => supabase.from('profiles').select('*').eq('id', session.user.id).single() as any);
            profile = refreshedProf;
          }
        }

        if (!profile) {
          if (retries > 0) {
            retryTimeout = setTimeout(() => fetchData(retries - 1), 3000);
          } else {
            setFetchError("We couldn't set up your profile. Please try logging out and back in.");
          }
          return;
        }

        // 4. Load remaining data
        const workspace_id = profile.workspace_id;
        setLoadingStatus('Loading workspace data...');
        
        const loadCollection = async <T,>(name: string, query: () => Promise<any>) => {
          setLoadingStatus(`Loading ${name}...`);
          const res = await sbQuery<T>(query);
          if (res.error) console.error(`[Sync] Error loading ${name}:`, res.error);
          return res;
        };

        const [pRes, tRes, uRes] = await Promise.all([
          loadCollection<any[]>('projects', () => supabase.from('projects').select('*').eq('workspace_id', workspace_id) as any),
          loadCollection<any[]>('tasks', () => supabase.from('tasks').select('*').eq('workspace_id', workspace_id) as any),
          loadCollection<any[]>('profiles', () => supabase.from('profiles').select('*').eq('workspace_id', workspace_id) as any)
        ]);

        if (pRes.error || tRes.error || uRes.error) {
          throw new Error("One or more data collections failed to load. The database might be busy. Please refresh.");
        }

        setState({
          workspace_id,
          projects: (pRes.data || []).map(p => ({
            ...p,
            completedAt: p.completed_at
          })) as Project[],
          tasks: (tRes.data || []) as Task[],
          people: (uRes.data || []) as Person[]
        });
        setFetchError(null);
      } catch (err: any) {
        console.error('[Sync] Fatal Error:', err);
        setFetchError(err.message || 'Synchronisation failed due to server timeout.');
      }
    };
    fetchData();
    return () => clearTimeout(retryTimeout);
  }, [userEmail, refreshTrigger]);

  const saveData = useCallback(async (newState: AppState, updatedItem?: { type: 'project' | 'task' | 'person', data: any }) => {
    setSaveStatus('Saving…');
    try {
      if (!updatedItem) {
        setSaveStatus('Saved');
        return;
      }

      let error;
      const workspace_id = newState.workspace_id;

      if (updatedItem.type === 'project') {
        const projectData = {
          id: updatedItem.data.id,
          workspace_id,
          name: updatedItem.data.name,
          desc: updatedItem.data.desc,
          status: updatedItem.data.status,
          progress: updatedItem.data.progress,
          members: updatedItem.data.members,
          color: updatedItem.data.color,
          completed_at: updatedItem.data.completedAt
        };
        const { error: err } = await supabase.from('projects').upsert(projectData);
        error = err;
      } else if (updatedItem.type === 'task') {
        const taskData = {
          ...updatedItem.data,
          workspace_id
        };
        const { error: err } = await supabase.from('tasks').upsert(taskData);
        error = err;
      } else if (updatedItem.type === 'person') {
        let personData = {
          ...updatedItem.data,
          workspace_id
        } as any;

        // If person has no id, attempt to create an auth user + profile via server endpoint
        if (!personData.id) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (token) {
              const res = await fetch('/api/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                  email: personData.email,
                  name: personData.name,
                  workspace_id: workspace_id,
                  permissions: personData.permissions,
                  role: personData.role
                })
              });
              let body: any = null;
              try { body = await res.json(); } catch (e) { body = null; }
              if (res.ok) {
                personData.id = body?.user?.id || body?.user?.data?.id;
                personData.workspace_id = body?.profile?.workspace_id || workspace_id;
              } else {
                console.warn('[Supabase] create-user failed:', body);
                showToast('Could not create auth user; saved locally.');
                setSaveStatus('Saved (local)');
                return;
              }
            } else {
              console.warn('[Supabase] No session token to create user; saving locally.');
              showToast('No session token; saved locally.');
              setSaveStatus('Saved (local)');
              return;
            }
          } catch (err) {
            console.error('[Supabase] create-user error:', err);
            showToast('Failed to create auth user; saved locally.');
            setSaveStatus('Saved (local)');
            return;
          }
        }

        const { error: err } = await supabase.from('profiles').upsert(personData);
        error = err;
      }

      if (error) {
        console.error(`[Supabase] Save Error (${updatedItem.type}):`, error);
        showToast(`Sync Failed: ${error.message || 'The server rejected your changes'}`);
        throw error;
      }
      setSaveStatus('Saved');
    } catch (e: any) {
      console.error('[Supabase] Fatal Save Error:', e);
      setSaveStatus('Save sync failed');
      showToast('Sync error: Changes may not have saved to the cloud.');
    }
  }, [showToast]);

  const updateState = (updater: (prev: AppState) => AppState, updatedItem?: { type: 'project' | 'task' | 'person', data: any }) => {
    if (!state) return;
    const newState = updater(state);
    setState(newState);
    saveData(newState, updatedItem);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    setUserEmail(null);
    setState(null);
    navigate('/');
  };

  const archiveProject = async (projectName: string) => {
    const projectToArchive = state?.projects.find(p => p.name === projectName);
    if (!projectToArchive || !state) return;
    const workspace_id = state.workspace_id;

    const updatedProject = { ...projectToArchive, status: 'completed' as any, progress: 100, completedAt: new Date().toISOString() };
    updateState(prev => ({
      ...prev,
      projects: prev.projects.map(p => p.name === projectName ? updatedProject : p),
      tasks: prev.tasks.map(t => t.project === projectName ? { ...t, status: 'done' as any } : t)
    }), { type: 'project', data: updatedProject });

    try {
      await supabase.from('tasks').update({ status: 'done' }).eq('project', projectName).eq('workspace_id', workspace_id);
    } catch (err) {
      console.error('Archive tasks error:', err);
    }
    
    navigate('/projects');
    showToast(`Project "${projectName}" has been moved to the Archive.`);
  };

  return (
    <AppContext.Provider value={{
      state, userEmail, userPerms, currentUser, saveStatus, fetchError, refreshTrigger, loadingStatus,
      isSidebarOpen, setIsSidebarOpen, isKanbanExpanded, setIsKanbanExpanded,
      modal, setModal, updateState, handleLogout, showToast, toasts, today, archiveProject
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
