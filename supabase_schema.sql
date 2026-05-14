-- SQL Schema for Supabase

-- Projects table
create table projects (
  id bigint primary key generated always as identity,
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
  name text not null,
  project text, -- Can be linked to project name or ID, keeping it simple as per current app
  assignee text,
  due date,
  priority text check (priority in ('high', 'med', 'low')),
  status text check (status in ('todo', 'inprogress', 'done')),
  comments jsonb default '[]',
  created_at timestamp with time zone default now()
);

-- People/Team table (Optional if using Supabase Auth, but good for profile data)
create table profiles (
  initials text primary key,
  name text not null,
  role text,
  email text unique not null,
  permissions text check (permissions in ('admin', 'editor', 'viewer')),
  color jsonb -- {bg: string, txt: string}
);

-- Enable Row Level Security (RLS) - Basic "all access for anon" for demo, or more restrictive for production
alter table projects enable row level security;
alter table tasks enable row level security;
alter table profiles enable row level security;

create policy "Public Access" on projects for all using (true);
create policy "Public Access" on tasks for all using (true);
create policy "Public Access" on profiles for all using (true);
