export const calls: string[] = [];
let defaultOutput = '';
const commandResponses: Map<RegExp, string | (() => string)> = new Map();
const commandErrors: Map<RegExp, Error> = new Map();

// Existing API (preserved)
export function setOutput(out: string) {
  defaultOutput = out;
}

// New API for command-specific responses
export function mockCommand(pattern: RegExp, response: string | (() => string)) {
  commandResponses.set(pattern, response);
}

export function mockCommandError(pattern: RegExp, error: Error) {
  commandErrors.set(pattern, error);
}

export function clearMocks() {
  commandResponses.clear();
  commandErrors.clear();
  calls.length = 0;
  defaultOutput = '';
}

// Match real signature: runCommand(command, description, outputChannel, returnOutput, includeStderr)
export async function runCommand(
  command: string,
  _description?: string,
  _outputChannel?: any,
  returnOutput: boolean = false,
  _includeStderr: boolean = false
): Promise<string | void> {
  // Prefix unused params with _ to satisfy linter
  calls.push(command);

  // Check for error mocks first
  for (const [pattern, error] of commandErrors) {
    if (pattern.test(command)) {
      throw error;
    }
  }

  // Check for response mocks
  for (const [pattern, response] of commandResponses) {
    if (pattern.test(command)) {
      const result = typeof response === 'function' ? response() : response;
      return returnOutput ? result : undefined;
    }
  }

  return returnOutput ? defaultOutput : undefined;
}

export function getUserInfo(): {
  hasPermission: boolean;
  isRoot: boolean;
  userGroups: string[];
  username: string;
  uid: number;
} {
  // In tests, always return that permissions are granted
  return {
    hasPermission: true,
    isRoot: false,
    userGroups: ['clab_admins', 'docker'],
    username: 'testuser',
    uid: 1000
  };
}

export async function getSelectedLabNode(node?: any): Promise<any> {
  // In tests, always return the node that was passed in
  return node;
}

// Path normalization helpers for runningLabsProvider tests
export function normalizeLabPath(labPath: string, _singleFolderBase?: string): string {
  // Simple normalization - just return the path as-is for testing
  // In production this resolves relative paths
  return labPath;
}

export function getRelativeFolderPath(targetPath: string): string {
  // Return the directory portion of the path
  const parts = targetPath.split('/');
  parts.pop(); // Remove filename
  return parts.join('/') || '/';
}

export function getRelLabFolderPath(labPath: string): string {
  // Return the last directory component
  const parts = labPath.split('/');
  parts.pop(); // Remove filename
  return parts[parts.length - 1] || '';
}

export function stripAnsi(input: string): string {
  // Remove ANSI escape sequences
  // eslint-disable-next-line no-control-regex, sonarjs/no-control-regex
  return input.replace(/\x1B[[(?);]{0,2}(;?\d)*./g, '');
}

export function stripFileName(p: string): string {
  // Return directory portion of path
  const parts = p.split('/');
  parts.pop();
  return parts.join('/') || '/';
}

export function titleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Configurable isOrbstack for testing
let isOrbstackValue = false;

export function isOrbstack(): boolean {
  return isOrbstackValue;
}

export function setIsOrbstack(value: boolean): void {
  isOrbstackValue = value;
}

export function resetIsOrbstack(): void {
  isOrbstackValue = false;
}

export function getConfig(_relCfgPath: string): any {
  return {};
}

export function installContainerlab(): void {
  // no-op in tests
}

export function sanitize(input: string): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// Container action enum matching the real implementation
// Using regular enum (not const enum) so it's available at runtime
export enum ContainerAction {
  Start = 'start',
  Stop = 'stop',
  Pause = 'pause',
  Unpause = 'unpause',
}

// Track container action calls for testing
export const containerActionCalls: { containerId: string; action: ContainerAction }[] = [];

// Mock implementation of runContainerAction
export async function runContainerAction(containerId: string, action: ContainerAction): Promise<void> {
  containerActionCalls.push({ containerId, action });
}

// Reset container action calls
export function clearContainerActionCalls(): void {
  containerActionCalls.length = 0;
}

// Capture.ts related utilities
let freePortValue = 12345;
let httpEndpointReady = true;
let checkAndPullResult = true;
export const checkAndPullCalls: { image: string; policy: string }[] = [];

export function setFreePort(port: number): void {
  freePortValue = port;
}

export function setHttpEndpointReady(ready: boolean): void {
  httpEndpointReady = ready;
}

export function setCheckAndPullResult(result: boolean): void {
  checkAndPullResult = result;
}

export async function getFreePort(): Promise<number> {
  return freePortValue;
}

export async function isHttpEndpointReady(_url: string): Promise<boolean> {
  return httpEndpointReady;
}

export async function delay(_ms: number): Promise<void> {
  // No actual delay in tests
}

export async function tryPostMessage(panel: any, message: any): Promise<boolean> {
  if (panel?.webview?.postMessage) {
    return panel.webview.postMessage(message);
  }
  return false;
}

export async function checkAndPullDockerImage(image: string, policy: string): Promise<boolean> {
  checkAndPullCalls.push({ image, policy });
  return checkAndPullResult;
}

export function clearCaptureUtilsMocks(): void {
  freePortValue = 12345;
  httpEndpointReady = true;
  checkAndPullResult = true;
  checkAndPullCalls.length = 0;
}

// Docker images related stubs
type DockerImageCallback = (images: string[]) => void;
let dockerImageCallbacks: DockerImageCallback[] = [];
let dockerImages: string[] = [];

export function onDockerImagesUpdated(callback: DockerImageCallback): { dispose: () => void } {
  dockerImageCallbacks.push(callback);
  return {
    dispose: () => {
      const index = dockerImageCallbacks.indexOf(callback);
      if (index >= 0) {
        dockerImageCallbacks.splice(index, 1);
      }
    }
  };
}

export function getDockerImages(): string[] {
  return dockerImages;
}

export async function refreshDockerImages(): Promise<void> {
  // no-op
}

// Test helper to trigger docker image updates
export function triggerDockerImagesUpdate(images: string[]): void {
  dockerImages = images;
  for (const cb of dockerImageCallbacks) {
    cb(images);
  }
}

// Reset docker images callbacks
export function clearDockerImagesMocks(): void {
  dockerImageCallbacks = [];
  dockerImages = [];
}
