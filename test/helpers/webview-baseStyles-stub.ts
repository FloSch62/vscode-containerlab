/**
 * Stub for webview BaseStyles loader.
 * Captures calls for assertions without touching Cytoscape.
 */

export const loadCytoStyleCalls: unknown[][] = [];

export default async function loadCytoStyle(...args: unknown[]): Promise<void> {
  loadCytoStyleCalls.push(args);
}

export function resetBaseStylesStub(): void {
  loadCytoStyleCalls.length = 0;
}
