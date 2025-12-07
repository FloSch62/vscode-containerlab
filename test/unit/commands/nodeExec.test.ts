/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for nodeExec.ts - shell attachment and telnet commands.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;

function clearModuleCache() {
  Object.keys(require.cache).forEach(key => {
    if (key.includes('vscode-containerlab') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  });
}

function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  // Only intercept the extension module, not nodeExec imports
  if (request.endsWith('/extension') || request.endsWith('\\extension')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  // Only intercept ./command, not clabCommand
  if ((request.endsWith('/command') || request.endsWith('\\command')) && !request.includes('clabCommand')) {
    return path.join(__dirname, '..', '..', 'helpers', 'command-stub.js');
  }
  return null;
}

const ERR_NO_NODE = 'No container node selected.';
const ERR_NO_CONTAINER_ID = 'No containerId for shell attach.';
const ERR_NO_KIND = 'No container kind for shell attach.';
const KIND_LINUX = 'linux';
const KIND_SRLINUX = 'nokia_srlinux';
const TEST_CONTAINER_ID = 'container-123';
const TEST_NODE_NAME = 'router1';

describe('nodeExec commands - attachShell', () => {
  let nodeExecModule: any;
  let vscodeStub: any;
  let commandStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    commandStub = require('../../helpers/command-stub');
    nodeExecModule = require('../../../src/commands/nodeExec');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    commandStub.clearTerminalCommands();
  });

  describe('attachShell() - error handling', () => {
    it('shows error when node is undefined', () => {
      nodeExecModule.attachShell(undefined);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_NODE);
      expect(commandStub.calls).to.have.length(0);
    });

    it('shows error when containerId is missing', () => {
      const node = { kind: KIND_SRLINUX, name: TEST_NODE_NAME } as any;

      nodeExecModule.attachShell(node);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_CONTAINER_ID);
      expect(commandStub.calls).to.have.length(0);
    });

    it('shows error when kind is missing', () => {
      const node = { cID: TEST_CONTAINER_ID, name: TEST_NODE_NAME } as any;

      nodeExecModule.attachShell(node);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_KIND);
      expect(commandStub.calls).to.have.length(0);
    });
  });

  describe('attachShell() - command execution', () => {
    it('executes docker exec command with default shell', () => {
      const node = { cID: TEST_CONTAINER_ID, kind: KIND_LINUX, name: TEST_NODE_NAME } as any;

      nodeExecModule.attachShell(node);

      expect(commandStub.calls).to.have.length(1);
      expect(commandStub.calls[0].command).to.include('docker exec -it container-123');
      expect(commandStub.calls[0].terminalName).to.equal('Shell - router1');
      expect(commandStub.calls[0].reuseOnly).to.be.true;
    });

    it('uses srlinux shell command for nokia_srlinux kind', () => {
      const node = { cID: 'container-456', kind: KIND_SRLINUX, name: 'srl1' } as any;

      nodeExecModule.attachShell(node);

      expect(commandStub.calls).to.have.length(1);
      expect(commandStub.calls[0].command).to.include('sr_cli');
    });

    it('uses containerId as terminal name when name is missing', () => {
      const node = { cID: 'container-789', kind: KIND_LINUX } as any;

      nodeExecModule.attachShell(node);

      expect(commandStub.calls).to.have.length(1);
      expect(commandStub.calls[0].terminalName).to.equal('Shell - container-789');
    });
  });
});

describe('nodeExec commands - telnetToNode', () => {
  let nodeExecModule: any;
  let vscodeStub: any;
  let commandStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    commandStub = require('../../helpers/command-stub');
    nodeExecModule = require('../../../src/commands/nodeExec');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    commandStub.clearTerminalCommands();
  });

  describe('telnetToNode() - error handling', () => {
    it('shows error when node is undefined', () => {
      nodeExecModule.telnetToNode(undefined);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_NODE);
      expect(commandStub.calls).to.have.length(0);
    });

    it('shows error when containerId is missing', () => {
      const node = { kind: KIND_SRLINUX, name: TEST_NODE_NAME } as any;

      nodeExecModule.telnetToNode(node);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_CONTAINER_ID);
      expect(commandStub.calls).to.have.length(0);
    });
  });

  describe('telnetToNode() - command execution', () => {
    it('executes telnet command with default port', () => {
      const node = { cID: TEST_CONTAINER_ID, kind: KIND_LINUX, name: TEST_NODE_NAME } as any;

      nodeExecModule.telnetToNode(node);

      expect(commandStub.calls).to.have.length(1);
      expect(commandStub.calls[0].command).to.include('docker exec -it container-123 telnet 127.0.0.1');
      expect(commandStub.calls[0].terminalName).to.equal('Telnet - router1');
      expect(commandStub.calls[0].reuseOnly).to.be.true;
    });

    it('uses containerId as terminal name when name is missing', () => {
      const node = { cID: 'container-abc', kind: KIND_LINUX } as any;

      nodeExecModule.telnetToNode(node);

      expect(commandStub.calls).to.have.length(1);
      expect(commandStub.calls[0].terminalName).to.equal('Telnet - container-abc');
    });
  });
});
