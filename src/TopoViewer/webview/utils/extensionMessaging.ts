/**
 * Helper utilities for sending messages from the React webview to the VS Code extension.
 */
import { log } from './logger';
import type { SaveCustomNodeData } from '../../shared/utilities/customNodeConversions';

// Re-export SaveCustomNodeData for consumers that import from this file
export type { SaveCustomNodeData };

declare global {
  interface Window {
    vscode?: { postMessage(data: unknown): void };
  }
}

/**
 * Get VS Code API instance exposed by the extension host.
 */
function getVscodeApi(): { postMessage(data: unknown): void } | undefined {
  return typeof window !== 'undefined' ? window.vscode : undefined;
}

/**
 * Send a fire-and-forget command message to the extension.
 */
export function sendCommandToExtension(command: string, payload?: Record<string, unknown>): void {
  const vscodeApi = getVscodeApi();
  if (!vscodeApi) {
    log.warn(`[ExtensionMessaging] VS Code API unavailable, command skipped: ${command}`);
    return;
  }

  const message = payload ? { command, ...payload } : { command };
  vscodeApi.postMessage(message);
  log.debug(`[ExtensionMessaging] Sent command: ${command}`);
}

/**
 * Send delete custom node command to the extension.
 */
export function sendDeleteCustomNode(nodeName: string): void {
  sendCommandToExtension('delete-custom-node', { name: nodeName });
}

/**
 * Send set default custom node command to the extension.
 */
export function sendSetDefaultCustomNode(nodeName: string): void {
  sendCommandToExtension('set-default-custom-node', { name: nodeName });
}

/**
 * Save custom node template data to the extension.
 * Uses SaveCustomNodeData from shared/utilities/customNodeConversions.ts
 */
export function sendSaveCustomNode(data: SaveCustomNodeData): void {
  sendCommandToExtension('save-custom-node', data);
}
