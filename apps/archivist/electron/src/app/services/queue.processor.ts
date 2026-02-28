import {
  AnalysisResult,
  IPC_CHANNELS,
  QueueTask,
} from '@medularity/archivist-core';
import { BrowserWindow } from 'electron';
import { AnalysisService } from './analysis.service';
import { QueueService } from './queue.service';

/**
 * Background Task Processor for the Electron Main process.
 * Polling loop that executes pending tasks from the SQLite queue.
 */
export const QueueProcessor = {
  internalState: {
    isActive: false,
    isProcessing: false,
    mainWindow: null as BrowserWindow | null,
  },

  setMainWindow(window: BrowserWindow): void {
    this.internalState.mainWindow = window;
  },

  start(): void {
    if (this.internalState.isActive) return;
    this.internalState.isActive = true;
    console.log('[QueueProcessor] Background engine started');
    this.notifyFrontend(IPC_CHANNELS.QUEUE_STATUS_CHANGED, { isActive: true });
    this.processLoop();
  },

  stop(): void {
    if (!this.internalState.isActive) return;
    this.internalState.isActive = false;
    console.log('[QueueProcessor] Background engine stopped');
    this.notifyFrontend(IPC_CHANNELS.QUEUE_STATUS_CHANGED, { isActive: false });
  },

  async processLoop(): Promise<void> {
    if (!this.internalState.isActive) return;

    // Avoid concurrent processing of the loop itself
    if (this.internalState.isProcessing) return;

    try {
      const task = QueueService.getNextPendingTask();

      if (task) {
        this.internalState.isProcessing = true;
        await this.executeTask(task);
        this.internalState.isProcessing = false;

        // Immediate next if task was found
        setImmediate(() => this.processLoop());
      } else {
        // Slow poll if no task found
        setTimeout(() => this.processLoop(), 5000);
      }
    } catch (error) {
      console.error('[QueueProcessor] Loop error:', error);
      this.internalState.isProcessing = false;
      setTimeout(() => this.processLoop(), 5000);
    }
  },

  async executeTask(task: QueueTask): Promise<void> {
    console.log(`[QueueProcessor] Executing task: ${task.id} (${task.type})`);

    // 1. Mark as processing
    QueueService.updateTaskStatus(task.id, 'processing');
    this.notifyFrontend(IPC_CHANNELS.QUEUE_TASK_STARTED, {
      id: task.id,
      type: task.type,
    });

    try {
      // 2. Route by type
      if (task.type === 'fix-match') {
        const result = await AnalysisService.applyFix(
          task.payload as AnalysisResult,
        );
        if (result) {
          QueueService.updateTaskStatus(task.id, 'success');
          this.notifyFrontend(IPC_CHANNELS.QUEUE_TASK_COMPLETED, {
            id: task.id,
          });
        } else {
          throw new Error('AnalysisService.applyFix returned null');
        }
      } else {
        throw new Error(`Unknown task type: ${task.type}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[QueueProcessor] Task failed: ${task.id}`, errorMessage);
      QueueService.updateTaskStatus(task.id, 'error', errorMessage);
      this.notifyFrontend(IPC_CHANNELS.QUEUE_TASK_FAILED, {
        id: task.id,
        error: errorMessage,
      });
    }
  },

  notifyFrontend(channel: IPC_CHANNELS, data: any): void {
    if (this.internalState.mainWindow) {
      this.internalState.mainWindow.webContents.send(channel, data);
    }
  },
};
