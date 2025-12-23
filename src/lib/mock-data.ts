import { Company, Project, Element, Task, Status, User, Comment, Notification } from '@/types';

const generateRandomColor = () => {
  const colors = [
    '262 83% 58%', // Purple
    '221 83% 53%', // Blue
    '142 71% 45%', // Green
    '25 95% 53%',  // Orange
    '340 82% 52%', // Pink
    '47 96% 53%',  // Yellow
    '174 84% 38%', // Teal
    '0 72% 51%',   // Red
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

export const defaultStatuses: Status[] = [
  { id: '1', name: 'Pendente', color: '47 96% 53%', importance: 1 },
  { id: '2', name: 'Em andamento', color: '221 83% 53%', importance: 2 },
  { id: '3', name: 'Em revisão', color: '262 83% 58%', importance: 3 },
  { id: '4', name: 'Feito', color: '142 71% 45%', importance: 4 },
  { id: '5', name: 'Não se aplica', color: '0 0% 45%', importance: 0 },
];

export const mockUsers: User[] = [];

export const mockCompanies: Company[] = [];

export const mockProjects: Project[] = [];

export const mockElements: Element[] = [];

export const mockTasks: Task[] = [];

export const mockComments: Comment[] = [];

export const mockNotifications: Notification[] = [];

export { generateRandomColor };
