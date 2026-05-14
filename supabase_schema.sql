-- SQL Schema for Supabase Multi-tenancy
-- DANGER: This script drops existing tables to ensure a clean workspace structure.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;

-- Workspaces table
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES auth.users(id),
  access_key text UNIQUE,
  created_at timestamp with time zone DEFAULT now()
);

-- Profiles table (linked to auth.users and workspaces)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  initials text NOT NULL,
  name text NOT NULL,
  role text,
  email text UNIQUE NOT NULL,
  permissions text CHECK (permissions IN ('admin', 'editor', 'viewer')) DEFAULT 'viewer',
  color jsonb -- {bg: string, txt: string}
);

-- Projects table
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Invites table for admin-created invites
DROP TABLE IF EXISTS invites CASCADE;
CREATE TABLE invites (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  inviter_id uuid REFERENCES auth.users(id),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  role text,
  permissions text CHECK (permissions IN ('admin', 'editor', 'viewer')) DEFAULT 'viewer',
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_invites_workspace_id ON invites(workspace_id);

-- Project Policies (Simplified for troubleshooting)
CREATE POLICY "Project Access" ON projects 
  FOR ALL USING (true);

-- Task Policies (Simplified for troubleshooting)
CREATE POLICY "Task Access" ON tasks 
  FOR ALL USING (true);

-- Profile Policies (Simplified for troubleshooting)
CREATE POLICY "Profile Access" ON profiles
  FOR ALL USING (true);

-- Workspace Policies (Simplified for troubleshooting)
CREATE POLICY "Workspace Access" ON workspaces
  FOR ALL USING (true);
