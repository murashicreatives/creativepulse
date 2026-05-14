-- SQL Schema for Supabase Multi-tenancy
-- DANGER: This script drops existing tables to ensure a clean workspace structure.

DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS workspaces;

-- Workspaces table
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Profiles table (linked to auth.users and workspaces)
create table profiles (
  id uuid references auth.users(id),
  workspace_id uuid references workspaces(id) on delete cascade,
  initials text not null,
  name text not null,
  role text,
  email text unique not null,
  permissions text check (permissions in ('admin', 'editor', 'viewer')),
  color jsonb -- {bg: string, txt: string}
);

-- Primary key can be email or a composite, let's use email as a fallback unique ID
alter table profiles add primary key (email);

-- Projects table
create table projects (
  id bigint primary key generated always as identity,
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  "desc" text,
  status text check (status in ('active', 'review', 'planning', 'done', 'completed')),
  progress integer default 0,
  members text[] default '{}',
  color text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Tasks table
create table tasks (
  id bigint primary key generated always as identity,
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  project text, 
  assignee text,
  due date,
  priority text check (priority in ('high', 'med', 'low')),
  status text check (status in ('todo', 'inprogress', 'done')),
  comments jsonb default '[]',
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security (RLS)
alter table workspaces enable row level security;
alter table profiles enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;

-- Policies: Users can only access data within their own workspace

create policy "Workspace Access" on workspaces 
  for all using (auth.uid() = owner_id);

-- Profile policies
create policy "Profile Read by Own Email" on profiles 
  for select using (email = (auth.jwt() ->> 'email'));

create policy "Profile Workspace Access" on profiles 
  for all using (workspace_id in (select workspace_id from profiles where id = auth.uid()));

-- Project policies
create policy "Project Access" on projects 
  for all using (workspace_id in (select workspace_id from profiles where id = auth.uid()));

-- Task policies
create policy "Task Access" on tasks 
  for all using (workspace_id in (select workspace_id from profiles where id = auth.uid()));

-- Indices
create index idx_profiles_workspace_id on profiles(workspace_id);
create index idx_profiles_id on profiles(id);
create index idx_projects_workspace_id on projects(workspace_id);
create index idx_tasks_workspace_id on tasks(workspace_id);
