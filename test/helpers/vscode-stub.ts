export const ProgressLocation = {
  Notification: 1,
  SourceControl: 2,
  Window: 3,
};

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

export const window = {
  lastErrorMessage: '',
  lastInfoMessage: '',
  lastWarningMessage: '',
  lastWarningSelection: undefined as string | undefined,
  quickPickResult: undefined as string | undefined,
  inputBoxResult: undefined as string | undefined,
  openDialogResult: undefined as { fsPath: string }[] | undefined,
  terminals: createdTerminals as MockTerminal[],
  createOutputChannel(_name: string, options?: { log: boolean } | string) {
    const isLogChannel = typeof options === 'object' && options?.log;
    return {
      appendLine() {},
      show() {},
      // LogOutputChannel methods (when { log: true } is passed)
      ...(isLogChannel && {
        info() {},
        debug() {},
        warn() {},
        error() {},
        trace() {},
      }),
    };
  },
  createTerminal(options: { name: string; shellPath?: string; shellArgs?: string[] }) {
    const terminal: MockTerminal = {
      name: options.name,
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
  withProgress<T>(
    _options: { location: number; title: string; cancellable: boolean },
    task: () => Promise<T>
  ): Promise<T> {
    // Simply execute the task without progress UI
    return task();
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
};

export const commands = {
  executed: [] as { command: string; args: any[] }[],
  executeCommand(command: string, ...args: any[]) {
    this.executed.push({ command, args });
    return Promise.resolve();
  },
};

export const workspace = {
  workspaceFolders: [] as { uri: { fsPath: string }; name?: string }[],
  getConfiguration() {
    return {
      get: <T>(_: string, defaultValue?: T): T | undefined => defaultValue,
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
    return { dispose() {} };
  },
  fs: {
    readFile: async () => new TextEncoder().encode('{}'),
  },
};

export const Uri = {
  file(p: string) {
    return { fsPath: p };
  },
  joinPath(...parts: any[]) {
    return { fsPath: parts.map(p => (typeof p === 'string' ? p : p.fsPath)).join('/') };
  },
};

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
  clipboard: {
    lastText: '',
    writeText(text: string) {
      this.lastText = text;
      return Promise.resolve();
    },
  },
  openExternal(_uri: any) {
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

export function resetVscodeStub(): void {
  window.lastErrorMessage = '';
  window.lastInfoMessage = '';
  window.lastWarningMessage = '';
  window.lastWarningSelection = undefined;
  window.quickPickResult = undefined;
  window.inputBoxResult = undefined;
  window.openDialogResult = undefined;
  createdTerminals.length = 0;
  commands.executed.length = 0;
  workspace.workspaceFolders.length = 0;
  env.clipboard.lastText = '';
}
