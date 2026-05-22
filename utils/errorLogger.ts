/**
 * Error Logger Utility
 * Logs all errors to console with detailed information
 */

export class ErrorLogger {
  private static instance: ErrorLogger;
  private errorCount = 0;

  private constructor() {
    this.setupGlobalErrorHandlers();
  }

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  private setupGlobalErrorHandlers() {
    // Store original console methods BEFORE any interception
    const originalConsoleError = console.error.bind(console);
    const originalConsoleWarn = console.warn.bind(console);
    const originalConsoleLog = console.log.bind(console);

    // Store them in the instance to use later
    (this as any).originalConsoleError = originalConsoleError;
    (this as any).originalConsoleWarn = originalConsoleWarn;
    (this as any).originalConsoleLog = originalConsoleLog;

    // DO NOT intercept console methods - this causes infinite loops
    // Instead, let components call errorLogger.logError() directly
  }

  logError(context: string, error: any, additionalInfo?: any) {
    this.errorCount++;

    const timestamp = new Date().toISOString();
    const errorInfo = this.extractErrorInfo(error);

    // Use original console.error to avoid infinite loops
    const originalError = (this as any).originalConsoleError || console.error.bind(console);

    originalError('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    originalError(`🔴 ERROR #${this.errorCount} [${timestamp}]`);
    originalError(`📍 Context: ${context}`);
    originalError(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    if (errorInfo.message) {
      originalError(`💬 Message: ${errorInfo.message}`);
    }

    if (errorInfo.stack) {
      originalError(`📚 Stack Trace:`);
      originalError(errorInfo.stack);
    }

    if (errorInfo.name) {
      originalError(`🏷️  Error Type: ${errorInfo.name}`);
    }

    if (additionalInfo) {
      originalError(`ℹ️  Additional Info:`, additionalInfo);
    }

    originalError('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  logWarning(context: string, warning: any) {
    const timestamp = new Date().toISOString();

    const originalWarn = (this as any).originalConsoleWarn || console.warn.bind(console);

    const info = typeof warning === 'object' && warning !== null
      ? ` ${JSON.stringify(warning)}`
      : ` ${warning}`;

    originalWarn(`⚠️ [${timestamp}] ${context}${info}`);
  }

  logInfo(context: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();

    // Use original console.log to avoid any potential issues
    const originalLog = (this as any).originalConsoleLog || console.log.bind(console);

    originalLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    originalLog(`ℹ️  INFO [${timestamp}]`);
    originalLog(`📍 Context: ${context}`);
    originalLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    originalLog(`💬 ${message}`);

    if (data) {
      originalLog(`📦 Data:`, data);
    }

    originalLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  private extractErrorInfo(error: any): { message?: string; stack?: string; name?: string } {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        name: error.name,
      };
    }

    if (typeof error === 'string') {
      return { message: error };
    }

    if (error && typeof error === 'object') {
      return {
        message: error.message || JSON.stringify(error),
        stack: error.stack,
        name: error.name,
      };
    }

    return { message: String(error) };
  }

  getErrorCount(): number {
    return this.errorCount;
  }

  resetErrorCount() {
    this.errorCount = 0;
  }
}

// Export singleton instance
export const errorLogger = ErrorLogger.getInstance();

// Export convenience functions
export const logError = (context: string, error: any, additionalInfo?: any) => {
  errorLogger.logError(context, error, additionalInfo);
};

export const logWarning = (context: string, warning: any) => {
  errorLogger.logWarning(context, warning);
};

export const logInfo = (context: string, message: string, data?: any) => {
  errorLogger.logInfo(context, message, data);
};
