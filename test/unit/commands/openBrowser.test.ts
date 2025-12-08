/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for the openBrowser command.
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
  if (request === 'dockerode') {
    return path.join(__dirname, '..', '..', 'helpers', 'dockerode-stub.js');
  }
  return null;
}

// Constants
const NO_NODE_ERROR = 'No container node selected.';
const NO_CID_ERROR = 'No container ID found.';
const NO_PORTS_MSG = 'No exposed ports';
const TEST_CONTAINER_ID = 'container123';
const TEST_CONTAINER_NAME = 'router1';

// Table-driven test cases
interface OpenBrowserErrorCase {
  description: string;
  node: any;
  expectedError: string;
}

const errorCases: OpenBrowserErrorCase[] = [
  {
    description: 'shows error when node is undefined',
    node: undefined,
    expectedError: NO_NODE_ERROR
  },
  {
    description: 'shows error when node is null',
    node: null,
    expectedError: NO_NODE_ERROR
  },
  {
    description: 'shows error when node has no cID',
    node: { name: TEST_CONTAINER_NAME },
    expectedError: NO_CID_ERROR
  }
];

// Shared context
let openBrowser: Function;
let vscodeStub: any;
let extensionStub: any;
let dockerodeStub: any;

function setupOpenBrowserTests() {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    extensionStub = require('../../helpers/extension-stub');
    dockerodeStub = require('../../helpers/dockerode-stub');

    const openBrowserModule = require('../../../src/commands/openBrowser');
    openBrowser = openBrowserModule.openBrowser;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
    dockerodeStub.clearDockerMocks();
  });
}

describe('openBrowser() - error handling', () => {
  setupOpenBrowserTests();

  errorCases.forEach(({ description, node, expectedError }) => {
    it(description, async () => {
      await openBrowser(node);
      expect(vscodeStub.window.lastErrorMessage).to.equal(expectedError);
    });
  });
});

describe('openBrowser() - no ports exposed', () => {
  setupOpenBrowserTests();

  it('shows info when no ports are exposed', async () => {
    const Docker = dockerodeStub.default;
    const client = new Docker();
    extensionStub.setDockerClient(client);

    // Set up container with no ports
    dockerodeStub.setContainer(TEST_CONTAINER_ID, {
      running: true,
      paused: false,
      name: TEST_CONTAINER_NAME
    });

    const node = {
      name: TEST_CONTAINER_NAME,
      cID: TEST_CONTAINER_ID
    };

    await openBrowser(node);

    expect(vscodeStub.window.lastInfoMessage).to.include(NO_PORTS_MSG);
  });

  it('returns empty array when docker client unavailable', async () => {
    extensionStub.setDockerClient(undefined);

    const node = {
      name: TEST_CONTAINER_NAME,
      cID: TEST_CONTAINER_ID
    };

    await openBrowser(node);

    // Should show no ports message since docker client is not available
    expect(vscodeStub.window.lastInfoMessage).to.include(NO_PORTS_MSG);
  });
});

describe('openBrowser() - port selection', () => {
  setupOpenBrowserTests();

  it('returns when user cancels quick pick', async () => {
    const Docker = dockerodeStub.default;
    const client = new Docker();
    extensionStub.setDockerClient(client);

    dockerodeStub.setContainer(TEST_CONTAINER_ID, {
      running: true,
      paused: false,
      name: TEST_CONTAINER_NAME,
      ports: {
        '80/tcp': [{ HostPort: '8080' }],
        '443/tcp': [{ HostPort: '8443' }]
      }
    });

    vscodeStub.window.quickPickResult = undefined;

    const node = {
      name: TEST_CONTAINER_NAME,
      cID: TEST_CONTAINER_ID
    };

    await openBrowser(node);

    // Should not show success message since user cancelled
    expect(vscodeStub.window.lastInfoMessage).to.not.include('Opening port');
  });
});

// -----------------------------------------------------------------------------
// Single Port Tests
// -----------------------------------------------------------------------------

describe('openBrowser() - single port', () => {
  setupOpenBrowserTests();

  it('opens browser directly when only one port is exposed', async () => {
    const Docker = dockerodeStub.default;
    const client = new Docker();
    extensionStub.setDockerClient(client);

    dockerodeStub.setContainer(TEST_CONTAINER_ID, {
      running: true,
      paused: false,
      name: TEST_CONTAINER_NAME,
      ports: {
        '80/tcp': [{ HostPort: '8080' }]
      }
    });

    const node = {
      name: TEST_CONTAINER_NAME,
      cID: TEST_CONTAINER_ID
    };

    await openBrowser(node);

    expect(vscodeStub.window.lastInfoMessage).to.include('Opening port 8080');
    expect(vscodeStub.env.lastOpenedUrl).to.not.be.undefined;
  });

  it('opens HTTPS port directly', async () => {
    const Docker = dockerodeStub.default;
    const client = new Docker();
    extensionStub.setDockerClient(client);

    dockerodeStub.setContainer(TEST_CONTAINER_ID, {
      running: true,
      paused: false,
      name: TEST_CONTAINER_NAME,
      ports: {
        '443/tcp': [{ HostPort: '8443' }]
      }
    });

    const node = {
      name: TEST_CONTAINER_NAME,
      cID: TEST_CONTAINER_ID
    };

    await openBrowser(node);

    expect(vscodeStub.window.lastInfoMessage).to.include('Opening port 8443');
  });
});

// -----------------------------------------------------------------------------
// Port Description Tests
// -----------------------------------------------------------------------------

describe('openBrowser() - port descriptions', () => {
  setupOpenBrowserTests();

  it('shows HTTP description for port 80', async () => {
    const Docker = dockerodeStub.default;
    const client = new Docker();
    extensionStub.setDockerClient(client);

    dockerodeStub.setContainer(TEST_CONTAINER_ID, {
      running: true,
      paused: false,
      name: TEST_CONTAINER_NAME,
      ports: {
        '80/tcp': [{ HostPort: '80' }]
      }
    });

    const node = {
      name: TEST_CONTAINER_NAME,
      cID: TEST_CONTAINER_ID
    };

    await openBrowser(node);

    expect(vscodeStub.window.lastInfoMessage).to.include('HTTP');
  });

  it('shows Grafana description for port 3000', async () => {
    const Docker = dockerodeStub.default;
    const client = new Docker();
    extensionStub.setDockerClient(client);

    dockerodeStub.setContainer(TEST_CONTAINER_ID, {
      running: true,
      paused: false,
      name: TEST_CONTAINER_NAME,
      ports: {
        '3000/tcp': [{ HostPort: '3000' }]
      }
    });

    const node = {
      name: TEST_CONTAINER_NAME,
      cID: TEST_CONTAINER_ID
    };

    await openBrowser(node);

    expect(vscodeStub.window.lastInfoMessage).to.include('Grafana');
  });

  it('shows HTTPS description for port 443', async () => {
    const Docker = dockerodeStub.default;
    const client = new Docker();
    extensionStub.setDockerClient(client);

    dockerodeStub.setContainer(TEST_CONTAINER_ID, {
      running: true,
      paused: false,
      name: TEST_CONTAINER_NAME,
      ports: {
        '443/tcp': [{ HostPort: '443' }]
      }
    });

    const node = {
      name: TEST_CONTAINER_NAME,
      cID: TEST_CONTAINER_ID
    };

    await openBrowser(node);

    expect(vscodeStub.window.lastInfoMessage).to.include('HTTPS');
  });
});

// -----------------------------------------------------------------------------
// Port Parsing Edge Cases
// -----------------------------------------------------------------------------

describe('openBrowser() - port parsing', () => {
  setupOpenBrowserTests();

  it('handles UDP protocol ports', async () => {
    const Docker = dockerodeStub.default;
    const client = new Docker();
    extensionStub.setDockerClient(client);

    dockerodeStub.setContainer(TEST_CONTAINER_ID, {
      running: true,
      paused: false,
      name: TEST_CONTAINER_NAME,
      ports: {
        '53/udp': [{ HostPort: '5353' }]
      }
    });

    const node = {
      name: TEST_CONTAINER_NAME,
      cID: TEST_CONTAINER_ID
    };

    await openBrowser(node);

    expect(vscodeStub.window.lastInfoMessage).to.include('Opening port 5353');
  });

  it('skips ports with no host binding', async () => {
    const Docker = dockerodeStub.default;
    const client = new Docker();
    extensionStub.setDockerClient(client);

    dockerodeStub.setContainer(TEST_CONTAINER_ID, {
      running: true,
      paused: false,
      name: TEST_CONTAINER_NAME,
      ports: {
        '80/tcp': undefined
      }
    });

    const node = {
      name: TEST_CONTAINER_NAME,
      cID: TEST_CONTAINER_ID
    };

    await openBrowser(node);

    expect(vscodeStub.window.lastInfoMessage).to.include(NO_PORTS_MSG);
  });

  it('skips ports with empty binding array', async () => {
    const Docker = dockerodeStub.default;
    const client = new Docker();
    extensionStub.setDockerClient(client);

    dockerodeStub.setContainer(TEST_CONTAINER_ID, {
      running: true,
      paused: false,
      name: TEST_CONTAINER_NAME,
      ports: {
        '80/tcp': []
      }
    });

    const node = {
      name: TEST_CONTAINER_NAME,
      cID: TEST_CONTAINER_ID
    };

    await openBrowser(node);

    expect(vscodeStub.window.lastInfoMessage).to.include(NO_PORTS_MSG);
  });

  it('handles malformed port string gracefully', async () => {
    const Docker = dockerodeStub.default;
    const client = new Docker();
    extensionStub.setDockerClient(client);

    dockerodeStub.setContainer(TEST_CONTAINER_ID, {
      running: true,
      paused: false,
      name: TEST_CONTAINER_NAME,
      ports: {
        'invalid': [{ HostPort: '8080' }]
      }
    });

    const node = {
      name: TEST_CONTAINER_NAME,
      cID: TEST_CONTAINER_ID
    };

    await openBrowser(node);

    expect(vscodeStub.window.lastInfoMessage).to.include(NO_PORTS_MSG);
  });

  it('deduplicates ports mapped to same host port', async () => {
    const Docker = dockerodeStub.default;
    const client = new Docker();
    extensionStub.setDockerClient(client);

    // Same host port mapped to different container ports
    dockerodeStub.setContainer(TEST_CONTAINER_ID, {
      running: true,
      paused: false,
      name: TEST_CONTAINER_NAME,
      ports: {
        '80/tcp': [{ HostPort: '8080' }],
        '8080/tcp': [{ HostPort: '8080' }]
      }
    });

    const node = {
      name: TEST_CONTAINER_NAME,
      cID: TEST_CONTAINER_ID
    };

    await openBrowser(node);

    // Should only get one port since they map to same host port
    expect(vscodeStub.window.lastInfoMessage).to.include('Opening port 8080');
  });
});
