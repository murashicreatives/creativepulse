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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[Auth] Event: ${event}`);
      if (session?.user) {
        const email = session.user.email?.toLowerCase();
        if (!email) return;

        // Sync local state
        if (userEmail !== email) {
          console.log(`[Auth] Syncing userEmail: ${email}`);
          setUserEmail(email);
          localStorage.setItem('user_email', email);
        }

        // Check if profile exists (ID is best)
        console.log('[Auth] Verifying profile for UID:', session.user.id);
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('id, email, workspace_id')
          .eq('id', session.user.id)
          .maybeSingle();

        console.log('[Auth] Profile verify result:', { profile, error });

        if (error) {
          console.error('[Auth] Profile check error:', error);
          return;
        }

        if (profile) {
          console.log('[Auth] Profile verified by ID');
          if (profile.email?.toLowerCase() !== email) {
            console.log('[Auth] Updating profile email to match session');
            await supabase.from('profiles').update({ email }).eq('id', session.user.id);
          }
          setRefreshTrigger(prev => prev + 1);
          return;
        }

        // If not by ID, try by email (legacy or invite case)
        console.log('[Auth] Profile not found by ID, checking by email...');
        const { data: profileByEmail } = await supabase
          .from('profiles')
          .select('*')
          .ilike('email', email)
          .maybeSingle();

        if (profileByEmail) {
          console.log('[Auth] Profile found by email, linking ID');
          await supabase.from('profiles').update({ id: session.user.id }).eq('email', profileByEmail.email);
          setRefreshTrigger(prev => prev + 1);
          return;
        }

        // New user path: Ensure workspace then profile
        console.log('[Auth] New user detected. Initializing workspace...');
        let { data: ws } = await supabase.from('workspaces').select('*').eq('owner_id', session.user.id).limit(1).maybeSingle();
        
        if (!ws) {
          console.log('[Auth] Creating new workspace...');
          const { data: newWs, error: wsErr } = await supabase
            .from('workspaces')
            .insert({ name: 'My Workspace', owner_id: session.user.id })
            .select()
            .maybeSingle(); // Better than single() if multiple exist somehow
          
          console.log('[Auth] Workspace creation result:', { newWs, wsErr });
          
          if (wsErr) {
            console.error('[Auth] Workspace creation failed:', wsErr);
            setFetchError(`Workspace setup failed: ${wsErr.message}`);
            return;
          }
          ws = newWs;
        }

        if (ws) {
          console.log('[Auth] Creating profile for workspace:', ws.id);
          const initials = email.substring(0, 2).toUpperCase();
          const pData = {
            id: session.user.id,
            workspace_id: ws.id,
            initials,
            name: email.split('@')[0],
            email: email,
            role: 'Workspace Owner',
            permissions: 'admin',
            color: COLORS[0]
          };
          const { error: profErr } = await supabase.from('profiles').insert(pData);
          
          console.log('[Auth] Profile creation result:', { profErr });
          
          if (profErr) {
            console.error('[Auth] Profile creation error:', profErr);
            setFetchError(`Account setup failed: ${profErr.message}`);
          } else {
            console.log('[Auth] Success! Workspace and profile ready.');
            setRefreshTrigger(prev => prev + 1);
          }
        }
      } else {
        console.log('[Auth] No session found');
        setUserEmail(null);
        localStorage.removeItem('user_email');
        setState(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [userEmail]);

  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;
    const fetchData = async (retries = 3) => {
      if (!userEmail) {
        console.log('[Fetch] No userEmail. Session might not be ready.');
        return;
      }
      
      try {
        setFetchError(null);
        console.log(`[Fetch] Starting sync for ${userEmail}. Attempt: ${4 - retries}`);
        
        // 1. Get profile and workspace
        console.log('[Fetch] Querying profile for email:', userEmail);
        const { data: profile, error: pErr, status, statusText } = await supabase
          .from('profiles')
          .select('id, workspace_id')
          .ilike('email', userEmail)
          .maybeSingle();
        
        console.log('[Fetch] Profile query result:', { profile, pErr, status, statusText });

        if (pErr) {
          console.error('[Fetch] Profile Query Error Details:', pErr);
          throw new Error(`Profile Query Failed (${status}): ${pErr.message}. ${pErr.details || ''}`);
        }

        if (!profile) {
          console.log(`[Fetch] Profile not found for ${userEmail}. Retries left: ${retries}`);
          if (retries > 0) {
            console.log(`[Fetch] Retrying in 2s...`);
            retryTimeout = setTimeout(() => fetchData(retries - 1), 2000);
          } else {
            console.error('[Fetch] Max retries reached. Profile missing.');
            setFetchError(`Workspace profile for ${userEmail.toLowerCase()} not found. Try logging out and back in.`);
          }
          return;
        }

        const workspace_id = profile.workspace_id;
        console.log('[Fetch] Found workspace_id:', workspace_id);

        // 2. Load all workspace data
        console.log('[Fetch] Loading collections...');
        const [pRes, tRes, uRes] = await Promise.all([
          supabase.from('projects').select('*').eq('workspace_id', workspace_id),
          supabase.from('tasks').select('*').eq('workspace_id', workspace_id),
          supabase.from('profiles').select('*').eq('workspace_id', workspace_id)
        ]);

        if (pRes.error) { console.error('[Fetch] Projects Error:', pRes.error); throw pRes.error; }
        if (tRes.error) { console.error('[Fetch] Tasks Error:', tRes.error); throw tRes.error; }
        if (uRes.error) { console.error('[Fetch] Profiles Error:', uRes.error); throw uRes.error; }

        console.log(`[Fetch] Success! Loaded ${pRes.data?.length} projects, ${tRes.data?.length} tasks.`);

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
        console.error('[Fetch] Fatal Error:', err);
        setFetchError(err.message || 'Synchronisation failed.');
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
      state, userEmail, userPerms, currentUser, saveStatus, fetchError, refreshTrigger,
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
