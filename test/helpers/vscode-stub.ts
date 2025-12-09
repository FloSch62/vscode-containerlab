export const ProgressLocation = {
  Notification: 1,
  SourceControl: 2,
  Window: 3,
};

export const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3,
} as const;

export const ColorThemeKind = {
  Light: 1,
  Dark: 2,
  HighContrast: 3,
  HighContrastLight: 4,
} as const;

// Terminal stub for tracking created terminals
export interface MockTerminal {
  name: string;
  commands: string[];
  shown: boolean;
  disposed: boolean;
  show: () => void;
  sendText: (text: string) => void;
  dispose: () => void;
}

const createdTerminals: MockTerminal[] = [];
const visibleEditors: Array<{ document: { uri: { fsPath: string } } }> = [];

// Webview panel stub
export class MockWebviewPanel {
  viewType: string;
  title: string;
  iconPath: any;
  options: { enableScripts?: boolean } = {};
  webview: {
    html: string;
    onDidReceiveMessage: (callback: (message: any) => void) => { dispose: () => void };
    postMessage: (message: any) => Promise<boolean>;
    asWebviewUri: (uri: any) => any;
    _messageHandler?: (message: any) => void;
    _postedMessages: any[];
  };
  private disposeCallbacks: (() => void)[] = [];
  private messageCallbacks: ((message: any) => void)[] = [];

  constructor(viewType: string, title: string, options?: { enableScripts?: boolean }) {
    this.viewType = viewType;
    this.title = title;
    this.iconPath = undefined;
    this.options = options || {};
    const self = this;
    this.webview = {
      html: '',
      _postedMessages: [],
      onDidReceiveMessage: (callback: (message: any) => void) => {
        self.messageCallbacks.push(callback);
        // Expose the last handler for easy testing
        self.webview._messageHandler = callback;
        return {
          dispose: () => {
            const idx = self.messageCallbacks.indexOf(callback);
            if (idx >= 0) self.messageCallbacks.splice(idx, 1);
          }
        };
      },
      postMessage: async (message: any) => {
        self.webview._postedMessages.push(message);
        return true;
      },
      asWebviewUri: (uri: any) => uri
    };
  }

  onDidDispose(callback: () => void): { dispose: () => void } {
    this.disposeCallbacks.push(callback);
    return {
      dispose: () => {
        const idx = this.disposeCallbacks.indexOf(callback);
        if (idx >= 0) this.disposeCallbacks.splice(idx, 1);
      }
    };
  }

  reveal(_viewColumn?: any): void {
    // no-op for tests
  }

  dispose(): void {
    for (const cb of this.disposeCallbacks) {
      cb();
    }
  }

  // Helper for tests to simulate receiving a message
  simulateMessage(message: any): void {
    for (const cb of this.messageCallbacks) {
      cb(message);
    }
  }
}

export const window = {
  lastErrorMessage: '',
  lastInfoMessage: '',
  lastWarningMessage: '',
  lastWarningSelection: undefined as string | undefined,
  quickPickResult: undefined as string | undefined,
  inputBoxResult: undefined as string | undefined,
  openDialogResult: undefined as { fsPath: string }[] | undefined,
  terminals: createdTerminals as MockTerminal[],
  visibleTextEditors: visibleEditors,
  activeColorTheme: { kind: ColorThemeKind.Dark } as { kind: number },
  lastWebviewPanel: undefined as MockWebviewPanel | undefined,
  createOutputChannel(_name: string, options?: { log: boolean } | string) {
    const isLogChannel = typeof options === 'object' && options?.log;
    const logs: string[] = [];
    return {
      logs,
      appendLine(line: string) { logs.push(line); },
      show() {},
      // LogOutputChannel methods (when { log: true } is passed)
      ...(isLogChannel && {
        info(msg: string) { logs.push(`[info] ${msg}`); },
        debug(msg: string) { logs.push(`[debug] ${msg}`); },
        warn(msg: string) { logs.push(`[warn] ${msg}`); },
        error(msg: string) { logs.push(`[error] ${msg}`); },
        trace(msg: string) { logs.push(`[trace] ${msg}`); },
      }),
    };
  },
  createTreeView<T>(viewId: string, options: { treeDataProvider: any; canSelectMany?: boolean }) {
    const mockTreeView = {
      viewId,
      treeDataProvider: options.treeDataProvider,
      canSelectMany: options.canSelectMany || false,
      visible: true,
      selection: [] as T[],
      onDidChangeVisibility: {
        _callbacks: [] as Array<(e: { visible: boolean }) => void>,
        fire(e: { visible: boolean }) {
          for (const cb of this._callbacks) {
            cb(e);
          }
        }
      },
      dispose() {}
    };
    // Return an event function that accepts a callback
    const onDidChangeVisibilityFunc = (callback: (e: { visible: boolean }) => void) => {
      mockTreeView.onDidChangeVisibility._callbacks.push(callback);
      return { dispose: () => {} };
    };
    return {
      ...mockTreeView,
      onDidChangeVisibility: onDidChangeVisibilityFunc
    };
  },
  createTerminal(options: string | { name: string; shellPath?: string; shellArgs?: string[] }) {
    const terminalName = typeof options === 'string' ? options : options.name;
    const terminal: MockTerminal = {
      name: terminalName,
      commands: [],
      shown: false,
      disposed: false,
      show() {
        this.shown = true;
      },
      sendText(text: string) {
        this.commands.push(text);
      },
      dispose() {
        this.disposed = true;
        const idx = createdTerminals.indexOf(this);
        if (idx >= 0) {
          createdTerminals.splice(idx, 1);
        }
      }
    };
    createdTerminals.push(terminal);
    return terminal;
  },
  showErrorMessage(message: string) {
    this.lastErrorMessage = message;
  },
  showInformationMessage(message: string) {
    this.lastInfoMessage = message;
  },
  showWarningMessage(message: string, _options?: any, ..._items: string[]): Promise<string | undefined> {
    this.lastWarningMessage = message;
    return Promise.resolve(this.lastWarningSelection);
  },
  // Properties for controlling withProgress behavior in tests
  withProgressShouldCancel: false,
  withProgressCancelDelay: 0,
  lastProgressReports: [] as { message?: string }[],

  withProgress<T>(
    _options: { location: number; title: string; cancellable: boolean },
    task: (progress: { report: (value: { message?: string }) => void }, token: { isCancellationRequested: boolean; onCancellationRequested: (cb: () => void) => { dispose: () => void } }) => Promise<T>
  ): Promise<T> {
    // Create mock progress object
    const progress = {
      report: (value: { message?: string }) => {
        window.lastProgressReports.push(value);
      }
    };

    // Create mock cancellation token
    let cancelCallback: (() => void) | null = null;
    const token = {
      isCancellationRequested: false,
      onCancellationRequested: (cb: () => void) => {
        cancelCallback = cb;
        // If test configured to cancel, do it after delay
        if (window.withProgressShouldCancel) {
          setTimeout(() => {
            token.isCancellationRequested = true;
            if (cancelCallback) cancelCallback();
          }, window.withProgressCancelDelay);
        }
        return { dispose: () => { cancelCallback = null; } };
      }
    };

    // Execute the task with progress and token
    return task(progress, token);
  },
  showQuickPick(_items: string[], _options?: any): Promise<string | undefined> {
    return Promise.resolve(this.quickPickResult);
  },
  showInputBox(_options?: any): Promise<string | undefined> {
    return Promise.resolve(this.inputBoxResult);
  },
  showOpenDialog(_options?: any): Promise<{ fsPath: string }[] | undefined> {
    return Promise.resolve(this.openDialogResult);
  },
  createWebviewPanel(
    viewType: string,
    title: string,
    _showOptions: any,
    options?: { enableScripts?: boolean }
  ): MockWebviewPanel {
    const panel = new MockWebviewPanel(viewType, title, options);
    this.lastWebviewPanel = panel;
    return panel;
  },
  showTextDocument(document: any, _column?: any): Promise<any> {
    // Add to visibleEditors if document has a uri
    if (document && document.uri) {
      visibleEditors.push({ document: { uri: document.uri } });
    }
    return Promise.resolve({
      document,
      viewColumn: ViewColumn.One,
    });
  },
};

export const commands = {
  executed: [] as { command: string; args: any[] }[],
  registered: [] as { command: string; handler: Function }[],
  executeCommand(command: string, ...args: any[]) {
    this.executed.push({ command, args });
    return Promise.resolve();
  },
  registerCommand(command: string, handler: Function) {
    this.registered.push({ command, handler });
    return { dispose: () => {} };
  },
};

// Configuration values that can be set by tests
export const configValues: Record<string, any> = {};

export function setConfigValue(key: string, value: any): void {
  configValues[key] = value;
}

export function clearConfigValues(): void {
  Object.keys(configValues).forEach(key => delete configValues[key]);
}

export const workspace = {
  workspaceFolders: [] as { uri: { fsPath: string }; name?: string }[],
  getConfiguration(_section?: string) {
    const configObj = {
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        const fullKey = _section ? `${_section}.${key}` : key;
        if (fullKey in configValues) {
          return configValues[fullKey] as T;
        }
        // Return sensible defaults for common object-type configs
        if (key.includes('Mapping') || key.includes('mapping')) {
          return (defaultValue ?? {}) as T;
        }
        return defaultValue;
      },
      has: (key: string): boolean => {
        const fullKey = _section ? `${_section}.${key}` : key;
        return fullKey in configValues;
      },
      inspect: <T>(key: string): { globalValue?: T; workspaceValue?: T; defaultValue?: T } | undefined => {
        const fullKey = _section ? `${_section}.${key}` : key;
        if (fullKey in configValues) {
          return { globalValue: configValues[fullKey] as T };
        }
        return undefined;
      },
      update: async (key: string, value: any, _target?: number): Promise<void> => {
        const fullKey = _section ? `${_section}.${key}` : key;
        configValues[fullKey] = value;
      },
    };
    return configObj;
  },
  async openTextDocument(pathOrUri: string | { fsPath: string }): Promise<any> {
    const path = typeof pathOrUri === 'string' ? pathOrUri : pathOrUri.fsPath;
    return {
      uri: { fsPath: path },
      getText: () => '',
      fileName: path,
    };
  },
  updateWorkspaceFolders(
    index: number,
    deleteCount: number | null,
    ...folders: { uri: { fsPath: string }; name?: string }[]
  ) {
    const del = deleteCount ?? 0;
    this.workspaceFolders.splice(index, del, ...folders);
  },
  onDidSaveTextDocument(cb: any) {
    if (typeof cb === 'function') {
      // no-op
    }
    const disposable = { disposed: false, dispose() { this.disposed = true; } };
    return disposable;
  },
  onDidChangeTextDocument(cb: any) {
    if (typeof cb === 'function') {
      // no-op
    }
    const disposable = { disposed: false, dispose() { this.disposed = true; } };
    return disposable;
  },
  createFileSystemWatcher(_globPattern: string) {
    const watcher = {
      disposed: false,
      _onDidChangeCallbacks: [] as ((uri: any) => void)[],
      onDidChange(cb: (uri: any) => void) {
        watcher._onDidChangeCallbacks.push(cb);
        return { dispose() {} };
      },
      onDidCreate(_cb: (uri: any) => void) {
        return { dispose() {} };
      },
      onDidDelete(_cb: (uri: any) => void) {
        return { dispose() {} };
      },
      dispose() {
        watcher.disposed = true;
      },
      // Test helper to simulate file change
      simulateChange(uri: any) {
        for (const cb of watcher._onDidChangeCallbacks) {
          cb(uri);
        }
      }
    };
    return watcher;
  },
  onDidChangeConfiguration(cb: any) {
    if (typeof cb === 'function') {
      // no-op
    }
    const disposable = { disposed: false, dispose() { this.disposed = true; } };
    return disposable;
  },
  fs: {
    readFile: async () => new TextEncoder().encode('{}'),
  },
};

// Uri class for instanceof support
export class Uri {
  public fsPath: string;
  public path: string;

  private constructor(pathVal: string) {
    this.fsPath = pathVal;
    this.path = pathVal;
  }

  toString(): string {
    return this.fsPath;
  }

  with(change: { path?: string }): Uri {
    const newPath = change.path ?? this.fsPath;
    return Uri.file(newPath);
  }

  static file(p: string): Uri {
    return new Uri(p);
  }

  static joinPath(...parts: any[]): Uri {
    const pathVal = parts.map((p: any) => (typeof p === 'string' ? p : p.fsPath)).join('/');
    return new Uri(pathVal);
  }

  static parse(uri: string): Uri {
    return new Uri(uri);
  }
}

export class TreeItem {
  public iconPath: any;
  public label?: string;
  public collapsibleState?: number;
  constructor(label?: string, collapsibleState?: number) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
} as const;

export class ThemeColor {
  public id: string;
  constructor(id: string) {
    this.id = id;
  }
}

export class ThemeIcon {
  static readonly File = 'file';
  public id: string;
  public color?: ThemeColor;
  constructor(id: string, color?: ThemeColor) {
    this.id = id;
    this.color = color;
  }
}

export const ViewColumn = {
  One: 1,
};

export const env = {
  remoteName: undefined as string | undefined,
  lastOpenedUrl: undefined as any,
  clipboard: {
    lastText: '',
    writeText(text: string) {
      this.lastText = text;
      return Promise.resolve();
    },
  },
  openExternal(uri: any) {
    this.lastOpenedUrl = uri;
    return Promise.resolve(true);
  },
  asExternalUri(uri: any) {
    return Promise.resolve(uri);
  },
};

export const extensions = {
  getExtension(_extensionId: string) {
    if (_extensionId) {
      // no-op
    }
    return {
      packageJSON: {
        version: '0.0.0-test',
      },
    };
  },
};

// Captured completion providers for testing
export const capturedCompletionProviders: Array<{
  selector: any;
  provider: any;
  triggerCharacters: string[];
}> = [];

export const languages = {
  registerCompletionItemProvider(
    _selector: any,
    _provider: any,
    ..._triggerCharacters: string[]
  ): { dispose: () => void } {
    capturedCompletionProviders.push({
      selector: _selector,
      provider: _provider,
      triggerCharacters: _triggerCharacters
    });
    return { dispose: () => {} };
  },
};

export const CompletionItemKind = {
  Value: 12,
  Text: 0,
  Method: 1,
  Function: 2,
  Constructor: 3,
  Field: 4,
  Variable: 5,
  Class: 6,
  Interface: 7,
  Module: 8,
  Property: 9,
  Unit: 10,
  Keyword: 11,
};

export class CompletionItem {
  label: string;
  kind?: number;
  insertText?: string;
  detail?: string;
  sortText?: string;

  constructor(label: string, kind?: number) {
    this.label = label;
    this.kind = kind;
  }
}

export class CompletionList {
  items: CompletionItem[];
  isIncomplete: boolean;

  constructor(items: CompletionItem[], isIncomplete = false) {
    this.items = items;
    this.isIncomplete = isIncomplete;
  }
}

export class EventEmitter<T> {
  private listeners: Function[] = [];

  get event(): Function {
    return (callback: Function) => {
      this.listeners.push(callback);
      return {
        dispose: () => {
          const idx = this.listeners.indexOf(callback);
          if (idx >= 0) {
            this.listeners.splice(idx, 1);
          }
        },
      };
    };
  }

  fire(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  dispose(): void {
    this.listeners = [];
  }
}

// Reset functions for test cleanup
export function clearTerminals(): void {
  createdTerminals.length = 0;
}

export function clearVisibleEditors(): void {
  visibleEditors.length = 0;
}

export function addVisibleEditor(filePath: string, _viewColumn?: number): void {
  visibleEditors.push({
    document: {
      uri: { fsPath: filePath }
    }
  });
}

export function resetVscodeStub(): void {
  window.lastErrorMessage = '';
  window.lastInfoMessage = '';
  window.lastWarningMessage = '';
  window.lastWarningSelection = undefined;
  window.quickPickResult = undefined;
  window.inputBoxResult = undefined;
  window.openDialogResult = undefined;
  window.activeColorTheme = { kind: ColorThemeKind.Dark };
  window.lastWebviewPanel = undefined;
  window.withProgressShouldCancel = false;
  window.withProgressCancelDelay = 0;
  window.lastProgressReports = [];
  createdTerminals.length = 0;
  visibleEditors.length = 0;
  commands.executed.length = 0;
  commands.registered.length = 0;
  capturedCompletionProviders.length = 0;
  // Handle case where workspaceFolders might be undefined
  if (workspace.workspaceFolders) {
    workspace.workspaceFolders.length = 0;
  } else {
    workspace.workspaceFolders = [];
  }
  env.clipboard.lastText = '';
  env.remoteName = undefined;
  env.lastOpenedUrl = undefined;
  clearConfigValues();
}
