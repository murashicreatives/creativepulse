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
      console.log(`[Supabase] Timeout (45s). This often happens if the project is paused or cold. Retrying...`);
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
      console.log(`[Auth] Event: ${event}`);
      if (session?.user) {
        const email = session.user.email?.toLowerCase();
        if (!email) return;

        if (userEmail !== email) {
          console.log(`[Auth] User detected: ${email}`);
          setUserEmail(email);
          localStorage.setItem('user_email', email);
        }
        // Trigger fetch via refreshTrigger to ensure we start the consolidated logic
        setRefreshTrigger(prev => prev + 1);
      } else {
        console.log('[Auth] No session');
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
        console.log(`[Sync] Starting for ${userEmail}. Attempt ${4 - retries}`);
        
        // 1. Get/Verify session first (id check)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          console.log('[Sync] No active session found during fetch.');
          setLoadingStatus('Session expired. Please log in.');
          return;
        }

        // 2. Verify Profile & Workspace (Sequential to avoid race conditions)
        setLoadingStatus('Verifying profile...');
        let { data: profile, error: pErr, status } = await sbQuery<any>(
          () => supabase.from('profiles').select('id, email, workspace_id').eq('id', session.user.id).maybeSingle()
        );

        // Fallback to email lookup if not found by ID
        if (!profile && !pErr) {
          console.log('[Sync] Profile not found by ID, trying email...');
          const { data: pByEmail } = await sbQuery<any>(
            () => supabase.from('profiles').select('*').ilike('email', userEmail).maybeSingle()
          );
          if (pByEmail) {
            console.log('[Sync] Found profile by email, linking UID...');
            await sbQuery(() => supabase.from('profiles').update({ id: session.user.id }).eq('email', pByEmail.email));
            profile = pByEmail;
          }
        }

        if (pErr) {
          throw new Error(`Profile query timed out. The database project might be starting up from a cold state. Status: ${status}`);
        }

        // 3. Auto-Initialize if missing
        if (!profile) {
          setLoadingStatus('Setting up new account...');
          console.log('[Sync] New user init: checking workspace...');
          let { data: ws } = await sbQuery<any>(
            () => supabase.from('workspaces').select('*').eq('owner_id', session.user.id).limit(1).maybeSingle()
          );

          if (!ws) {
            console.log('[Sync] Creating workspace...');
            const { data: newWs, error: wsErr } = await sbQuery<any>(
              () => supabase.from('workspaces').insert({ name: 'My Workspace', owner_id: session.user.id }).select().maybeSingle()
            );
            if (wsErr) throw new Error(`Workspace setup failed: ${wsErr.message}`);
            ws = newWs;
          }

          if (ws) {
            console.log('[Sync] Creating profile...');
            const initials = userEmail.substring(0, 2).toUpperCase();
            const { error: profErr } = await sbQuery(() => supabase.from('profiles').insert({
              id: session.user.id,
              workspace_id: ws.id,
              initials,
              name: userEmail.split('@')[0],
              email: userEmail,
              role: 'Workspace Owner',
              permissions: 'admin',
              color: COLORS[0]
            }));
            if (profErr) throw new Error(`Profile setup failed: ${profErr.message}`);
            
            // Re-fetch profile after creation
            const { data: newProf } = await sbQuery<any>(() => supabase.from('profiles').select('*').eq('id', session.user.id).single());
            profile = newProf;
          }
        }

        if (!profile) {
          if (retries > 0) {
            console.log('[Sync] Profile still not ready, retrying in 3s...');
            retryTimeout = setTimeout(() => fetchData(retries - 1), 3000);
          } else {
            setFetchError("We couldn't set up your profile. Please try logging out and back in.");
          }
          return;
        }

        // 4. Load remaining data
        const workspace_id = profile.workspace_id;
        setLoadingStatus('Loading workspace data...');
        console.log('[Sync] Workspace identified. Loading collections...');
        
        // Improved logging for each collection
        const loadCollection = async <T,>(name: string, query: () => Promise<any>) => {
          setLoadingStatus(`Loading ${name}...`);
          console.log(`[Sync] Loading ${name}...`);
          const res = await sbQuery<T>(query);
          if (res.error) console.error(`[Sync] Error loading ${name}:`, res.error);
          else console.log(`[Sync] Loaded ${name}: ${Array.isArray(res.data) ? res.data.length : 'OK'}`);
          return res;
        };

        const [pRes, tRes, uRes] = await Promise.all([
          loadCollection<any[]>('projects', () => supabase.from('projects').select('*').eq('workspace_id', workspace_id)),
          loadCollection<any[]>('tasks', () => supabase.from('tasks').select('*').eq('workspace_id', workspace_id)),
          loadCollection<any[]>('profiles', () => supabase.from('profiles').select('*').eq('workspace_id', workspace_id))
        ]);

        if (pRes.error || tRes.error || uRes.error) {
          throw new Error("One or more data collections failed to load. The database might be busy. Please refresh.");
        }

        console.log(`[Sync] All collections loaded successfully.`);

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
        const { error: err } = await supabase.from('projects').upsert({
          id: updatedItem.data.id,
          workspace_id,
          name: updatedItem.data.name,
          desc: updatedItem.data.desc,
          status: updatedItem.data.status,
          progress: updatedItem.data.progress,
          members: updatedItem.data.members,
          color: updatedItem.data.color,
          completed_at: updatedItem.data.completedAt
        });
        error = err;
      } else if (updatedItem.type === 'task') {
        const { error: err } = await supabase.from('tasks').upsert({
          ...updatedItem.data,
          workspace_id
        });
        error = err;
      } else if (updatedItem.type === 'person') {
        const { error: err } = await supabase.from('profiles').upsert({
          ...updatedItem.data,
          workspace_id
        });
        error = err;
      }

      if (error) throw error;
      setSaveStatus('Saved');
    } catch (e) {
      setSaveStatus('Save failed');
    }
  }, []);

  const updateState = (updater: (prev: AppState) => AppState, updatedItem?: { type: 'project' | 'task' | 'person', data: any }) => {
    if (!state) return;
    const newState = updater(state);
    setState(newState);
    saveData(newState, updatedItem);
  };

  const showToast = (msg: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
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
