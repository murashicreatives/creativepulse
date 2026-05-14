import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { COLORS } from '../contexts/AppContext';

export default function Login() {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isJoin, setIsJoin] = useState(false);
  const [joinKey, setJoinKey] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    const f = e.target as any;
    const email = f.email.value.toLowerCase();
    const password = f.password.value;
    const workspaceName = isSignUp ? f.workspaceName.value : null;

    try {
      if (isSignUp) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        const { data: authData, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
        
        if (authData.user) {
          if (existingProfile) {
            const { error: linkErr } = await supabase
              .from('profiles')
              .update({ id: authData.user.id })
              .eq('email', email);
            
            if (linkErr) throw linkErr;
            
            if (!authData.session) {
              setLoginError('Verification email sent. Please check your inbox.');
            }
          } else {
            const { data: ws, error: wsErr } = await supabase
              .from('workspaces')
              .insert({ name: workspaceName || 'New Workspace', owner_id: authData.user.id })
              .select()
              .single();
            
            if (wsErr) throw wsErr;

            const initials = email.substring(0, 2).toUpperCase();
            const { error: profErr } = await supabase.from('profiles').insert({
              id: authData.user.id,
              workspace_id: ws.id,
              initials,
              name: email.split('@')[0],
              email,
              role: 'Workspace Owner',
              permissions: 'admin',
              color: COLORS[0]
            });

            if (profErr) throw profErr;

            if (!authData.session) {
              setLoginError('Verification email sent. Please check your inbox.');
            }
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (e: any) {
      setLoginError(e.message || 'Authentication failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoginError(null);
      // Using signInWithOAuth with window.location.origin
      // Note: redirect_uri_mismatch on Google side usually means 
      // the Supabase callback URL isn't authorized in Google Cloud Console.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });
      if (error) throw error;
    } catch (e: any) {
      setLoginError(e.message || 'Google login failed');
    }
  };

  return (
    <div className="login-screen animate-in fade-in duration-700">
      <div className="login-box">
        <div className="login-logo"><i className="ti ti-layout-kanban"></i> Creative Pulse</div>
        <div className="login-title">{isSignUp ? 'Create your workspace account' : 'Sign in to your workspace'}</div>
        
        {loginError && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[10px] font-medium flex items-center gap-2">
            <i className="ti ti-alert-circle"></i> {loginError}
          </div>
        )}

        <form onSubmit={handleLogin} className="text-left">
          {isSignUp && (
            <div className="form-group mb-6">
              <label className="form-label mb-2">Workspace Name</label>
              <input type="text" name="workspaceName" className="form-input" placeholder="Acme Corp" required />
            </div>
          )}
          <div className="form-group mb-6">
            <label className="form-label mb-2">Email Address</label>
            <input type="email" name="email" className="form-input" placeholder="name@company.com" required />
          </div>
          <div className="form-group mb-6">
            <label className="form-label mb-2">Password</label>
            <input type="password" name="password" className="form-input" placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn btn-primary w-full py-2.5 mt-2" disabled={isLoggingIn}>
            {isLoggingIn ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>

          <div className="relative my-6 text-center">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-slate-100"></div>
            <span className="relative bg-white px-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">Or continue with</span>
          </div>

          <button 
            type="button" 
            onClick={handleGoogleLogin}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Google
          </button>
          
          <div className="mt-6 pt-4 border-t border-slate-50 text-[11px] text-center">
            <span className="text-slate-400">{isSignUp ? 'Already have an account?' : 'New here?'} </span>
            <button 
              type="button" 
              className="text-indigo-600 font-bold hover:underline border-none bg-none p-0 uppercase tracking-wider" 
              onClick={() => { setIsSignUp(!isSignUp); setLoginError(null); }}
            >
              {isSignUp ? 'Sign In' : 'Create Account'}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative my-4 text-center">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-slate-100"></div>
            <span className="relative bg-white px-2 text-[10px] uppercase font-bold tracking-wider text-slate-400">Or join with access key</span>
          </div>

          <div className="text-left max-w-md mx-auto">
            {joinError && <div className="mb-3 p-2 bg-red-50 text-red-600 rounded">{joinError}</div>}
            <div className="form-group mb-3">
              <label className="form-label mb-1">Workspace Access Key</label>
              <input value={joinKey} onChange={e => setJoinKey(e.target.value)} className="form-input" placeholder="Enter workspace access key" />
            </div>
            <div className="form-group mb-3">
              <label className="form-label mb-1">Your Email</label>
              <input id="join-email" className="form-input" placeholder="you@company.com" />
            </div>
            <div className="form-group mb-3">
              <label className="form-label mb-1">Password (optional)</label>
              <input id="join-password" type="password" className="form-input" placeholder="Choose a password or leave empty" />
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" onClick={async () => {
                setJoinError(null);
                setIsJoining(true);
                try {
                  const email = (document.getElementById('join-email') as HTMLInputElement)?.value?.toLowerCase();
                  const password = (document.getElementById('join-password') as HTMLInputElement)?.value;
                  if (!joinKey) throw new Error('Access key required');
                  if (!email) throw new Error('Email required');
                  const res = await fetch('/api/join-with-key', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_key: joinKey, email, password })
                  });
                  const body = await res.json().catch(() => null);
                  if (!res.ok) throw body || new Error(`HTTP ${res.status}`);

                  // If server returned a tempPassword, sign the user in automatically
                  const temp = body?.tempPassword;
                  if (temp) {
                    const { error } = await supabase.auth.signInWithPassword({ email, password: temp });
                    if (error) throw error;
                  } else if (password) {
                    // If user provided a password, sign them in with it
                    const { error } = await supabase.auth.signInWithPassword({ email, password });
                    if (error) throw error;
                  }

                  // Success: reload to fetch profile
                  window.location.reload();
                } catch (err: any) {
                  setJoinError(err?.message || String(err));
                } finally {
                  setIsJoining(false);
                }
              }} disabled={isJoining}>{isJoining ? 'Joining...' : 'Join Workspace'}</button>
              <button className="btn" onClick={() => { setJoinKey(''); setJoinError(null); }}>{'Clear'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

