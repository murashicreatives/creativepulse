import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Admin: create user + profile
  app.post('/api/create-user', async (req, res) => {
    try {
      const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Server missing Supabase service role configuration' });
      }

      // Expect the caller to provide their access token so the server can verify they are an admin.
      const authHeader = (req.headers.authorization as string) || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
      if (!token) return res.status(401).json({ error: 'Missing authorization token' });

      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Verify caller's token to obtain their user id
      const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(token as string);
      if (callerErr || !callerData?.user) return res.status(401).json({ error: 'Invalid token' });
      const callerId = callerData.user.id;

      // Verify the caller has admin permissions in the profiles table
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
      console.error('create-user error', err);
      return res.status(500).json({ error: err?.message || String(err) });
    }
  });

  // Invite endpoint: create invite record and send email with token link
  app.post('/api/invite-user', async (req, res) => {
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

      const { data: callerProfile } = await supabaseAdmin.from('profiles').select('permissions,workspace_id').eq('id', callerId).maybeSingle();
      if (!callerProfile || callerProfile.permissions !== 'admin') return res.status(403).json({ error: 'Only admins can invite' });

      const { email, name, workspace_id, permissions = 'viewer', role = 'Team Member', expires_in_hours = 72 } = req.body;
      if (!email) return res.status(400).json({ error: 'email required' });

      // insert invite
      const expires_at = new Date(Date.now() + (Number(expires_in_hours) || 72) * 3600 * 1000).toISOString();
      const { data: inviteRow, error: inviteErr } = await supabaseAdmin.from('invites').insert({ email, inviter_id: callerId, workspace_id: workspace_id || callerProfile.workspace_id, permissions, role, expires_at }).select().maybeSingle();
      if (inviteErr) return res.status(500).json({ error: inviteErr });

      const tokenVal = inviteRow.token;
      const origin = req.headers.origin || process.env.ORIGIN || 'http://localhost:3000';
      const inviteLink = `${origin}/invite?token=${tokenVal}`;

      // send email via SMTP
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = Number(process.env.SMTP_PORT || 587);
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const fromEmail = process.env.FROM_EMAIL || 'noreply@example.com';

      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpPort === 465, auth: { user: smtpUser, pass: smtpPass } });
        await transporter.sendMail({ from: fromEmail, to: email, subject: 'You are invited', text: `You have been invited. Click to accept: ${inviteLink}`, html: `<p>You have been invited to join. <a href="${inviteLink}">Accept Invitation</a></p>` });
      }

      return res.json({ invite: inviteRow, link: inviteLink });
    } catch (err: any) {
      console.error('invite-user error', err);
      return res.status(500).json({ error: err?.message || String(err) });
    }
  });

  // Accept invite: create auth user with supplied password and create profile
  app.post('/api/accept-invite', async (req, res) => {
    try {
      const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Server missing Supabase service role configuration' });
      }
      const { token, password, name } = req.body;
      if (!token || !password) return res.status(400).json({ error: 'token and password required' });

      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: invite } = await supabaseAdmin.from('invites').select('*').eq('token', token).maybeSingle();
      if (!invite) return res.status(400).json({ error: 'Invalid invite' });
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) return res.status(400).json({ error: 'Invite expired' });

      // create auth user
      const createRes: any = await supabaseAdmin.auth.admin.createUser({ email: invite.email, password, user_metadata: { name } });
      if (createRes.error) return res.status(500).json({ error: createRes.error });
      const createdUser = createRes.data?.user || createRes.user || createRes;
      const userId = createdUser?.id;

      const profile = {
        id: userId,
        workspace_id: invite.workspace_id,
        initials: (name || invite.email).substring(0,2).toUpperCase(),
        name: name || invite.email.split('@')[0],
        email: invite.email,
        role: invite.role,
        permissions: invite.permissions,
        color: null
      };
      const { error: profileErr } = await supabaseAdmin.from('profiles').insert(profile);
      if (profileErr) return res.status(500).json({ error: profileErr });

      // remove invite
      await supabaseAdmin.from('invites').delete().eq('token', token);

      return res.json({ user: createdUser, profile });
    } catch (err: any) {
      console.error('accept-invite error', err);
      return res.status(500).json({ error: err?.message || String(err) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // SPA fallback: Return index.html for any unknown route
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // In production, serve the built files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    
    // SPA fallback: return index.html for any unknown route
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
