/**
 * Hackathon 7.0 — Structured Logger
 *
 * Lightweight in-memory structured logger with rolling buffer.
 * Logs are NEVER persisted to disk — only held in memory.
 *
 * SECURITY: Raw biometric data (images, embeddings) must NEVER
 * be passed to the logger. Only timing, scores, and status codes.
 *
 * Usage:
 *   logger.log('INFO', 'FaceDetector', 'Detection complete', { latencyMs: 38 });
 *   // PROHIBITED: logger.log('INFO', 'Embedder', 'Embedding', { embedding: [...] });
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
  timestampMs: number;
}

class Logger {
  private logs: LogEntry[] = [];
  private readonly maxLogs = 500; // Rolling buffer, never persisted to disk

  /**
   * Log a structured entry.
   *
   * @param level - Log severity level
   * @param module - Module name (e.g., 'FaceDetector', 'SyncService')
   * @param message - Human-readable message
   * @param data - Optional structured data (NEVER raw biometrics)
   */
  log(
    level: LogLevel,
    module: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    const entry: LogEntry = {
      level,
      module,
      message,
      data,
      timestampMs: Date.now(),
    };
    this.logs.push(entry);

    // Roll buffer — oldest entries are discarded
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output in development only
    if (__DEV__) {
      const logFn = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
      console[logFn](`[${module}] ${message}`, data || '');
    }
  }

  /** Convenience methods */
  debug(module: string, message: string, data?: Record<string, unknown>): void {
    this.log('DEBUG', module, message, data);
  }

  info(module: string, message: string, data?: Record<string, unknown>): void {
    this.log('INFO', module, message, data);
  }

  warn(module: string, message: string, data?: Record<string, unknown>): void {
    this.log('WARN', module, message, data);
  }

  error(module: string, message: string, data?: Record<string, unknown>): void {
    this.log('ERROR', module, message, data);
  }

  /**
   * Get recent log entries.
   * Useful for debugging and benchmark reports.
   *
   * @param count - Number of recent entries to return
   * @returns Array of log entries (most recent last)
   */
  getRecentLogs(count = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Get all logs filtered by module name.
   */
  getLogsByModule(module: string): LogEntry[] {
    return this.logs.filter((log) => log.module === module);
  }

  /**
   * Clear all logs.
   */
  clear(): void {
    this.logs = [];
  }
}

export const logger = new Logger();
