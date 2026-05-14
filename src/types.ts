export interface Color {
  bg: string;
  txt: string;
}

export interface Comment {
  author: string;
  text: string;
  time: string;
}

export interface Project {
  id: number;
  name: string;
  desc: string;
  status: 'active' | 'review' | 'planning' | 'done' | 'completed';
  progress: number;
  members: string[];
  color: string;
  completedAt?: string;
}

export interface Task {
  id: number;
  name: string;
  project: string;
  assignee: string;
  due: string;
  priority: 'high' | 'med' | 'low';
  status: 'todo' | 'inprogress' | 'done';
  comments: Comment[];
}

export type PermissionLevel = 'admin' | 'editor' | 'viewer';

export interface Person {
  initials: string;
  name: string;
  role: string;
  email: string;
  permissions: PermissionLevel;
  password?: string;
  color: Color;
}

export interface AppState {
  projects: Project[];
  tasks: Task[];
  people: Person[];
}
