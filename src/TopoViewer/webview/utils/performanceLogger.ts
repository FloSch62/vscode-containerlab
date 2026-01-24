/**
 * Performance logging utility for development
 * Tracks component renders, prop changes, and operation timings
 *
 * Usage:
 *   import { useRenderCount, useWhyDidYouRender, timeOperation } from './performanceLogger';
 *
 *   // In component:
 *   useRenderCount('MyComponent');
 *   useWhyDidYouRender('MyComponent', props);
 *
 *   // For expensive operations:
 *   const result = timeOperation('computeLayout', () => expensiveCalculation());
 *
 *   // In browser console:
 *   __PERF__.getRenderStats()
 *   __PERF__.clearLogs()
 */
import { useRef, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

interface RenderLog {
  componentName: string;
  timestamp: number;
  changedProps?: string[];
  reason?: string;
}

interface TimingLog {
  operation: string;
  duration: number;
  timestamp: number;
}

interface PerfState {
  renderLogs: RenderLog[];
  timingLogs: TimingLog[];
  renderCounts: Map<string, number>;
  enabled: boolean;
  maxLogs: number;
}

// ============================================================================
// Global State
// ============================================================================

declare global {
  interface Window {
    __PERF__?: {
      state: PerfState;
      getRenderStats: (componentName?: string) => RenderStats;
      getTimingStats: () => TimingStats;
      clearLogs: () => void;
      toggle: (enabled?: boolean) => void;
      exportLogs: () => string;
    };
  }
}

interface RenderStats {
  totalRenders: number;
  byComponent: Record<string, number>;
  recentLogs: RenderLog[];
}

interface TimingStats {
  totalOperations: number;
  byOperation: Record<string, { count: number; totalMs: number; avgMs: number; maxMs: number }>;
  slowOperations: TimingLog[];
}

function initPerfState(): PerfState {
  if (typeof window === 'undefined') {
    return {
      renderLogs: [],
      timingLogs: [],
      renderCounts: new Map(),
      enabled: true,
      maxLogs: 5000
    };
  }

  if (!window.__PERF__) {
    const state: PerfState = {
      renderLogs: [],
      timingLogs: [],
      renderCounts: new Map(),
      enabled: true,
      maxLogs: 5000
    };

    window.__PERF__ = {
      state,
      getRenderStats: (componentName?: string) => getRenderStats(state, componentName),
      getTimingStats: () => getTimingStats(state),
      clearLogs: () => clearLogs(state),
      toggle: (enabled?: boolean) => toggleLogging(state, enabled),
      exportLogs: () => exportLogs(state)
    };

    console.log(
      '%c[Perf Logger] Initialized. Use __PERF__.getRenderStats() to view stats.',
      'color: #9C27B0; font-weight: bold;'
    );
  }

  return window.__PERF__.state;
}

// ============================================================================
// Core Logging Functions
// ============================================================================

/**
 * Log a component render
 */
export function logRender(
  componentName: string,
  changedProps?: string[],
  reason?: string
): void {
  const state = initPerfState();
  if (!state.enabled) return;

  // Update render count
  const count = (state.renderCounts.get(componentName) || 0) + 1;
  state.renderCounts.set(componentName, count);

  // Add log entry
  const log: RenderLog = {
    componentName,
    timestamp: globalThis.performance.now(),
    changedProps,
    reason
  };

  state.renderLogs.push(log);
  if (state.renderLogs.length > state.maxLogs) {
    state.renderLogs.shift();
  }

  // Console output with color
  const propsStr = changedProps?.length ? ` [${changedProps.join(', ')}]` : '';
  const reasonStr = reason ? ` (${reason})` : '';
  console.log(
    `%c[Render #${count}] ${componentName}${propsStr}${reasonStr}`,
    'color: #FF9800;'
  );
}

/**
 * Time an operation and log if it exceeds threshold
 */
/**
 * Get color for timing log based on duration
 */
function getTimingColor(durationMs: number): string {
  if (durationMs > 16) return '#f44336'; // Red: exceeds frame budget
  if (durationMs > 5) return '#FF9800';  // Orange: slow
  return '#4CAF50';                       // Green: fast
}

export function timeOperation<T>(operation: string, fn: () => T, thresholdMs = 1): T {
  const state = initPerfState();
  const start = globalThis.performance.now();
  const result = fn();
  const duration = globalThis.performance.now() - start;

  if (state.enabled && duration >= thresholdMs) {
    state.timingLogs.push({
      operation,
      duration,
      timestamp: start
    });

    if (state.timingLogs.length > state.maxLogs) {
      state.timingLogs.shift();
    }

    // Color based on duration
    const color = getTimingColor(duration);
    console.log(
      `%c[Timing] ${operation}: ${duration.toFixed(2)}ms`,
      `color: ${color};`
    );
  }

  return result;
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook to track and log render count for a component
 */
export function useRenderCount(componentName: string): number {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  useEffect(() => {
    logRender(componentName, undefined, `render #${renderCountRef.current}`);
  });

  return renderCountRef.current;
}

/**
 * Hook to log which props changed between renders
 */
export function useWhyDidYouRender<T extends Record<string, unknown>>(
  componentName: string,
  props: T
): void {
  const prevPropsRef = useRef<T | null>(null);

  useEffect(() => {
    if (prevPropsRef.current !== null) {
      const changedProps: string[] = [];
      const allKeys = new Set([
        ...Object.keys(prevPropsRef.current),
        ...Object.keys(props)
      ]);

      for (const key of allKeys) {
        if (prevPropsRef.current[key] !== props[key]) {
          changedProps.push(key);
        }
      }

      if (changedProps.length > 0) {
        logRender(componentName, changedProps, 'props changed');
      } else {
        logRender(componentName, undefined, 'parent re-render (no prop changes)');
      }
    } else {
      logRender(componentName, undefined, 'initial mount');
    }

    prevPropsRef.current = { ...props };
  });
}

// ============================================================================
// Stats Functions
// ============================================================================

function getRenderStats(state: PerfState, componentName?: string): RenderStats {
  const byComponent: Record<string, number> = {};
  state.renderCounts.forEach((count, name) => {
    if (!componentName || name === componentName) {
      byComponent[name] = count;
    }
  });

  const recentLogs = componentName
    ? state.renderLogs.filter(l => l.componentName === componentName).slice(-50)
    : state.renderLogs.slice(-50);

  return {
    totalRenders: componentName
      ? (state.renderCounts.get(componentName) || 0)
      : Array.from(state.renderCounts.values()).reduce((a, b) => a + b, 0),
    byComponent,
    recentLogs
  };
}

function getTimingStats(state: PerfState): TimingStats {
  const byOperation: Record<string, { count: number; totalMs: number; avgMs: number; maxMs: number }> = {};

  for (const log of state.timingLogs) {
    if (!byOperation[log.operation]) {
      byOperation[log.operation] = { count: 0, totalMs: 0, avgMs: 0, maxMs: 0 };
    }
    const stats = byOperation[log.operation];
    stats.count += 1;
    stats.totalMs += log.duration;
    stats.maxMs = Math.max(stats.maxMs, log.duration);
    stats.avgMs = stats.totalMs / stats.count;
  }

  // Round averages
  for (const op of Object.keys(byOperation)) {
    byOperation[op].avgMs = Math.round(byOperation[op].avgMs * 100) / 100;
    byOperation[op].totalMs = Math.round(byOperation[op].totalMs * 100) / 100;
    byOperation[op].maxMs = Math.round(byOperation[op].maxMs * 100) / 100;
  }

  // Find slow operations (>16ms frame budget)
  const slowOperations = state.timingLogs
    .filter(l => l.duration > 16)
    .slice(-20);

  return {
    totalOperations: state.timingLogs.length,
    byOperation,
    slowOperations
  };
}

function clearLogs(state: PerfState): void {
  state.renderLogs = [];
  state.timingLogs = [];
  state.renderCounts.clear();
  console.log('%c[Perf Logger] Logs cleared', 'color: #9C27B0;');
}

function toggleLogging(state: PerfState, enabled?: boolean): void {
  state.enabled = enabled ?? !state.enabled;
  console.log(
    `%c[Perf Logger] ${state.enabled ? 'Enabled' : 'Disabled'}`,
    'color: #9C27B0; font-weight: bold;'
  );
}

function exportLogs(state: PerfState): string {
  const data = {
    renderStats: getRenderStats(state),
    timingStats: getTimingStats(state),
    exportedAt: new Date().toISOString()
  };
  const json = JSON.stringify(data, null, 2);
  console.log(json);
  return json;
}

// Initialize on import in dev mode
if (typeof window !== 'undefined') {
  initPerfState();
}
