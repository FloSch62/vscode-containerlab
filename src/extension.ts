import * as vscode from 'vscode';
import { ContainerlabTreeDataProvider } from './containerlabTreeDataProvider';
import { promisify } from 'util';
import { exec } from 'child_process';
import {
  deploy,
  deployCleanup,
  deploySpecificFile,
  destroy,
  destroyCleanup,
  redeploy,
  redeployCleanup,
  openLabFile,
  startNode,
  stopNode,
  attachShell,
  sshToNode,
  showLogs,
  graphNextUI,
  graphDrawIO,
  graphDrawIOInteractive,
  copyLabPath
} from './commands/index';

export let outputChannel: vscode.OutputChannel;
const execAsync = promisify(exec);

export async function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("Containerlab");
  context.subscriptions.push(outputChannel);

  // Check if containerlab is installed
  let versionOutput: string;
  try {
    const { stdout } = await execAsync('sudo containerlab version');
    versionOutput = stdout;
  } catch (err) {
    // Show error message with button to open installation guide
    const installAction = 'Open Installation Guide';
    const selection = await vscode.window.showErrorMessage(
      'containerlab not detected. Please install it first.',
      installAction
    );
    
    if (selection === installAction) {
      vscode.env.openExternal(vscode.Uri.parse('https://containerlab.dev/install/'));
    }
    versionOutput = '';
  }

  
  const provider = new ContainerlabTreeDataProvider();
  vscode.window.registerTreeDataProvider('containerlabExplorer', provider);

  context.subscriptions.push(vscode.commands.registerCommand('containerlab.refresh', () => {
    provider.refresh();
  }));

  context.subscriptions.push(vscode.commands.registerCommand('containerlab.lab.openFile', openLabFile));
  context.subscriptions.push(vscode.commands.registerCommand('containerlab.lab.copyPath', copyLabPath));

  context.subscriptions.push(vscode.commands.registerCommand('containerlab.lab.deploy', deploy));
  context.subscriptions.push(vscode.commands.registerCommand('containerlab.lab.deploy.cleanup', deployCleanup));
  context.subscriptions.push(vscode.commands.registerCommand('containerlab.lab.deploy.specificFile', deploySpecificFile));

  context.subscriptions.push(vscode.commands.registerCommand('containerlab.lab.redeploy', redeploy));
  context.subscriptions.push(vscode.commands.registerCommand('containerlab.lab.redeploy.cleanup', redeployCleanup));

  context.subscriptions.push(vscode.commands.registerCommand('containerlab.lab.destroy', destroy));
  context.subscriptions.push(vscode.commands.registerCommand('containerlab.lab.destroy.cleanup', destroyCleanup));

  context.subscriptions.push(vscode.commands.registerCommand('containerlab.lab.graph', graphNextUI));
  context.subscriptions.push(vscode.commands.registerCommand('containerlab.lab.graph.drawio', graphDrawIO));
  context.subscriptions.push(vscode.commands.registerCommand('containerlab.lab.graph.drawio.interactive', graphDrawIOInteractive));

  context.subscriptions.push(vscode.commands.registerCommand('containerlab.node.start', startNode));
  context.subscriptions.push(vscode.commands.registerCommand('containerlab.node.stop', stopNode));
  context.subscriptions.push(vscode.commands.registerCommand('containerlab.node.attachShell', attachShell));
  context.subscriptions.push(vscode.commands.registerCommand('containerlab.node.ssh', sshToNode));
  context.subscriptions.push(vscode.commands.registerCommand('containerlab.showLogs', showLogs));

  const config = vscode.workspace.getConfiguration("containerlab");
  const refreshInterval = config.get<number>("refreshInterval", 10000);

  const intervalId = setInterval(() => {
    provider.refresh();
  }, refreshInterval);
  context.subscriptions.push({ dispose: () => clearInterval(intervalId) });

}

export function deactivate() {}
