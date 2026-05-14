import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Server missing Supabase service role configuration' });
    }

    const authHeader = (req.headers.authorization as string) || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    if (!token) return res.status(401).json({ error: 'Missing authorization token' });

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token as string);
    if (callerErr || !callerData?.user) return res.status(401).json({ error: 'Invalid token' });
    const callerId = callerData.user.id;

    const { data: callerProfile } = await supabaseAdmin.from('profiles').select('permissions').eq('id', callerId).maybeSingle();
    if (!callerProfile || callerProfile.permissions !== 'admin') {
      return res.status(403).json({ error: 'Only workspace admins can create accounts' });
    }

    const { email, password, name, workspace_id, permissions = 'viewer', role = 'Team Member', color } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    const tempPassword = password || (Math.random().toString(36).slice(-10) + 'aA1!');
    const createRes: any = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      user_metadata: { name }
    });

    if (createRes.error) {
      return res.status(400).json({ error: createRes.error });
    }

    const createdUser = createRes.data?.user || createRes.user || createRes;
    const userId = createdUser?.id;
    if (!userId) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    const initials = (name || email).substring(0, 2).toUpperCase();
    const profile = {
      id: userId,
      workspace_id: workspace_id || null,
      initials,
      name: name || email.split('@')[0],
      email,
      role,
      permissions,
      color: color || null
    };

    const { error: profileErr } = await supabaseAdmin.from('profiles').insert(profile);
    if (profileErr) {
      return res.status(500).json({ error: profileErr });
    }

    return res.json({ user: createdUser, profile });
  } catch (err: any) {
    console.error('create-user API error', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
