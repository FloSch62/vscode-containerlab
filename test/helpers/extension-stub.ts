import { globalState, clearGlobalState } from './globalState-stub';

export const execCmdMapping = { nokia_srlinux: 'sr_cli' };

// SSH user mapping (default mapping for node kinds)
export const sshUserMapping: Record<string, string> = {
  nokia_srlinux: 'admin',
  nokia_sros: 'admin',
  arista_ceos: 'admin',
  cisco_xrd: 'admin'
};

// Docker client stub (can be set to a mock dockerode instance)
export let dockerClient: any = undefined;

// Mutable state for tests
export let hideNonOwnedLabsState = false;
export let runningTreeView: any = undefined;
export let username = 'testuser';
export const favoriteLabs = new Set<string>();
export const sshxSessions = new Map<string, string>();
export const gottySessions = new Map<string, string>();

// Output channel stub
export const outputChannel = {
  appendLine: () => {},
  show: () => {},
  info: () => {},
  debug: () => {},
  warn: () => {},
  error: () => {},
  trace: () => {},
};

// Container binary path stub
export const containerlabBinaryPath = 'containerlab';

// Running labs provider stub
export const runningLabsProvider = {
  refreshCalled: false,
  softRefreshCalled: false,
  refresh(): void {
    this.refreshCalled = true;
  },
  softRefresh(): void {
    this.softRefreshCalled = true;
  },
  async discoverInspectLabs(): Promise<any> {
    return null;
  },
  reset(): void {
    this.refreshCalled = false;
    this.softRefreshCalled = false;
  }
};

// Async refresh stubs
export async function refreshSshxSessions(): Promise<void> {
  // no-op in tests
}

export async function refreshGottySessions(): Promise<void> {
  // no-op in tests
}

// Extension context with global state for persistence testing
export const extensionContext = {
  globalState,
  subscriptions: [] as { dispose: () => void }[],
  extensionPath: '/mock/extension',
  asAbsolutePath: (p: string) => `/mock/extension/${p}`
};

// Test helpers
export function setDockerClient(client: any): void {
  dockerClient = client;
}

export function setHideNonOwnedLabsState(value: boolean): void {
  hideNonOwnedLabsState = value;
}

export function setRunningTreeView(view: any): void {
  runningTreeView = view;
}

export function setUsername(name: string): void {
  username = name;
}

export function resetExtensionStub(): void {
  dockerClient = undefined;
  hideNonOwnedLabsState = false;
  runningTreeView = undefined;
  username = 'testuser';
  // eslint-disable-next-line sonarjs/no-empty-collection
  favoriteLabs.clear();
  // eslint-disable-next-line sonarjs/no-empty-collection
  sshxSessions.clear();
  // eslint-disable-next-line sonarjs/no-empty-collection
  gottySessions.clear();
  // Clear global state
  clearGlobalState();
  // Reset subscriptions
  extensionContext.subscriptions.length = 0;
  // Reset running labs provider
  runningLabsProvider.reset();
}
