-- SQL Schema for Supabase Multi-tenancy
-- DANGER: This script drops existing tables to ensure a clean workspace structure.

DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;

-- Workspaces table
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Profiles table (linked to auth.users and workspaces)
CREATE TABLE profiles (
  id uuid REFERENCES auth.users(id),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  initials text NOT NULL,
  name text NOT NULL,
  role text,
  email text PRIMARY KEY,
  permissions text CHECK (permissions IN ('admin', 'editor', 'viewer')),
  color jsonb -- {bg: string, txt: string}
);

-- Projects table
CREATE TABLE projects (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  "desc" text,
  status text CHECK (status IN ('active', 'review', 'planning', 'done', 'completed')),
  progress integer DEFAULT 0,
  members text[] DEFAULT '{}',
  color text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Tasks table
CREATE TABLE tasks (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  project text, 
  assignee text,
  due date,
  priority text CHECK (priority IN ('high', 'med', 'low')),
  status text CHECK (status IN ('todo', 'inprogress', 'done')),
  comments jsonb DEFAULT '[]',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_profiles_workspace_id ON profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON tasks(workspace_id);

-- Workspace Policies
CREATE POLICY "Allow anyone to create a workspace" ON workspaces 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow workspace view" ON workspaces 
  FOR SELECT USING (true); -- Broad view to avoid mapping issues, narrow in production

CREATE POLICY "Allow workspace owner to update" ON workspaces 
  FOR UPDATE USING (auth.uid() = owner_id);

-- Profile Policies
CREATE POLICY "Allow anyone to create a profile" ON profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow users to read profiles in their workspace" ON profiles
  FOR SELECT USING (true); -- Allow read for login discovery

CREATE POLICY "Allow user to update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Project Policies
CREATE POLICY "Project Workspace Access" ON projects 
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid() OR email = (auth.jwt() ->> 'email')
    )
  );

-- Task Policies
CREATE POLICY "Task Workspace Access" ON tasks 
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM profiles WHERE id = auth.uid() OR email = (auth.jwt() ->> 'email')
    )
  );
