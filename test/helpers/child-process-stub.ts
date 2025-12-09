/**
 * Stub for child_process module for testing command.ts
 */
import { EventEmitter } from 'events';

// Configuration for mock spawn behavior
export interface MockSpawnConfig {
  exitCode: number;
  stdoutData?: string[];
  stderrData?: string[];
  delayMs?: number;
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

/**
 * Mock spawn function that creates an EventEmitter-based process
 */
export function spawn(cmd: string, args: string[], options?: any): any {
  spawnCalls.push({ cmd, args, options });

  const proc = new EventEmitter();
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();

  (proc as any).stdout = stdout;
  (proc as any).stderr = stderr;
  (proc as any).kill = () => {
    proc.emit('close', 1);
  };

  // Emit data and close after a short delay
  setTimeout(() => {
    // Emit stdout data
    for (const data of (mockSpawnConfig.stdoutData || [])) {
      stdout.emit('data', Buffer.from(data));
    }

    // Emit stderr data
    for (const data of (mockSpawnConfig.stderrData || [])) {
      stderr.emit('data', Buffer.from(data));
    }

    // Emit close event
    proc.emit('close', mockSpawnConfig.exitCode);
  }, mockSpawnConfig.delayMs || 10);

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
