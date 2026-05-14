import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'Server missing Supabase service role configuration' });
    }

    const { access_key, email, password, name, role = 'Team Member', permissions = 'viewer', color } = req.body;
    if (!access_key) return res.status(400).json({ error: 'access_key required' });
    if (!email) return res.status(400).json({ error: 'email required' });

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find workspace by access_key
    const { data: ws, error: wsErr } = await supabaseAdmin.from('workspaces').select('id').eq('access_key', access_key).maybeSingle();
    if (wsErr) return res.status(500).json({ error: wsErr });
    if (!ws || !ws.id) return res.status(404).json({ error: 'Invalid access key' });

    // Create auth user
    const tempPassword = password || (Math.random().toString(36).slice(-10) + 'aA1!');
    const createRes: any = await supabaseAdmin.auth.admin.createUser({ email, password: tempPassword, user_metadata: { name } });
    if (createRes.error) return res.status(400).json({ error: createRes.error });

    const createdUser = createRes.data?.user || createRes.user || createRes;
    const userId = createdUser?.id;
    if (!userId) return res.status(500).json({ error: 'Failed to create user' });

    const initials = (name || email).substring(0, 2).toUpperCase();
    const profile = {
      id: userId,
      workspace_id: ws.id,
      initials,
      name: name || email.split('@')[0],
      email,
      role,
      permissions,
      color: color || null
    };

    const { error: profileErr } = await supabaseAdmin.from('profiles').insert(profile);
    if (profileErr) return res.status(500).json({ error: profileErr });

    return res.json({ user: createdUser, profile, tempPassword: password ? null : tempPassword });
  } catch (err: any) {
    console.error('join-with-key API error', err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}
