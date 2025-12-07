/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for the showLogs command.
 *
 * Verifies that container logs are properly displayed in a terminal.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;

// Helper to clear module cache for all vscode-containerlab modules
function clearModuleCache() {
  Object.keys(require.cache).forEach(key => {
    if (key.includes('vscode-containerlab') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  });
}

// Helper to resolve stub paths for module interception
function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request === './command' || request.endsWith('/command')) {
    return path.join(__dirname, '..', '..', 'helpers', 'command-stub.js');
  }
  return null;
}

describe('showLogs command', () => {
  let showLogs: Function;
  let commandStub: any;
  let vscodeStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    commandStub = require('../../helpers/command-stub');
    vscodeStub = require('../../helpers/vscode-stub');
    const showLogsModule = require('../../../src/commands/showLogs');
    showLogs = showLogsModule.showLogs;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    commandStub.clearTerminalCommands();
    vscodeStub.window.lastErrorMessage = '';
  });

  it('shows logs for container using docker runtime', () => {
    const node = { cID: 'container-123', name: 'router1' } as any;

    showLogs(node);

    expect(commandStub.calls).to.have.length(1);
    expect(commandStub.calls[0].command).to.equal('docker logs -f container-123');
    expect(commandStub.calls[0].terminalName).to.equal('Logs - router1');
  });

  it('uses containerId in terminal name when name is not available', () => {
    const node = { cID: 'abc123' } as any;

    showLogs(node);

    expect(commandStub.calls).to.have.length(1);
    expect(commandStub.calls[0].terminalName).to.equal('Logs - abc123');
  });

  it('shows error when node is undefined', () => {
    showLogs(undefined);

    expect(vscodeStub.window.lastErrorMessage).to.equal('No container node selected.');
    expect(commandStub.calls).to.have.length(0);
  });

  it('shows error when containerId is missing', () => {
    const node = { name: 'router1' } as any;

    showLogs(node);

    expect(vscodeStub.window.lastErrorMessage).to.equal('No containerID for logs.');
    expect(commandStub.calls).to.have.length(0);
  });
});
