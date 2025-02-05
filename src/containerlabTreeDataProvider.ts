import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as utils from './utils';

const execAsync = promisify(exec);

export class ContainerlabNode extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly details?: ClabNodeDetails,
    contextValue?: string
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;
  }
}

interface LabInfo {
  labPath: string;
  localExists: boolean;
  containers: any[];
  labName?: string;
  owner?: string;
}

export interface ClabNodeDetails {
  state?: any;
  hostname?: string;
  containerId?: string;
  v4Addr?: string;
  v6Addr?: string;
  labName?: string;
  labPath?: string;
  localExists?: boolean;
  containers?: any[];
  owner?: string;
}

export class ContainerlabTreeDataProvider implements vscode.TreeDataProvider<ContainerlabNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ContainerlabNode | undefined | void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor() { }

  getTreeItem(element: ContainerlabNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ContainerlabNode): Promise<ContainerlabNode[]> {
    if (!element) {
      return this.getAllLabs();
    }
    else {
      const info = element.details as LabInfo;
      if (info && info.containers.length > 0) {
        return this.getContainerNodes(info.containers);
      }
      return [];
    }
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  private async getAllLabs(): Promise<ContainerlabNode[]> {
    const localFiles = await this.findLocalClabFiles();
    const labData = await this.inspectContainerlab();

    const allPaths = new Set<string>([...Object.keys(labData), ...localFiles]);
    if (allPaths.size === 0) {
      return [
        new ContainerlabNode('No local .clab files or labs found', vscode.TreeItemCollapsibleState.None)
      ];
    }

    const nodes: ContainerlabNode[] = [];
    for (const labPath of allPaths) {
      const info = labData[labPath] || { labPath, containers: [], labName: undefined, owner: undefined };
      const localExists = localFiles.includes(labPath);
      info.localExists = localExists;

      let finalLabel = info.labName;
      if (!finalLabel) {
        if (localExists) {
          finalLabel = path.basename(labPath);
        } else {
          finalLabel = labPath;
        }
      }

      if (info.owner) {
        finalLabel += ` (${info.owner})`;
      }

      let contextVal: string;
      let color: vscode.ThemeColor;
      if (info.containers.length === 0) {
        // Undeployed
        contextVal = "containerlabLabUndeployed";
        color = new vscode.ThemeColor('disabledForeground'); // grey
      } else {
        // Deployed
        contextVal = "containerlabLabDeployed";
        const states = info.containers.map(c => c.state);
        const allRunning = states.every(s => s === 'running');
        const noneRunning = states.every(s => s !== 'running');
        if (allRunning) {
          color = new vscode.ThemeColor('testing.iconPassed'); // green
        } else if (noneRunning) {
          color = new vscode.ThemeColor('testing.iconFailed'); // red
        } else {
          color = new vscode.ThemeColor('problemsWarningIcon.foreground'); // partial => yellow
        }
      }

      const collapsible = (info.containers.length > 0)
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;

      const node = new ContainerlabNode(
        finalLabel,
        collapsible,
        {
          labPath: labPath,
          localExists: localExists,
          containers: info.containers,
          labName: info.labName,
          owner: info.owner
        },
        contextVal
      );
      node.iconPath = new vscode.ThemeIcon('circle-filled', color);
      node.description = utils.getRelLabFolderPath(labPath);
      nodes.push(node);
    }

    // 1) Labs with contextValue === "containerlabLabDeployed" come first
    // 2) Then labs with contextValue === "containerlabLabUndeployed"
    // 3) Within each group, sort by labPath
    nodes.sort((a, b) => {
      // First compare contextValue
      if (a.contextValue === "containerlabLabDeployed" && b.contextValue === "containerlabLabUndeployed") {
        return -1; // a goes first
      }
      if (a.contextValue === "containerlabLabUndeployed" && b.contextValue === "containerlabLabDeployed") {
        return 1; // b goes first
      }
      // If both have the same contextValue, labPath
      return a.details!.labPath!.localeCompare(b.details!.labPath!);
    });

    return nodes;
  }

  private getContainerNodes(containers: any[]): ContainerlabNode[] {
    const containerNodes = containers.map((ctr: any) => {
      let v4Addr, v6Addr: string | undefined;

      if (ctr.ipv4_address) v4Addr = ctr.ipv4_address.split('/')[0];
      if (ctr.ipv6_address) v6Addr = ctr.ipv6_address.split('/')[0];

      const label = `${ctr.name} (${ctr.state})`;

      const node = new ContainerlabNode(
        label,
        vscode.TreeItemCollapsibleState.None,
        {
          hostname: ctr.name,
          containerId: ctr.container_id,
          state: ctr.state,
          v4Addr: v4Addr,
          v6Addr: v6Addr,
        },
        "containerlabContainer",
      );
      node.tooltip = `Container: ${ctr.name}\nID: ${ctr.container_id}\nState: ${ctr.state}`;

      if (ctr.state === 'running') node.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'));
      else node.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconFailed'));

      return node;
    });

    // Sort containers by label
    containerNodes.sort((a, b) => a.label.localeCompare(b.label));
    return containerNodes;
  }

  private async findLocalClabFiles(): Promise<string[]> {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) return [];

    const patterns = ['**/*.clab.yml', '**/*.clab.yaml'];
    const exclude = '**/node_modules/**';

    let uris: vscode.Uri[] = [];
    for (const pat of patterns) {
      const found = await vscode.workspace.findFiles(pat, exclude);
      uris.push(...found);
    }

    const set = new Set<string>();
    for (const uri of uris) {
      set.add(uri.fsPath);
    }
    return [...set];
  }

  private async inspectContainerlab(): Promise<Record<string, LabInfo>> {
    let stdout: string;
    try {
      const { stdout: out } = await execAsync('sudo containerlab inspect --all --format json');
      stdout = out;
    } catch (err) {
      console.debug(`Error running containerlab inspect: ${err}`);
      return {};
    }

    let parsed: any;
    try {
      parsed = JSON.parse(stdout);
    } catch (err) {
      console.debug(`Error parsing containerlab JSON: ${err}`);
      parsed = { containers: [] };
    }

    const arr = parsed.containers || [];
    const map: Record<string, LabInfo> = {};

    // Single folder base
    let singleFolderBase: string | undefined;
    const wsf = vscode.workspace.workspaceFolders;
    if (wsf && wsf.length === 1) {
      singleFolderBase = wsf[0].uri.fsPath;
    }

    for (const c of arr) {
      let p = c.labPath || '';
      const original = p;
      p = utils.normalizeLabPath(p, singleFolderBase);
      console.debug(
        `Container: ${c.name}, original path: ${original}, normalized: ${p}`
      );

      if (!map[p]) {
        map[p] = {
          labPath: p,
          localExists: false,
          containers: [],
          labName: c.lab_name,
          owner: c.owner
        };
      }
      map[p].containers.push(c);
    }

    return map;
  }
}
