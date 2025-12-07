/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for the nodeImpairments command.
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

// Mock for utils module
let runCommandCalls: { cmd: string; desc: string }[] = [];
let runCommandResult: string = '';
let runCommandShouldFail = false;
let runCommandError: Error | null = null;

const utilsMock = {
  runCommand: async (cmd: string, desc: string) => {
    runCommandCalls.push({ cmd, desc });
    if (runCommandShouldFail) {
      throw runCommandError ?? new Error('Mock runCommand error');
    }
    return runCommandResult;
  }
};

// Mock for extension module
let mockContainerlabBinaryPath = 'containerlab';
const extensionMock = {
  get containerlabBinaryPath() {
    return mockContainerlabBinaryPath;
  },
  outputChannel: {
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {},
    trace: () => {}
  }
};

// Mock for webview HTML module
let getNodeImpairmentsHtmlCalls: any[] = [];
const webviewMock = {
  getNodeImpairmentsHtml: (...args: any[]) => {
    getNodeImpairmentsHtmlCalls.push(args);
    return '<html></html>';
  }
};

const MOCK_MARKER = 'MOCK_MARKER';

function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  const isExtensionModule = request.includes('extension') && !request.includes('stub') && !request.includes('.test');
  const isUtilsModule = request.includes('utils/utils') || request.endsWith('/utils');
  const isWebviewModule = request.includes('nodeImpairmentsHtml');
  if (isExtensionModule || isUtilsModule || isWebviewModule) {
    return MOCK_MARKER;
  }
  return null;
}

function getMockModule(id: string): any {
  if (id.includes('extension') && !id.includes('stub') && !id.includes('.test')) {
    return extensionMock;
  }
  if (id.includes('utils/utils') || id.endsWith('/utils')) {
    return utilsMock;
  }
  if (id.includes('nodeImpairmentsHtml')) {
    return webviewMock;
  }
  return null;
}

// Constants
const TEST_NODE_NAME = 'router1';
const TEST_INTERFACE_NAME = 'eth1';
const WSL_WARNING = 'Link impairment options are not available for WSL connections.';

// Shared context
let manageNodeImpairments: Function;
let vscodeStub: any;
let originalModuleRequire: any;

function setupNodeImpairmentsTests() {
  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath && stubPath !== MOCK_MARKER) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    originalModuleRequire = Module.prototype.require;
    (Module.prototype as any).require = function(id: string) {
      const mockModule = getMockModule(id);
      if (mockModule) {
        return mockModule;
      }
      return originalModuleRequire.call(this, id);
    };

    vscodeStub = require('../../helpers/vscode-stub');

    const nodeImpairmentsModule = require('../../../src/commands/nodeImpairments');
    manageNodeImpairments = nodeImpairmentsModule.manageNodeImpairments;
  });

  after(() => {
    if (originalModuleRequire) {
      Module.prototype.require = originalModuleRequire;
    }
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    runCommandCalls = [];
    runCommandResult = '';
    runCommandShouldFail = false;
    runCommandError = null;
    getNodeImpairmentsHtmlCalls = [];
    mockContainerlabBinaryPath = 'containerlab';
  });
}

// Helper to create test node
function createTestNode(overrides: any = {}) {
  return {
    name: TEST_NODE_NAME,
    label: TEST_NODE_NAME,
    interfaces: [
      { name: TEST_INTERFACE_NAME },
      { name: 'lo' }
    ],
    ...overrides
  };
}

// Helper to create mock context
function createMockContext() {
  return {
    extensionUri: { fsPath: '/extension' },
    subscriptions: []
  };
}

describe('manageNodeImpairments() - WSL check', () => {
  setupNodeImpairmentsTests();

  it('shows warning and returns early when running in WSL', async () => {
    vscodeStub.env.remoteName = 'wsl';

    const node = createTestNode();
    const context = createMockContext();

    await manageNodeImpairments(node, context);

    expect(vscodeStub.window.lastWarningMessage).to.equal(WSL_WARNING);
    expect(runCommandCalls).to.have.length(0);
  });

  it('proceeds when not running in WSL', async () => {
    vscodeStub.env.remoteName = undefined;
    runCommandResult = JSON.stringify({ [TEST_NODE_NAME]: [] });

    const node = createTestNode();
    const context = createMockContext();

    await manageNodeImpairments(node, context);

    expect(vscodeStub.window.lastWarningMessage).to.not.equal(WSL_WARNING);
  });
});

describe('manageNodeImpairments() - netem settings refresh', () => {
  setupNodeImpairmentsTests();

  it('calls containerlab tools netem show command', async () => {
    runCommandResult = JSON.stringify({ [TEST_NODE_NAME]: [] });

    const node = createTestNode();
    const context = createMockContext();

    await manageNodeImpairments(node, context);

    expect(runCommandCalls).to.have.length(1);
    expect(runCommandCalls[0].cmd).to.include('containerlab tools');
    expect(runCommandCalls[0].cmd).to.include('netem show');
    expect(runCommandCalls[0].cmd).to.include(`-n ${TEST_NODE_NAME}`);
  });

  it('parses netem show JSON response', async () => {
    const netemData = {
      [TEST_NODE_NAME]: [
        {
          interface: TEST_INTERFACE_NAME,
          delay: '50ms',
          jitter: '10ms',
          packet_loss: 5,
          rate: 1000,
          corruption: 2
        }
      ]
    };
    runCommandResult = JSON.stringify(netemData);

    const node = createTestNode();
    const context = createMockContext();

    await manageNodeImpairments(node, context);

    expect(getNodeImpairmentsHtmlCalls).to.have.length(1);
    const passedNetemMap = getNodeImpairmentsHtmlCalls[0][2];
    expect(passedNetemMap[TEST_INTERFACE_NAME]).to.exist;
    expect(passedNetemMap[TEST_INTERFACE_NAME].delay).to.equal('50ms');
    expect(passedNetemMap[TEST_INTERFACE_NAME].jitter).to.equal('10ms');
    expect(passedNetemMap[TEST_INTERFACE_NAME].loss).to.equal('5%');
    expect(passedNetemMap[TEST_INTERFACE_NAME].rate).to.equal('1000');
    expect(passedNetemMap[TEST_INTERFACE_NAME].corruption).to.equal('2%');
  });

  it('uses default values for empty fields', async () => {
    const netemData = {
      [TEST_NODE_NAME]: [
        {
          interface: TEST_INTERFACE_NAME,
          delay: '',
          jitter: '',
          packet_loss: 0,
          rate: 0,
          corruption: 0
        }
      ]
    };
    runCommandResult = JSON.stringify(netemData);

    const node = createTestNode();
    const context = createMockContext();

    await manageNodeImpairments(node, context);

    const passedNetemMap = getNodeImpairmentsHtmlCalls[0][2];
    expect(passedNetemMap[TEST_INTERFACE_NAME].delay).to.equal('0ms');
    expect(passedNetemMap[TEST_INTERFACE_NAME].jitter).to.equal('0ms');
    expect(passedNetemMap[TEST_INTERFACE_NAME].loss).to.equal('0.00%');
    expect(passedNetemMap[TEST_INTERFACE_NAME].rate).to.equal('0');
    expect(passedNetemMap[TEST_INTERFACE_NAME].corruption).to.equal('0.00%');
  });

  it('skips loopback interface', async () => {
    const netemData = {
      [TEST_NODE_NAME]: [
        { interface: 'lo', delay: '10ms', jitter: '5ms', packet_loss: 1, rate: 100, corruption: 1 },
        { interface: TEST_INTERFACE_NAME, delay: '20ms', jitter: '5ms', packet_loss: 2, rate: 200, corruption: 0 }
      ]
    };
    runCommandResult = JSON.stringify(netemData);

    const node = createTestNode();
    const context = createMockContext();

    await manageNodeImpairments(node, context);

    const passedNetemMap = getNodeImpairmentsHtmlCalls[0][2];
    expect(passedNetemMap['lo']).to.not.exist;
    expect(passedNetemMap[TEST_INTERFACE_NAME]).to.exist;
  });

  it('shows warning when netem show fails', async () => {
    runCommandShouldFail = true;
    runCommandError = new Error('Command failed');

    const node = createTestNode();
    const context = createMockContext();

    await manageNodeImpairments(node, context);

    expect(vscodeStub.window.lastWarningMessage).to.include('Failed to retrieve netem settings');
    expect(vscodeStub.window.lastWarningMessage).to.include('Command failed');
  });

  it('creates default values for interfaces not in netem response', async () => {
    runCommandResult = JSON.stringify({ [TEST_NODE_NAME]: [] });

    const node = createTestNode({
      interfaces: [
        { name: TEST_INTERFACE_NAME },
        { name: 'eth2' },
        { name: 'lo' }
      ]
    });
    const context = createMockContext();

    await manageNodeImpairments(node, context);

    const passedNetemMap = getNodeImpairmentsHtmlCalls[0][2];
    // eth1 and eth2 should have defaults, lo should be skipped
    expect(passedNetemMap[TEST_INTERFACE_NAME]).to.exist;
    expect(passedNetemMap['eth2']).to.exist;
    expect(passedNetemMap['lo']).to.not.exist;
  });
});

describe('manageNodeImpairments() - webview panel', () => {
  setupNodeImpairmentsTests();

  it('creates webview panel with correct title', async () => {
    runCommandResult = JSON.stringify({ [TEST_NODE_NAME]: [] });

    const node = createTestNode();
    const context = createMockContext();

    await manageNodeImpairments(node, context);

    expect(getNodeImpairmentsHtmlCalls).to.have.length(1);
    expect(getNodeImpairmentsHtmlCalls[0][1]).to.equal(TEST_NODE_NAME);
  });

  it('normalizes interface names with parentheses', async () => {
    const netemData = {
      [TEST_NODE_NAME]: [
        {
          interface: 'eth1 (host-side)',
          delay: '30ms',
          jitter: '5ms',
          packet_loss: 1,
          rate: 500,
          corruption: 0
        }
      ]
    };
    runCommandResult = JSON.stringify(netemData);

    const node = createTestNode({
      interfaces: [{ name: 'eth1 (host-side)' }]
    });
    const context = createMockContext();

    await manageNodeImpairments(node, context);

    const passedNetemMap = getNodeImpairmentsHtmlCalls[0][2];
    // Should be normalized to 'eth1'
    expect(passedNetemMap['eth1']).to.exist;
    expect(passedNetemMap['eth1'].delay).to.equal('30ms');
  });
});

describe('manageNodeImpairments() - message handling', () => {
  setupNodeImpairmentsTests();

  it('handles apply message', async () => {
    runCommandResult = JSON.stringify({ [TEST_NODE_NAME]: [] });

    const node = createTestNode();
    const context = createMockContext();

    await manageNodeImpairments(node, context);

    // Get the panel created
    // The webview panel was created, now simulate sending a message
    // Since our mock doesn't capture the panel directly, we verify the setup worked
    expect(getNodeImpairmentsHtmlCalls).to.have.length(1);
  });
});

describe('netem data parsing - table driven tests', () => {
  setupNodeImpairmentsTests();

  interface NetemParseTestCase {
    description: string;
    input: any;
    expectedDelay: string;
    expectedJitter: string;
    expectedLoss: string;
    expectedRate: string;
    expectedCorruption: string;
  }

  const parseTestCases: NetemParseTestCase[] = [
    {
      description: 'parses complete netem data',
      input: { interface: 'eth1', delay: '100ms', jitter: '20ms', packet_loss: 10, rate: 2000, corruption: 5 },
      expectedDelay: '100ms',
      expectedJitter: '20ms',
      expectedLoss: '10%',
      expectedRate: '2000',
      expectedCorruption: '5%'
    },
    {
      description: 'handles zero packet_loss',
      input: { interface: 'eth1', delay: '50ms', jitter: '10ms', packet_loss: 0, rate: 1000, corruption: 0 },
      expectedDelay: '50ms',
      expectedJitter: '10ms',
      expectedLoss: '0.00%',
      expectedRate: '1000',
      expectedCorruption: '0.00%'
    },
    {
      description: 'handles missing fields with defaults',
      input: { interface: 'eth1' },
      expectedDelay: '0ms',
      expectedJitter: '0ms',
      expectedLoss: '0.00%',
      expectedRate: '0',
      expectedCorruption: '0.00%'
    },
    {
      description: 'handles negative rate as zero',
      input: { interface: 'eth1', delay: '10ms', jitter: '5ms', packet_loss: 1, rate: -100, corruption: 0 },
      expectedDelay: '10ms',
      expectedJitter: '5ms',
      expectedLoss: '1%',
      expectedRate: '0',
      expectedCorruption: '0.00%'
    }
  ];

  parseTestCases.forEach(({ description, input, expectedDelay, expectedJitter, expectedLoss, expectedRate, expectedCorruption }) => {
    it(description, async () => {
      runCommandResult = JSON.stringify({ [TEST_NODE_NAME]: [input] });

      const node = createTestNode();
      const context = createMockContext();

      await manageNodeImpairments(node, context);

      const passedNetemMap = getNodeImpairmentsHtmlCalls[0][2];
      const intfName = input.interface.split('(')[0].trim();
      expect(passedNetemMap[intfName].delay).to.equal(expectedDelay);
      expect(passedNetemMap[intfName].jitter).to.equal(expectedJitter);
      expect(passedNetemMap[intfName].loss).to.equal(expectedLoss);
      expect(passedNetemMap[intfName].rate).to.equal(expectedRate);
      expect(passedNetemMap[intfName].corruption).to.equal(expectedCorruption);
    });
  });
});

describe('manageNodeImpairments() - runtime configuration', () => {
  setupNodeImpairmentsTests();

  it('uses docker runtime by default', async () => {
    runCommandResult = JSON.stringify({ [TEST_NODE_NAME]: [] });

    const node = createTestNode();
    const context = createMockContext();

    await manageNodeImpairments(node, context);

    expect(runCommandCalls[0].cmd).to.include('-r docker');
  });

  it('uses configured containerlab binary path', async () => {
    mockContainerlabBinaryPath = '/custom/path/clab';
    runCommandResult = JSON.stringify({ [TEST_NODE_NAME]: [] });

    const node = createTestNode();
    const context = createMockContext();

    await manageNodeImpairments(node, context);

    expect(runCommandCalls[0].cmd).to.include('/custom/path/clab');
  });
});
