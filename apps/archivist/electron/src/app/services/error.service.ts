import { BrowserWindow } from 'electron';

export interface BackendError {
  id: string;
  timestamp: number;
  operation: string;
  message: string;
  path?: string;
  code?: string;
  details?: unknown;
}

class ErrorServiceImpl {
  private errors: BackendError[] = [];
  private mainWindow: BrowserWindow | null = null;
  private readonly MAX_ERRORS = 100; // Keep last 100 errors

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Log an error and emit it to the frontend
   */
  logError(
    operation: string,
    error: unknown,
    path?: string
  ): BackendError {
    const errorObj = this.parseError(error);
    
    const backendError: BackendError = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      operation,
      message: errorObj.message,
      path,
      code: errorObj.code,
      details: errorObj.details,
    };

    // Add to error log
    this.errors.push(backendError);
    
    // Trim to max size
    if (this.errors.length > this.MAX_ERRORS) {
      this.errors = this.errors.slice(-this.MAX_ERRORS);
    }

    // Emit to frontend
    this.emitError(backendError);

    // Also log to console for debugging
    console.error(`Error in '${operation}':`, error);

    return backendError;
  }

  /**
   * Get all errors
   */
  getErrors(): BackendError[] {
    return [...this.errors];
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Send error to frontend via IPC
   */
  private emitError(error: BackendError): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('backend-error', error);
    }
  }

  /**
   * Parse error object to extract useful info
   */
  private parseError(error: unknown): { message: string; code?: string; details?: unknown } {
    if (error instanceof Error) {
      const nodeError = error as NodeJS.ErrnoException;
      return {
        message: error.message,
        code: nodeError.code,
        details: {
          stack: error.stack,
          syscall: nodeError.syscall,
          errno: nodeError.errno,
        },
      };
    }
    
    if (typeof error === 'string') {
      return { message: error };
    }
    
    return { message: String(error), details: error };
  }
}

// Singleton instance
export const ErrorService = new ErrorServiceImpl();
