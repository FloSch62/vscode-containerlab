/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for fcli.ts - fcli (nornir-srl) commands.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';
import fs from 'fs';
import os from 'os';

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
  // Stub the command module for execCommandInTerminal
  if ((request.endsWith('/command') || request.endsWith('\\command')) && !request.includes('clabCommand')) {
    return path.join(__dirname, '..', '..', 'helpers', 'command-stub.js');
  }
  return null;
}

const ERR_NO_NODE = 'No lab node selected.';
const ERR_NO_TOPO = 'No topology path found.';
const TEST_LAB_NAME = 'test-lab';
const TEST_LAB_LABEL = 'Test Lab';
const YAML_NAME_ONLY = 'name: test\n';
const YAML_WITH_NETWORK = 'name: test\nmgmt:\n  network: custom-net\n';
const NORNIR_IMAGE = 'ghcr.io/srl-labs/nornir-srl';
const FCLI_TERMINAL_PREFIX = 'fcli';
const NETWORK_CLAB = '--network clab';
const NETWORK_CUSTOM = '--network custom-net';
const TEMP_DIR_PREFIX = 'fcli-test';
const TEST_YAML_FILE = 'test.clab.yml';
const MY_COMMAND = 'my-command';
const MY_COMMAND_PADDED = '  my-command  ';

// Test data for fcli commands
const fcliCommands = [
  { name: 'fcliBgpPeers', cmd: 'bgp-peers' },
  { name: 'fcliBgpRib', cmd: 'bgp-rib' },
  { name: 'fcliIpv4Rib', cmd: 'ipv4-rib' },
  { name: 'fcliLldp', cmd: 'lldp' },
  { name: 'fcliMac', cmd: 'mac' },
  { name: 'fcliNi', cmd: 'ni' },
  { name: 'fcliSubif', cmd: 'subif' },
  { name: 'fcliSysInfo', cmd: 'sys-info' },
];

let tempDir: string;
let testYamlPath: string;

function createTestNode(withPath: boolean = true) {
  const node: any = { name: TEST_LAB_NAME, label: TEST_LAB_LABEL };
  if (withPath) {
    node.labPath = { absolute: testYamlPath };
  }
  return node;
}

describe('fcli - error handling', () => {
  let fcliModule: any;
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
    fcliModule = require('../../../src/commands/fcli');

    // Create a temp directory for test YAML files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${TEMP_DIR_PREFIX}-`));
    testYamlPath = path.join(tempDir, TEST_YAML_FILE);
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();

    // Clean up temp directory
    try {
      if (fs.existsSync(testYamlPath)) {
        fs.unlinkSync(testYamlPath);
      }
      fs.rmdirSync(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    commandStub.clearTerminalCommands();
  });

  it('shows error when node is undefined', () => {
    fcliModule.fcliBgpPeers(undefined);

    expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_NODE);
    expect(commandStub.calls).to.have.length(0);
  });

  it('shows error when labPath is missing', () => {
    const node = { name: TEST_LAB_NAME, label: TEST_LAB_LABEL } as any;

    fcliModule.fcliBgpPeers(node);

    expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_TOPO);
    expect(commandStub.calls).to.have.length(0);
  });

  it('shows error when labPath.absolute is missing', () => {
    const node = { name: TEST_LAB_NAME, label: TEST_LAB_LABEL, labPath: {} } as any;

    fcliModule.fcliBgpPeers(node);

    expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_TOPO);
    expect(commandStub.calls).to.have.length(0);
  });
});

// Table-driven tests for each fcli command
describe('fcli - commands', () => {
  let fcliModule: any;
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
    fcliModule = require('../../../src/commands/fcli');

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${TEMP_DIR_PREFIX}2-`));
    testYamlPath = path.join(tempDir, TEST_YAML_FILE);
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();

    try {
      if (fs.existsSync(testYamlPath)) {
        fs.unlinkSync(testYamlPath);
      }
      fs.rmdirSync(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    commandStub.clearTerminalCommands();
  });

  fcliCommands.forEach(({ name, cmd }) => {
    it(`${name} runs fcli ${cmd} command in terminal`, () => {
      const node = createTestNode();
      fs.writeFileSync(testYamlPath, YAML_NAME_ONLY);

      fcliModule[name](node);

      expect(commandStub.calls).to.have.length(1);
      expect(commandStub.calls[0].command).to.include(cmd);
      expect(commandStub.calls[0].command).to.include(NORNIR_IMAGE);
      expect(commandStub.calls[0].terminalName).to.include(FCLI_TERMINAL_PREFIX);
    });
  });
});

describe('fcli - network extraction from YAML', () => {
  let fcliModule: any;
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
    fcliModule = require('../../../src/commands/fcli');

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${TEMP_DIR_PREFIX}3-`));
    testYamlPath = path.join(tempDir, TEST_YAML_FILE);
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();

    try {
      if (fs.existsSync(testYamlPath)) {
        fs.unlinkSync(testYamlPath);
      }
      fs.rmdirSync(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    commandStub.clearTerminalCommands();
  });

  it('uses clab as default network when no mgmt.network', () => {
    fs.writeFileSync(testYamlPath, YAML_NAME_ONLY);
    const node = createTestNode();

    fcliModule.fcliBgpPeers(node);

    expect(commandStub.calls[0].command).to.include(NETWORK_CLAB);
  });

  it('uses custom network from YAML mgmt.network', () => {
    fs.writeFileSync(testYamlPath, YAML_WITH_NETWORK);
    const node = createTestNode();

    fcliModule.fcliBgpPeers(node);

    expect(commandStub.calls[0].command).to.include(NETWORK_CUSTOM);
  });

  it('defaults to clab when YAML cannot be parsed', () => {
    fs.writeFileSync(testYamlPath, 'invalid: yaml: content:');
    const node = createTestNode();

    fcliModule.fcliBgpPeers(node);

    expect(commandStub.calls[0].command).to.include(NETWORK_CLAB);
  });

  it('defaults to clab when file does not exist', () => {
    const node = {
      name: TEST_LAB_NAME,
      label: TEST_LAB_LABEL,
      labPath: { absolute: '/nonexistent/path.clab.yml' }
    } as any;

    fcliModule.fcliBgpPeers(node);

    expect(commandStub.calls[0].command).to.include(NETWORK_CLAB);
  });
});

describe('fcli - fcliCustom', () => {
  let fcliModule: any;
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
    fcliModule = require('../../../src/commands/fcli');

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${TEMP_DIR_PREFIX}4-`));
    testYamlPath = path.join(tempDir, TEST_YAML_FILE);
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();

    try {
      if (fs.existsSync(testYamlPath)) {
        fs.unlinkSync(testYamlPath);
      }
      fs.rmdirSync(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    commandStub.clearTerminalCommands();
  });

  it('prompts for custom command', async () => {
    const node = createTestNode();
    fs.writeFileSync(testYamlPath, YAML_NAME_ONLY);
    vscodeStub.window.inputBoxResult = 'custom-command';

    await fcliModule.fcliCustom(node);

    expect(commandStub.calls).to.have.length(1);
    expect(commandStub.calls[0].command).to.include('custom-command');
  });

  it('does nothing when user cancels input', async () => {
    const node = createTestNode();
    vscodeStub.window.inputBoxResult = undefined;

    await fcliModule.fcliCustom(node);

    expect(commandStub.calls).to.have.length(0);
  });

  it('does nothing when user enters empty string', async () => {
    const node = createTestNode();
    vscodeStub.window.inputBoxResult = '   ';

    await fcliModule.fcliCustom(node);

    expect(commandStub.calls).to.have.length(0);
  });

  it('trims whitespace from custom command', async () => {
    const node = createTestNode();
    fs.writeFileSync(testYamlPath, YAML_NAME_ONLY);
    vscodeStub.window.inputBoxResult = MY_COMMAND_PADDED;

    await fcliModule.fcliCustom(node);

    expect(commandStub.calls[0].command).to.include(MY_COMMAND);
    expect(commandStub.calls[0].command).to.not.include(MY_COMMAND_PADDED);
  });
});

describe('fcli - docker command construction', () => {
  let fcliModule: any;
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
    fcliModule = require('../../../src/commands/fcli');

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcli-test5-'));
    testYamlPath = path.join(tempDir, TEST_YAML_FILE);
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();

    try {
      if (fs.existsSync(testYamlPath)) {
        fs.unlinkSync(testYamlPath);
      }
      fs.rmdirSync(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    commandStub.clearTerminalCommands();
  });

  it('mounts topology file to /topo.yml', () => {
    fs.writeFileSync(testYamlPath, YAML_NAME_ONLY);
    const node = createTestNode();

    fcliModule.fcliBgpPeers(node);

    expect(commandStub.calls[0].command).to.include(`"${testYamlPath}":/topo.yml`);
  });

  it('mounts /etc/hosts read-only', () => {
    fs.writeFileSync(testYamlPath, YAML_NAME_ONLY);
    const node = createTestNode();

    fcliModule.fcliBgpPeers(node);

    expect(commandStub.calls[0].command).to.include('/etc/hosts:/etc/hosts:ro');
  });

  it('uses --pull always flag', () => {
    fs.writeFileSync(testYamlPath, YAML_NAME_ONLY);
    const node = createTestNode();

    fcliModule.fcliBgpPeers(node);

    expect(commandStub.calls[0].command).to.include('--pull always');
  });

  it('uses --rm flag for auto-cleanup', () => {
    fs.writeFileSync(testYamlPath, YAML_NAME_ONLY);
    const node = createTestNode();

    fcliModule.fcliBgpPeers(node);

    expect(commandStub.calls[0].command).to.include('--rm');
  });
});
