export const instances: any[] = [];

export class ClabCommand {
  public action: string;
  public node: any;
  public spinnerMessages: any;
  public runArgs: any[] | undefined;

  constructor(action: string, node: any, spinnerMessages?: any, _terminalMode?: boolean, _terminalName?: string) {
    this.action = action;
    this.node = node;
    this.spinnerMessages = spinnerMessages || {
      progressMsg: action === 'deploy' ? 'Deploying Lab... ' : `${action}ing Lab... `,
      successMsg: action === 'deploy' ? 'Lab deployed successfully!' : `Lab ${action}ed successfully!`
    };
    instances.push(this);
  }

  run(args?: string[]): Promise<void> {
    this.runArgs = args;
    return Promise.resolve();
  }
}
