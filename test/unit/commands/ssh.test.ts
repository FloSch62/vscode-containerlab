/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for the SSH commands (sshToNode, sshToLab).
 *
 * These tests verify that SSH commands are properly constructed
 * and executed in terminals with the correct user mappings.
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
  if (request.includes('extension') && !request.includes('stub') && !request.includes('.test')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  if (request === './command' || request.endsWith('/command')) {
    return path.join(__dirname, '..', '..', 'helpers', 'command-stub.js');
  }
  return null;
}

// Table-driven test cases for SSH target fallback
interface SshTargetTestCase {
  description: string;
  node: Record<string, any>;
  expectedTarget: string;
}

const sshTargetFallbackCases: SshTargetTestCase[] = [
  {
    description: 'uses v6Address when name is not available',
    node: { v6Address: '2001:db8::1', kind: 'arista_ceos', cID: 'def456' },
    expectedTarget: '2001:db8::1'
  },
  {
    description: 'uses v4Address when name and v6Address are not available',
    node: { v4Address: '192.168.1.1', kind: 'cisco_xrd', cID: 'ghi789' },
    expectedTarget: '192.168.1.1'
  },
  {
    description: 'uses cID as last resort target',
    node: { kind: 'generic_linux', cID: 'container123' },
    expectedTarget: 'container123'
  },
];

// Shared context
let sshToNode: Function;
let sshToLab: Function;
let commandStub: any;
let vscodeStub: any;

function setupSshTests() {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    commandStub = require('../../helpers/command-stub');
    vscodeStub = require('../../helpers/vscode-stub');
    const sshModule = require('../../../src/commands/ssh');
    sshToNode = sshModule.sshToNode;
    sshToLab = sshModule.sshToLab;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    commandStub.clearTerminalCommands();
    vscodeStub.window.lastErrorMessage = '';
  });
}

describe('sshToNode() - basic functionality', () => {
  setupSshTests();

  it('connects via SSH using node name as target', () => {
    const node = { name: 'router1', kind: 'nokia_srlinux', cID: 'abc123' } as any;
    sshToNode(node);

    expect(commandStub.calls).to.have.length(1);
    expect(commandStub.calls[0].command).to.equal('ssh admin@router1');
    expect(commandStub.calls[0].terminalName).to.equal('SSH - router1');
    expect(commandStub.calls[0].reuseOnly).to.be.true;
  });

  it('uses default admin user when kind is not in sshUserMapping', () => {
    const node = { name: 'linux-node', kind: 'unknown_kind', cID: 'jkl012' } as any;
    sshToNode(node);

    expect(commandStub.calls).to.have.length(1);
    expect(commandStub.calls[0].command).to.equal('ssh admin@linux-node');
  });
});

describe('sshToNode() - target fallback', () => {
  setupSshTests();

  sshTargetFallbackCases.forEach(({ description, node, expectedTarget }) => {
    it(description, () => {
      sshToNode(node as any);

      expect(commandStub.calls).to.have.length(1);
      expect(commandStub.calls[0].command).to.equal(`ssh admin@${expectedTarget}`);
    });
  });
});

describe('sshToNode() - error cases', () => {
  setupSshTests();

  it('shows error when node is undefined', () => {
    sshToNode(undefined);

    expect(vscodeStub.window.lastErrorMessage).to.equal('No container node selected.');
    expect(commandStub.calls).to.have.length(0);
  });

  it('shows error when no target is available', () => {
    const node = { kind: 'generic' } as any;
    sshToNode(node);

    expect(vscodeStub.window.lastErrorMessage).to.equal('No target to connect to container');
    expect(commandStub.calls).to.have.length(0);
  });
});

describe('sshToLab()', () => {
  setupSshTests();

  it('connects to all containers in lab', () => {
    const containers = [
      { name: 'node1', kind: 'nokia_srlinux', cID: 'c1' },
      { name: 'node2', kind: 'arista_ceos', cID: 'c2' }
    ];
    const node = { containers } as any;
    sshToLab(node);

    expect(commandStub.calls).to.have.length(2);
    expect(commandStub.calls[0].command).to.equal('ssh admin@node1');
    expect(commandStub.calls[1].command).to.equal('ssh admin@node2');
  });

  it('shows error when node is undefined', () => {
    sshToLab(undefined);

    expect(vscodeStub.window.lastErrorMessage).to.equal('No lab node selected.');
    expect(commandStub.calls).to.have.length(0);
  });

  it('shows error when lab has no containers', () => {
    const node = { containers: undefined } as any;
    sshToLab(node);

    expect(vscodeStub.window.lastErrorMessage).to.equal('No child containers to connect to');
    expect(commandStub.calls).to.have.length(0);
  });
});
