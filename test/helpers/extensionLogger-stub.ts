/**
 * Logger stub for testing
 *
 * Provides a mock logger that captures log entries for verification in tests.
 * Can be used to assert that specific messages were logged.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  args?: unknown[];
}

// Internal state
const logEntries: LogEntry[] = [];
let captureEnabled = true;

/**
 * Mock logger object
 */
export const log = {
  debug(message: string, ...args: unknown[]): void {
    if (captureEnabled) {
      logEntries.push({ level: 'debug', message, timestamp: new Date(), args });
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (captureEnabled) {
      logEntries.push({ level: 'info', message, timestamp: new Date(), args });
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (captureEnabled) {
      logEntries.push({ level: 'warn', message, timestamp: new Date(), args });
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (captureEnabled) {
      logEntries.push({ level: 'error', message, timestamp: new Date(), args });
    }
  }
};

// Test helpers

/**
 * Get all captured log entries
 */
export function getLogEntries(): LogEntry[] {
  return [...logEntries];
}

/**
 * Get log entries filtered by level
 */
export function getLogEntriesByLevel(level: LogLevel): LogEntry[] {
  return logEntries.filter(e => e.level === level);
}

/**
 * Get the last log entry
 */
export function getLastLogEntry(): LogEntry | undefined {
  return logEntries[logEntries.length - 1];
}

/**
 * Get the last log entry of a specific level
 */
export function getLastLogEntryByLevel(level: LogLevel): LogEntry | undefined {
  const filtered = getLogEntriesByLevel(level);
  return filtered[filtered.length - 1];
}

/**
 * Check if any log entry contains a substring
 */
export function hasLogMessage(substring: string): boolean {
  return logEntries.some(e => e.message.includes(substring));
}

/**
 * Check if any log entry of a specific level contains a substring
 */
export function hasLogMessageAtLevel(level: LogLevel, substring: string): boolean {
  return logEntries.some(e => e.level === level && e.message.includes(substring));
}

/**
 * Get log entries containing a substring
 */
export function findLogEntries(substring: string): LogEntry[] {
  return logEntries.filter(e => e.message.includes(substring));
}

/**
 * Get the number of log entries
 */
export function getLogCount(): number {
  return logEntries.length;
}

/**
 * Get the number of log entries at a specific level
 */
export function getLogCountByLevel(level: LogLevel): number {
  return logEntries.filter(e => e.level === level).length;
}

/**
 * Enable or disable log capture
 */
export function setLogCaptureEnabled(enabled: boolean): void {
  captureEnabled = enabled;
}

/**
 * Clear all captured log entries
 */
export function clearLogEntries(): void {
  logEntries.length = 0;
}

/**
 * Reset the logger stub to initial state
 */
export function resetLoggerStub(): void {
  clearLogEntries();
  captureEnabled = true;
}
