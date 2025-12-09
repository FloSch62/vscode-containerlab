/**
 * Stub for child_process module for testing command.ts
 */
import { EventEmitter } from 'events';
import { Readable } from 'stream';

// Configuration for mock spawn behavior
export interface MockSpawnConfig {
  exitCode: number;
  stdoutData?: string[];
  stderrData?: string[];
  delayMs?: number;
  emitError?: Error;
  noStdout?: boolean;
}

let mockSpawnConfig: MockSpawnConfig = {
  exitCode: 0,
  stdoutData: [],
  stderrData: [],
  delayMs: 0
};

export function setMockSpawnConfig(config: MockSpawnConfig): void {
  mockSpawnConfig = { ...config };
}

export function resetMockSpawnConfig(): void {
  mockSpawnConfig = {
    exitCode: 0,
    stdoutData: [],
    stderrData: [],
    delayMs: 0
  };
}

// Track spawn calls for assertions
export const spawnCalls: Array<{ cmd: string; args: string[]; options: any }> = [];

export function clearSpawnCalls(): void {
  spawnCalls.length = 0;
}

// Helper to emit spawn data after delay
function emitSpawnData(
  proc: EventEmitter,
  stdout: Readable | null,
  stderr: Readable
): void {
  // Emit error if configured
  if (mockSpawnConfig.emitError) {
    proc.emit('error', mockSpawnConfig.emitError);
    return;
  }

  // Push stdout data as lines (for readline compatibility)
  if (stdout) {
    for (const data of (mockSpawnConfig.stdoutData || [])) {
      stdout.push(data + '\n');
    }
    stdout.push(null);
  }

  // Push stderr data
  for (const data of (mockSpawnConfig.stderrData || [])) {
    stderr.push(Buffer.from(data));
  }
  stderr.push(null);

  // Emit exit/close events
  proc.emit('exit', mockSpawnConfig.exitCode, null);
  proc.emit('close', mockSpawnConfig.exitCode);
}

/**
 * Mock spawn function that creates an EventEmitter-based process
 * with proper Readable streams for stdout/stderr (supports readline)
 */
export function spawn(cmd: string, args: string[], options?: any): any {
  spawnCalls.push({ cmd, args, options });

  const proc = new EventEmitter();
  const stdout = mockSpawnConfig.noStdout ? null : new Readable({ read() {} });
  const stderr = new Readable({ read() {} });

  (proc as any).stdout = stdout;
  (proc as any).stderr = stderr;
  (proc as any).pid = 12345;
  (proc as any).kill = () => {
    proc.emit('close', 1);
    if (stdout) stdout.push(null);
    stderr.push(null);
  };

  setTimeout(() => emitSpawnData(proc, stdout, stderr), mockSpawnConfig.delayMs || 10);

  return proc;
}

// execSync mock configuration
let execSyncResult: string = '/usr/bin/containerlab\n';
let execSyncError: Error | null = null;

export function setExecSyncResult(result: string): void {
  execSyncResult = result;
  execSyncError = null;
}

export function setExecSyncError(error: Error): void {
  execSyncError = error;
}

export function resetExecSync(): void {
  execSyncResult = '/usr/bin/containerlab\n';
  execSyncError = null;
}

export const execSyncCalls: string[] = [];

export function execSync(command: string, _options?: any): string {
  execSyncCalls.push(command);
  if (execSyncError) {
    throw execSyncError;
  }
  return execSyncResult;
}

export function clearExecSyncCalls(): void {
  execSyncCalls.length = 0;
}

// exec mock configuration for async operations
let execResult: { stdout: string; stderr: string } = { stdout: '', stderr: '' };
let execError: Error | null = null;

export function setExecResult(result: { stdout: string; stderr: string }): void {
  execResult = result;
  execError = null;
}

export function setExecError(error: Error): void {
  execError = error;
}

export function resetExec(): void {
  execResult = { stdout: '', stderr: '' };
  execError = null;
}

export const execCalls: string[] = [];

export function exec(
  command: string,
  callback?: (error: Error | null, stdout: string, stderr: string) => void
): any {
  execCalls.push(command);

  if (callback) {
    // Callback style
    if (execError) {
      callback(execError, '', '');
    } else {
      callback(null, execResult.stdout, execResult.stderr);
    }
  }

  // Return a fake ChildProcess for promisify compatibility
  return {
    stdout: null,
    stderr: null,
    kill: () => {}
  };
}

export function clearExecCalls(): void {
  execCalls.length = 0;
}
