export type UserRole = 'supervisor' | 'gerente' | 'operador';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  avatar?: string;
}

export interface Company {
  id: string;
  name: string;
  color: string;
}

export interface Status {
  id: string;
  name: string;
  color: string;
  importance: number;
}

export interface Task {
  id: string;
  elementId: string;
  name: string;
  description?: string;
  estimatedValue?: number;
  observation?: string;
  statusId: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  responsibleId?: string;
  color: string;
  order: number;
  priority?: number;
  isHidden?: boolean;
  parentTaskId?: string;
}

export interface Element {
  id: string;
  projectId: string;
  name: string;
  color: string;
  order: number;
  isExpanded: boolean;
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'task_assigned' | 'meeting' | 'mention';
  read: boolean;
  createdAt: string;
  relatedId?: string;
}

export interface Meeting {
  id: string;
  elementId: string;
  title: string;
  date: string;
  participants: string[];
}
