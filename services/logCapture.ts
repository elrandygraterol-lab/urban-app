/**
 * Log Capture Service
 * Intercepts all console.log/warn/error calls globally and stores them
 * in a circular buffer for real-time display in the profile's Sistema section.
 *
 * Remote delivery to the backend is DISABLED: app logs no longer travel to
 * the server (avoids constant ingestion/load). Local buffer remains fully
 * functional for the in-app Sistema log viewer.
 *
 * Initialize once at app startup: import '@/services/logCapture';
 */

type LogLevel = 'log' | 'warn' | 'error';
type LogCategory = 'socket' | 'network' | 'auth' | 'ui' | 'system';

interface LogEntry {
  id: number;
  timestamp: string;
  iso: string;
  level: LogLevel;
  message: string;
  source: string;
  category: LogCategory;
}

// Circular buffer — keep last N entries
const MAX_LOGS = 1000;
const logBuffer: LogEntry[] = [];
let logId = 0;

// Subscribers for real-time updates
type Subscriber = (entry: LogEntry) => void;
const subscribers = new Set<Subscriber>();

// Throttle batch notifications
const THROTTLE_MS = 100;
let throttleTimer: ReturnType<typeof setTimeout> | null = null;
const pendingEntries: LogEntry[] = [];

function flushPendingEntries(): void {
  throttleTimer = null;
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
  if (throttleTimer) return;
  throttleTimer = setTimeout(flushPendingEntries, THROTTLE_MS);
}

// Store original console methods
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

const SOURCE_TAG_REGEX = /^\[(\w+)\]/;

const SOURCE_CATEGORY_MAP: Record<string, LogCategory> = {
  SOCKET: 'socket',
  GLOBAL_SOCKET: 'socket',
  DRIVER_PROFILE: 'ui',
  PROFILE: 'ui',
  AUTH: 'auth',
  REFRESH: 'auth',
  TOKEN: 'auth',
  API: 'network',
  NET: 'network',
  DIAG: 'system',
  SYSTEM: 'system',
};

function detectSource(message: string): string {
  const match = message.match(SOURCE_TAG_REGEX);
  if (match) return match[1];
  return 'APP';
}

function detectCategory(source: string): LogCategory {
  return SOURCE_CATEGORY_MAP[source] || 'system';
}

function formatArg(arg: unknown): string {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
  if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack?.split('\n').slice(0, 3).join('\n') || ''}`;
  try {
    const str = JSON.stringify(arg, null, 0);
    if (!str) return String(arg);
    if (str.length <= 500) return str;
    return str.substring(0, 500) + '…';
  } catch {
    return String(arg);
  }
}

// Messages known to be harmless but noisy (e.g. react-navigation warnings during
// initial redirect) — filtered out so they don't pollute the buffer or the backend.
const IGNORED_LOG_PATTERNS = [
  /Can't perform a React state update on a component that hasn't mounted yet/,
];

function isIgnorableLog(message: string): boolean {
  return IGNORED_LOG_PATTERNS.some(pattern => pattern.test(message));
}

function addLogEntry(level: LogLevel, args: unknown[]): void {
  const message = args.map(formatArg).join(' ');
  if (isIgnorableLog(message)) return;
  const source = detectSource(message);
  const now = new Date();
  const entry: LogEntry = {
    id: ++logId,
    timestamp: now.toLocaleTimeString('es-VE', { hour12: false }),
    iso: now.toISOString(),
    level,
    message,
    source,
    category: detectCategory(source),
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }

  // Add to remote queue
  queueForRemote(entry);

  // Throttled notification
  pendingEntries.push(entry);
  scheduleFlush();
}

// --- Override console ---
console.log = function (...args: unknown[]) {
  originalConsole.log(...args);
  addLogEntry('log', args);
};

console.warn = function (...args: unknown[]) {
  originalConsole.warn(...args);
  addLogEntry('warn', args);
};

console.error = function (...args: unknown[]) {
  const message = args.map(formatArg).join(' ');
  if (!isIgnorableLog(message)) {
    originalConsole.error(...args);
  }
  addLogEntry('error', args);
};

// --- Remote log delivery ---
// DISABLED: app logs should not travel to the backend. Kept as a no-op so all
// callers and exported API keep working without changes.

const REMOTE_LOGGING_ENABLED = false;
const REMOTE_FLUSH_INTERVAL = 10000; // flush every 10s (was 2s — reduced for battery)
const BATCH_MAX_SIZE = 50;

const remoteQueue: LogEntry[] = [];
let remoteTimer: ReturnType<typeof setInterval> | null = null;
let apiUrl = '';

// Set the API base URL so HTTP fallback works
export function setLogApiUrl(url: string): void {
  apiUrl = url.replace(/\/+$/, '');
}

function queueForRemote(entry: LogEntry): void {
  if (REMOTE_LOGGING_ENABLED) {
    remoteQueue.push(entry);
  }
}

async function flushRemoteBatch(): Promise<void> {
  if (!REMOTE_LOGGING_ENABLED || remoteQueue.length === 0) return;

  const batch = remoteQueue.splice(0, BATCH_MAX_SIZE);

  // Try Socket.IO first (real-time)
  try {
    const { getSocket } = require('./socket');
    const sock = getSocket();
    if (sock && sock.connected) {
      sock.emit('client:log', {
        entries: batch.map(e => ({
          level: e.level === 'log' ? 'info' : e.level,
          message: `[${e.source}] ${e.message}`,
          timestamp: e.iso,
          source: e.source,
          category: e.category,
        })),
      });
      return;
    }
  } catch {
    // socket module not available, fall through to HTTP
  }

  // Fallback to HTTP POST
  if (!apiUrl) return;
  try {
    await fetch(`${apiUrl}/api/logs/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: batch.map(e => ({
          level: e.level === 'log' ? 'info' : e.level,
          message: `[${e.source}] ${e.message}`,
          timestamp: e.iso,
          source: e.source,
          category: e.category,
        })),
      }),
    });
  } catch {
    // Silently fail — logs will be re-sent on next cycle
    remoteQueue.unshift(...batch);
  }
}

export function startRemoteLogging(): void {
  if (remoteTimer) return;
  remoteTimer = setInterval(flushRemoteBatch, REMOTE_FLUSH_INTERVAL);
}

export function stopRemoteLogging(): void {
  if (remoteTimer) {
    clearInterval(remoteTimer);
    remoteTimer = null;
  }
}

// --- Public API ---

export function getAllLogs(): LogEntry[] {
  return [...logBuffer];
}

export function getLogsByLevel(level: LogLevel): LogEntry[] {
  return logBuffer.filter(e => e.level === level);
}

export function getLogsBySource(source: string): LogEntry[] {
  return logBuffer.filter(e => e.source === source.toUpperCase());
}

export function getLogsByCategory(category: LogCategory): LogEntry[] {
  return logBuffer.filter(e => e.category === category);
}

export function subscribeToLogs(callback: Subscriber): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function clearLogs(): void {
  logBuffer.length = 0;
  pendingEntries.length = 0;
  remoteQueue.length = 0;
  if (throttleTimer !== null) {
    clearTimeout(throttleTimer);
    throttleTimer = null;
  }
}

export function getLogCount(): number {
  return logBuffer.length;
}

export function getLogsAsText(filter?: { level?: LogLevel; source?: string }): string {
  let entries = logBuffer;
  if (filter?.level) {
    entries = entries.filter(e => e.level === filter.level);
  }
  if (filter?.source) {
    const sourceVal = filter.source;
    entries = entries.filter(e => e.source === sourceVal.toUpperCase());
  }
  return entries
    .map(e => {
      const prefix = e.level === 'error' ? '❌' : e.level === 'warn' ? '⚠️' : '  ';
      return `${prefix} [${e.timestamp}] [${e.source}] ${e.message}`;
    })
    .join('\n');
}

// Remote log delivery is DISABLED — do not auto-start it.
// Kept for API compatibility; calling startRemoteLogging() is a no-op.

export type { LogEntry, LogLevel, LogCategory };
export default { getAllLogs, subscribeToLogs, clearLogs, getLogCount, getLogsAsText };
