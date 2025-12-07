export async function notifyCurrentTopoViewerOfCommandSuccess(
  _commandType: 'deploy' | 'destroy' | 'redeploy'
) {
  if (_commandType) {
    // no-op stub
  }
  // no-op stub
}

export async function notifyCurrentTopoViewerOfCommandFailure(
  _commandType: 'deploy' | 'destroy' | 'redeploy',
  _error?: Error
) {
  // no-op stub - reference params to satisfy linter
  if (_commandType && _error) {
    // no-op
  }
}

// Stub for getCurrentTopoViewer - returns undefined by default (no viewer open)
let currentTopoViewer: any = undefined;

export function getCurrentTopoViewer(): any {
  return currentTopoViewer;
}

export function setCurrentTopoViewer(viewer: any): void {
  currentTopoViewer = viewer;
}

export function resetGraphStub(): void {
  currentTopoViewer = undefined;
}
