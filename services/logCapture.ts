/**
 * Log Capture Service
 * Intercepts all console.log/warn/error calls globally and stores them
 * in a circular buffer for real-time display in the profile's Sistema section.
 *
 * Initialize once at app startup: import '@/services/logCapture';
 */

type LogLevel = 'log' | 'warn' | 'error';

interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  message: string;
}

// Circular buffer — keep last N entries
const MAX_LOGS = 500;
const logBuffer: LogEntry[] = [];
let logId = 0;

// Subscribers for real-time updates
type Subscriber = (entry: LogEntry) => void;
const subscribers = new Set<Subscriber>();

// Throttle batch notifications — avoid overloading React with 100+ re-renders/sec
const THROTTLE_MS = 100; // Flush to subscribers at most every 100ms
let throttleTimer: ReturnType<typeof setTimeout> | null = null;
const pendingEntries: LogEntry[] = [];

function flushPendingEntries(): void {
  throttleTimer = null;
  // Notify subscribers with each pending entry (in order)
  for (const entry of pendingEntries) {
    subscribers.forEach(cb => {
      try {
        cb(entry);
      } catch {
        // Silently ignore subscriber errors
      }
    });
  }
  pendingEntries.length = 0;
}

function scheduleFlush(): void {
  if (throttleTimer) return; // Already scheduled
  throttleTimer = setTimeout(flushPendingEntries, THROTTLE_MS);
}

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

/** Format a log argument into a readable string */
function formatArg(arg: unknown): string {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    const str = JSON.stringify(arg, null, 0);
    return str && str.length < 200 ? str : str?.substring(0, 200) + '…';
  } catch {
    return String(arg);
  }
}

/** Add a log entry to the buffer and notify subscribers */
function addLogEntry(level: LogLevel, args: unknown[]): void {
  const message = args.map(formatArg).join(' ');
  const entry: LogEntry = {
    id: ++logId,
    timestamp: new Date().toLocaleTimeString('es-VE', { hour12: false }),
    level,
    message,
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }

  // Throttled notification — batch entries and flush at most every THROTTLE_MS
  pendingEntries.push(entry);
  scheduleFlush();
}

// --- Override console.log ---
console.log = function (...args: unknown[]) {
  originalConsole.log(...args);
  addLogEntry('log', args);
};

// --- Override console.warn ---
console.warn = function (...args: unknown[]) {
  originalConsole.warn(...args);
  addLogEntry('warn', args);
};

// --- Override console.error ---
console.error = function (...args: unknown[]) {
  originalConsole.error(...args);
  addLogEntry('error', args);
};

// --- Public API ---

/** Get all current logs (for initial load) */
export function getAllLogs(): LogEntry[] {
  return [...logBuffer];
}

/** Subscribe to new log entries. Returns an unsubscribe function. */
export function subscribeToLogs(callback: Subscriber): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/** Clear all captured logs (including pending throttled entries) */
export function clearLogs(): void {
  logBuffer.length = 0;
  pendingEntries.length = 0;
  if (throttleTimer !== null) {
    clearTimeout(throttleTimer);
    throttleTimer = null;
  }
}

/** Get current log count */
export function getLogCount(): number {
  return logBuffer.length;
}

export type { LogEntry, LogLevel };
export default { getAllLogs, subscribeToLogs, clearLogs, getLogCount };
