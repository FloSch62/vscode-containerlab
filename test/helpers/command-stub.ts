/**
 * Command stub for testing terminal command execution.
 *
 * Tracks all calls to execCommandInTerminal for assertion in tests.
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
