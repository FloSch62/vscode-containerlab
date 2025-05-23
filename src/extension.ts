import * as vscode from 'vscode';
import * as cmd from './commands/index';
import * as utils from './utils';
import * as ins from "./treeView/inspector"
import * as c from './treeView/common';
import * as path from 'path';

import {
  ensureClabInstalled,
  checkAndUpdateClabIfNeeded
} from './helpers/containerlabUtils';
import { TopoViewerEditor } from './topoViewerEditor/backend/topoViewerEditorWebUiFacade'; // adjust the import path as needed


import { WelcomePage } from './welcomePage';
import { LocalLabTreeDataProvider } from './treeView/localLabsProvider';
import { RunningLabTreeDataProvider } from './treeView/runningLabsProvider';

/** Our global output channel */
export let outputChannel: vscode.OutputChannel;
export let treeView: any;
export let localTreeView: any;
export let runningTreeView: any;
export let username: string;
export let hideNonOwnedLabsState: boolean = false;

export const execCmdMapping = require('../resources/exec_cmd.json');
export const sshUserMapping = require('../resources/ssh_users.json');

/**
 * Called when VSCode activates your extension.
 */
export async function activate(context: vscode.ExtensionContext) {
  // Create and register the output channel
  outputChannel = vscode.window.createOutputChannel('Containerlab');
  context.subscriptions.push(outputChannel);

  outputChannel.appendLine(process.platform);

  // Allow activation only on Linux or when connected via WSL.
  if (process.platform !== "linux" && vscode.env.remoteName !== "wsl") {
    vscode.window.showWarningMessage(
      "The Containerlab extension is only supported on Linux or WSL. It will not be activated on this system."
    );
    return; // Do not activate the extension.
  }

  outputChannel.appendLine('[DEBUG] Containerlab extension activated.');

  // 1) Ensure containerlab is installed
  const clabInstalled = await ensureClabInstalled(outputChannel);
  if (!clabInstalled) {
    // If user declined installation, bail out
    return;
  }

  // 2) If installed, check for updates
  checkAndUpdateClabIfNeeded(outputChannel, context).catch(err => {
    outputChannel.appendLine(`[ERROR] Update check error: ${err.message}`);
  });

  // Show welcome page
  const welcomePage = new WelcomePage(context);
  await welcomePage.show();

  // Initial pull of inspect data
  ins.update();

  // Tree data provider
  const localLabsProvider = new LocalLabTreeDataProvider();
  const runningLabsProvider = new RunningLabTreeDataProvider(context);


  localTreeView = vscode.window.createTreeView('localLabs', {
    treeDataProvider: localLabsProvider,
    canSelectMany: true
  });

  runningTreeView = vscode.window.createTreeView('runningLabs', {
    treeDataProvider: runningLabsProvider,
    canSelectMany: true
  });

  // get the username
  username = utils.getUsername();

  // Determine if local capture is allowed.
  const isLocalCaptureAllowed =
    vscode.env.remoteName !== "ssh-remote" && !utils.isOrbstack();
  vscode.commands.executeCommand(
    'setContext',
    'containerlab:isLocalCaptureAllowed',
    isLocalCaptureAllowed
  );

  // Register commands

  // Refresh the tree view
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.refresh', () => {
      localLabsProvider.refresh();
      runningLabsProvider.refresh();
    })
  );

  // Lab file and workspace commands
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.lab.openFile', cmd.openLabFile)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.lab.addToWorkspace', cmd.addLabFolderToWorkspace)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.lab.openFolderInNewWindow', cmd.openFolderInNewWindow)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.lab.copyPath', cmd.copyLabPath)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.viewLogs', () => {
      outputChannel.show(true);
    })
  );

  // Lab deployment commands
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.lab.deploy', cmd.deploy)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.lab.deploy.cleanup', cmd.deployCleanup)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.lab.deploy.specificFile', cmd.deploySpecificFile)
  );

  // Lab redeployment commands
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.lab.redeploy', cmd.redeploy)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.lab.redeploy.cleanup', cmd.redeployCleanup)
  );

  // Lab destruction commands
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.lab.destroy', cmd.destroy)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.lab.destroy.cleanup', cmd.destroyCleanup)
  );

  // Lab save command
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.lab.save', cmd.saveLab)
  );

  // Lab connecto to SSH
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.lab.sshToAllNodes', cmd.sshToLab)
  );

  // Lab inspection commands
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.inspectAll', () =>
      cmd.inspectAllLabs(context)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.inspectOneLab', node =>
      cmd.inspectOneLab(node, context)
    )
  );

  // Lab graph commands
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.lab.graph', cmd.graphNextUI)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.lab.graph.drawio', cmd.graphDrawIO)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'containerlab.lab.graph.drawio.interactive',
      cmd.graphDrawIOInteractive
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.lab.graph.topoViewer', node =>
      cmd.graphTopoviewer(node, context)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'containerlab.lab.graph.topoViewerReload',
      cmd.graphTopoviewerReload
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'containerlab.editor.topoViewerEditor.open',
      async (node: c.ClabLabTreeNode) => {
        const yamlUri = vscode.Uri.file(node.labPath.absolute);
        const labName = path.basename(yamlUri.fsPath, path.extname(yamlUri.fsPath));

        const editor = new TopoViewerEditor(context);

        /* remember where the file lives – needed by helper functions */
        editor.lastYamlFilePath = yamlUri.fsPath;

        /* 1. create / show the web-view panel */
        await editor.createWebviewPanel(context, yamlUri, labName);

        /* 2. open the YAML itself beside the web-view        */
        await editor.openTemplateFile(yamlUri.fsPath);      // ← split-view
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.editor.topoViewerEditor', async () => {

      // Show a single "Save As" dialog where they both pick the folder AND type the filename:
      const uri = await vscode.window.showSaveDialog({
        title: 'Enter containerlab topology template file name',
        defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,  // start in first workspace folder otherwise in home directory
        saveLabel: 'Create Containerlab topology template file',
        filters: { 'YAML': ['yaml', 'yml'] }
      })

      if (!uri) {
        vscode.window.showWarningMessage('No file path selected. Operation canceled.');
        return;
      }

      // Derive the labName (without extension) from what they typed:
      const labName = path.basename(uri.fsPath, path.extname(uri.fsPath));

      // Delegate to your template‑writer helper:
      const editor = new TopoViewerEditor(context);
      try {
        await editor.createTemplateFile(context, uri);

        // Open the webview panel topoViewerEditor.
        await editor.createWebviewPanel(context, uri, labName)

        // Open the created file in a split editor.
        await editor.openTemplateFile(editor.lastYamlFilePath);

      } catch {
        // createTemplateFile will have already shown an error
        return;
      }

    })
  );

  // Register configuration for file watching
  vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('containerlab.autoSync')) {
      // Access the setting to trigger any watchers
      void vscode.workspace.getConfiguration('containerlab').get('autoSync', true);
    }
  });

  // Node commands
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.node.start', cmd.startNode)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.node.stop', cmd.stopNode)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.node.save', cmd.saveNode)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.node.attachShell', cmd.attachShell)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.node.ssh', cmd.sshToNode)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.node.telnet', cmd.telnetToNode)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.node.showLogs', cmd.showLogs)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.node.openBrowser', cmd.openBrowser)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.node.manageImpairments', node =>
      cmd.manageNodeImpairments(node, context)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'containerlab.node.copyIPv4Address',
      cmd.copyContainerIPv4Address
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'containerlab.node.copyIPv6Address',
      cmd.copyContainerIPv6Address
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.node.copyName', cmd.copyContainerName)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.node.copyID', cmd.copyContainerID)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.node.copyKind', cmd.copyContainerKind)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.node.copyImage', cmd.copyContainerImage)
  );

  // Interface commands
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.interface.capture', cmd.captureInterface)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'containerlab.interface.captureWithEdgeshark',
      (clickedNode, allSelectedNodes) => {
        cmd.captureInterfaceWithPacketflix(clickedNode, allSelectedNodes);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.interface.setDelay', cmd.setLinkDelay)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.interface.setJitter', cmd.setLinkJitter)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.interface.setLoss', cmd.setLinkLoss)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.interface.setRate', cmd.setLinkRate)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'containerlab.interface.setCorruption',
      cmd.setLinkCorruption
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.interface.copyMACAddress', cmd.copyMACAddress)
  );

  // Edgeshark install/uninstall
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.install.edgeshark', cmd.installEdgeshark)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.uninstall.edgeshark', cmd.uninstallEdgeshark)
  );

  // Session hostname command
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.set.sessionHostname', cmd.setSessionHostname)
  );

  // Hide/show non-owned labs
  const hideNonOwnedLabs = (hide: boolean) => {
    hideNonOwnedLabsState = hide;
    vscode.commands.executeCommand('setContext', 'containerlab:nonOwnedLabsHidden', hide);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.treeView.runningLabs.hideNonOwnedLabs', () => {
      runningLabsProvider.refreshWithoutDiscovery();
      hideNonOwnedLabs(true);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.treeView.runningLabs.showNonOwnedLabs', () => {
      runningLabsProvider.refreshWithoutDiscovery();
      hideNonOwnedLabs(false);
    })
  );

  // Filter commands for running labs
  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.treeView.runningLabs.filter', async () => {
      const val = await vscode.window.showInputBox({ placeHolder: 'Filter running labs' });
      if (val !== undefined) {
        runningLabsProvider.setTreeFilter(val);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.treeView.runningLabs.clearFilter', () => {
      runningLabsProvider.clearTreeFilter();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.treeView.localLabs.filter', async () => {
      const val = await vscode.window.showInputBox({ placeHolder: 'Filter local labs' });
      if (val !== undefined) {
        localLabsProvider.setTreeFilter(val);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('containerlab.treeView.localLabs.clearFilter', () => {
      localLabsProvider.clearTreeFilter();
    })
  );

  // Auto-refresh the TreeView based on user setting
  const config = vscode.workspace.getConfiguration('containerlab');
  const refreshInterval = config.get<number>('refreshInterval', 10000);

  const refreshTaskID = setInterval(
    async ()=> {
      ins.update().then( () => {
        localLabsProvider.refresh();
        runningLabsProvider.softRefresh();
      })
    }, refreshInterval
  )

  context.subscriptions.push({ dispose: () => clearInterval(refreshTaskID)});
}

export function deactivate() {
  if (outputChannel) {
    outputChannel.appendLine('[DEBUG] Deactivating Containerlab extension.');
  }
}
