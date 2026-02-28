import { QueueTask, TaskStatus } from '../models';
import { DatabaseService } from './database.service';

export const QueueService = {
  addTask(type: string, payload: any): QueueTask {
    const now = Date.now();
    const task: QueueTask = {
      id: crypto.randomUUID(),
      type,
      payload: JSON.stringify(payload),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    DatabaseService.addTask({
      ...task,
      payload: task.payload as string, // DatabaseService expects stringified payload
    });

    return task;
  },

  getTasks(): QueueTask[] {
    const rows = DatabaseService.getTasks();
    return rows.map((row) => ({
      ...row,
      payload: JSON.parse(row.payload),
    }));
  },

  getNextPendingTask(): QueueTask | null {
    const row = DatabaseService.getNextPendingTask();
    if (!row) return null;

    return {
      ...row,
      payload: JSON.parse(row.payload),
    };
  },

  removeTask(id: string): void {
    DatabaseService.deleteTask(id);
  },

  updateTaskStatus(id: string, status: TaskStatus, error?: string): void {
    DatabaseService.updateTaskStatus(id, status, error);
  },

  clearFinishedTasks(): void {
    DatabaseService.clearFinishedTasks();
  },
};
