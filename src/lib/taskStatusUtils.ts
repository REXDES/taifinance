import { Status } from '@/types';

// Interface para tarefas (suporta snake_case do banco ou camelCase)
interface TaskWithStatus {
  id: string;
  status_id?: string | null;
  statusId?: string | null;
}

export interface AggregatedStatus {
  statusId: string | null;
  status: Status | null;
  progress: {
    completed: number;
    total: number;
  };
}

/**
 * Calcula o status agregado de uma tarefa baseado nas sub-tarefas
 * Usa a lógica de "status mínimo": retorna o status com menor prioridade (mais atrasado)
 * O status com maior prioridade é considerado "concluído"
 */
export function calculateAggregatedStatus(
  subtasks: TaskWithStatus[],
  statuses: Status[]
): AggregatedStatus {
  if (subtasks.length === 0 || statuses.length === 0) {
    return { statusId: null, status: null, progress: { completed: 0, total: 0 } };
  }

  // Ordena statuses por importance (menor = mais atrasado, maior = mais avançado/concluído)
  const sortedStatuses = [...statuses].sort((a, b) => a.importance - b.importance);
  const highestImportanceStatus = sortedStatuses[sortedStatuses.length - 1];

  // Helper para pegar o statusId de uma task (suporta ambos formatos)
  const getStatusId = (task: TaskWithStatus) => task.statusId ?? task.status_id;

  // Conta quantas sub-tarefas estão "concluídas" (status com maior importance)
  const completedCount = subtasks.filter(
    task => getStatusId(task) === highestImportanceStatus?.id
  ).length;

  // Encontra o status com menor importance entre as sub-tarefas (mais atrasado)
  let minImportance = Infinity;
  let aggregatedStatusId: string | null = null;

  for (const subtask of subtasks) {
    const statusId = getStatusId(subtask);
    const subtaskStatus = statuses.find(s => s.id === statusId);
    if (subtaskStatus && subtaskStatus.importance < minImportance) {
      minImportance = subtaskStatus.importance;
      aggregatedStatusId = subtaskStatus.id;
    }
  }

  // Se nenhuma sub-tarefa tem status, usa null
  const hasSubtaskWithoutStatus = subtasks.some(t => !getStatusId(t));
  if (aggregatedStatusId === null && hasSubtaskWithoutStatus) {
    return {
      statusId: null,
      status: null,
      progress: { completed: completedCount, total: subtasks.length }
    };
  }

  const aggregatedStatus = statuses.find(s => s.id === aggregatedStatusId) || null;

  return {
    statusId: aggregatedStatusId,
    status: aggregatedStatus,
    progress: {
      completed: completedCount,
      total: subtasks.length
    }
  };
}
