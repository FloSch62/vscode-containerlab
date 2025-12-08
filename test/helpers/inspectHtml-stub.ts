/**
 * Stub for inspectHtml module.
 * Returns minimal HTML for webview testing.
 */

let lastWebview: any = undefined;
let lastContainers: any[] = [];
let lastExtensionUri: any = undefined;

export function getInspectHtml(
  webview: any,
  containers: any[],
  extensionUri: any
): string {
  lastWebview = webview;
  lastContainers = containers;
  lastExtensionUri = extensionUri;

  const count = containers.length;
  return `<!DOCTYPE html>
<html>
  <head><title>Containerlab Inspect</title></head>
  <body>
    <h1>Inspect</h1>
    <p>Container count: ${count}</p>
  </body>
</html>`;
}

// Test helpers to inspect what was passed
export function getLastWebview(): any {
  return lastWebview;
}

export function getLastContainers(): any[] {
  return lastContainers;
}

export function getLastExtensionUri(): any {
  return lastExtensionUri;
}

export function resetInspectHtmlStub(): void {
  lastWebview = undefined;
  lastContainers = [];
  lastExtensionUri = undefined;
}
