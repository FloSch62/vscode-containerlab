/**
 * Command stub for testing terminal command execution.
 *
 * Tracks all calls to execCommandInTerminal and execCommandInOutput for assertion in tests.
 */

export interface TerminalCommand {
  command: string;
  terminalName: string;
  reuseOnly?: boolean;
}

export const calls: TerminalCommand[] = [];

export function execCommandInTerminal(command: string, terminalName: string, reuseOnly = false): void {
  calls.push({ command, terminalName, reuseOnly });
}

export function clearTerminalCommands(): void {
  calls.length = 0;
}

// execCommandInOutput stub
export let lastCommand: string | undefined = undefined;
let lastSuccessCallback: Function | undefined = undefined;
let lastFailureCallback: Function | undefined = undefined;

export function execCommandInOutput(
  cmd: string,
  _showOutput: boolean = false,
  successCallback?: Function,
  failureCallback?: Function
): void {
  lastCommand = cmd;
  lastSuccessCallback = successCallback;
  lastFailureCallback = failureCallback;
  // By default, simulate success
  if (successCallback) {
    successCallback();
  }
}

export function simulateSuccess(): void {
  if (lastSuccessCallback) {
    lastSuccessCallback();
  }
}

export function simulateFailure(stderr: string = 'Command failed'): void {
  if (lastFailureCallback) {
    lastFailureCallback(null, stderr);
  }
}

export function resetCommandStub(): void {
  lastCommand = undefined;
  lastSuccessCallback = undefined;
  lastFailureCallback = undefined;
  calls.length = 0;
}
