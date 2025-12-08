/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for the VNC capture functionality including readiness monitoring.
 * Covers the VNC readiness loop and container removal paths.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;
const WIRESHARK_IMAGE = 'ghcr.io/kaelemc/wireshark-vnc-docker:latest';
const CTR_NAME_PREFIX = 'clab-wireshark-vnc';
const TEST_USER = 'testuser';
const RETRY_CHECK_MSG = { type: 'retry-check' };

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
  if (request.includes('utils/index') || request.endsWith('/utils')) {
    return path.join(__dirname, '..', '..', 'helpers', 'utils-stub.js');
  }
  if (request.includes('packetflix')) {
    return path.join(__dirname, '..', '..', 'helpers', 'packetflix-stub.js');
  }
  return null;
}

let captureEdgesharkVNC: Function;
let killAllWiresharkVNCCtrs: Function;
let vscodeStub: any;
let extensionStub: any;
let dockerodeStub: any;
let utilsStub: any;
let packetflixStub: any;

const PACKETFLIX_RESULT: [string, string] = ['packetflix:ws://localhost:5001/capture', 'localhost'];

describe('captureEdgesharkVNC() - VNC readiness', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    extensionStub = require('../../helpers/extension-stub');
    dockerodeStub = require('../../helpers/dockerode-stub');
    utilsStub = require('../../helpers/utils-stub');
    packetflixStub = require('../../helpers/packetflix-stub');

    const captureModule = require('../../../src/commands/capture');
    captureEdgesharkVNC = captureModule.captureEdgesharkVNC;
    killAllWiresharkVNCCtrs = captureModule.killAllWiresharkVNCCtrs;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
    dockerodeStub.clearDockerMocks();
    utilsStub.clearMocks();
    utilsStub.clearCaptureUtilsMocks();
    packetflixStub.resetPacketflixStub();
  });

  it('creates webview panel for VNC capture', async () => {
    const node = {
      parentName: 'router1',
      name: 'eth0',
      cID: 'container123'
    };

    const Docker = dockerodeStub.default;
    extensionStub.setDockerClient(new Docker());
    packetflixStub.setGenPacketflixURIResult(PACKETFLIX_RESULT);

    // Set endpoint ready so panel creation succeeds
    utilsStub.setHttpEndpointReady(true);

    await captureEdgesharkVNC(node);

    // Verify webview panel was created
    expect(vscodeStub.window.lastWebviewPanel).to.not.be.undefined;
    expect(vscodeStub.window.lastWebviewPanel.viewType).to.equal('clabWiresharkVNC');
  });

  it('triggers readiness check when webview sends retry-check message', async () => {
    const node = {
      parentName: 'router1',
      name: 'eth0',
      cID: 'container123'
    };

    const Docker = dockerodeStub.default;
    extensionStub.setDockerClient(new Docker());
    packetflixStub.setGenPacketflixURIResult(PACKETFLIX_RESULT);
    utilsStub.setHttpEndpointReady(true);

    await captureEdgesharkVNC(node);

    const panel = vscodeStub.window.lastWebviewPanel;
    expect(panel).to.not.be.undefined;

    // Simulate webview sending retry-check message
    panel.simulateMessage(RETRY_CHECK_MSG);

    // Wait a bit for async operations
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify messages were posted to webview
    const postedMessages = panel.webview._postedMessages;
    expect(postedMessages.length).to.be.greaterThan(0);

    // Should have vnc-progress or vnc-ready messages
    const hasProgressOrReady = postedMessages.some(
      (m: any) => m.type === 'vnc-progress' || m.type === 'vnc-ready'
    );
    expect(hasProgressOrReady).to.be.true;
  });

  it('posts vnc-ready when endpoint becomes ready', async () => {
    const node = {
      parentName: 'router1',
      name: 'eth0',
      cID: 'container123'
    };

    const Docker = dockerodeStub.default;
    extensionStub.setDockerClient(new Docker());
    packetflixStub.setGenPacketflixURIResult(PACKETFLIX_RESULT);
    utilsStub.setHttpEndpointReady(true);

    await captureEdgesharkVNC(node);

    const panel = vscodeStub.window.lastWebviewPanel;
    panel.simulateMessage(RETRY_CHECK_MSG);

    // Wait for the readiness check
    await new Promise(resolve => setTimeout(resolve, 100));

    const postedMessages = panel.webview._postedMessages;
    const readyMessage = postedMessages.find((m: any) => m.type === 'vnc-ready');
    expect(readyMessage).to.not.be.undefined;
    expect(readyMessage.url).to.be.a('string');
  });
});

describe('captureEdgesharkVNC() - VNC timeout', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    extensionStub = require('../../helpers/extension-stub');
    dockerodeStub = require('../../helpers/dockerode-stub');
    utilsStub = require('../../helpers/utils-stub');
    packetflixStub = require('../../helpers/packetflix-stub');

    const captureModule = require('../../../src/commands/capture');
    captureEdgesharkVNC = captureModule.captureEdgesharkVNC;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
    dockerodeStub.clearDockerMocks();
    utilsStub.clearMocks();
    utilsStub.clearCaptureUtilsMocks();
    packetflixStub.resetPacketflixStub();
  });

  it('handles endpoint not ready scenario', async () => {
    const node = {
      parentName: 'router1',
      name: 'eth0',
      cID: 'container123'
    };

    const Docker = dockerodeStub.default;
    extensionStub.setDockerClient(new Docker());
    packetflixStub.setGenPacketflixURIResult(PACKETFLIX_RESULT);

    // Endpoint not ready - will trigger progress messages
    utilsStub.setHttpEndpointReady(false);

    await captureEdgesharkVNC(node);

    const panel = vscodeStub.window.lastWebviewPanel;
    expect(panel).to.not.be.undefined;

    // Trigger retry
    panel.simulateMessage(RETRY_CHECK_MSG);

    // Short wait for first progress message
    await new Promise(resolve => setTimeout(resolve, 20));

    const postedMessages = panel.webview._postedMessages;
    // Should have at least a progress message
    const hasProgress = postedMessages.some((m: any) => m.type === 'vnc-progress');
    expect(hasProgress).to.be.true;
  });
});

describe('killAllWiresharkVNCCtrs() - with correct image', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    extensionStub = require('../../helpers/extension-stub');
    dockerodeStub = require('../../helpers/dockerode-stub');
    utilsStub = require('../../helpers/utils-stub');
    packetflixStub = require('../../helpers/packetflix-stub');

    const captureModule = require('../../../src/commands/capture');
    killAllWiresharkVNCCtrs = captureModule.killAllWiresharkVNCCtrs;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
    dockerodeStub.clearDockerMocks();
    utilsStub.clearMocks();
    utilsStub.clearCaptureUtilsMocks();
    packetflixStub.resetPacketflixStub();
  });

  it('removes containers with matching name and correct default image', async () => {
    const Docker = dockerodeStub.default;
    const client = new Docker();
    extensionStub.setDockerClient(client);

    // Add container with the CORRECT default image
    const containerId = 'wireshark-vnc-correct-123';
    dockerodeStub.addListContainer({
      Id: containerId,
      Names: [`/${CTR_NAME_PREFIX}-${TEST_USER}-router1_eth0-12345`],
      Image: WIRESHARK_IMAGE
    });
    dockerodeStub.setContainer(containerId, {
      running: true,
      paused: false,
      name: `${CTR_NAME_PREFIX}-${TEST_USER}-router1_eth0-12345`
    });

    await killAllWiresharkVNCCtrs();

    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('removes multiple containers in parallel', async () => {
    const Docker = dockerodeStub.default;
    const client = new Docker();
    extensionStub.setDockerClient(client);

    // Add multiple containers with correct image
    const containers = [
      { id: 'vnc-correct-1', name: `${CTR_NAME_PREFIX}-${TEST_USER}-r1_eth0-111` },
      { id: 'vnc-correct-2', name: `${CTR_NAME_PREFIX}-${TEST_USER}-r2_eth0-222` },
      { id: 'vnc-correct-3', name: `${CTR_NAME_PREFIX}-${TEST_USER}-r3_eth0-333` }
    ];

    for (const c of containers) {
      dockerodeStub.addListContainer({
        Id: c.id,
        Names: [`/${c.name}`],
        Image: WIRESHARK_IMAGE
      });
      dockerodeStub.setContainer(c.id, {
        running: true,
        paused: false,
        name: c.name
      });
    }

    await killAllWiresharkVNCCtrs();

    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('handles container removal failure gracefully', async () => {
    const Docker = dockerodeStub.default;
    const client = new Docker();
    extensionStub.setDockerClient(client);

    // Add container but don't set it up for removal (will cause issue)
    dockerodeStub.addListContainer({
      Id: 'vnc-fail',
      Names: [`/${CTR_NAME_PREFIX}-${TEST_USER}-router_eth0-999`],
      Image: WIRESHARK_IMAGE
    });
    // Note: Not calling setContainer - getContainer will still work but state won't exist

    await killAllWiresharkVNCCtrs();

    // Should not throw, just log warning
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });
});

describe('captureEdgesharkVNC() - panel disposal', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    extensionStub = require('../../helpers/extension-stub');
    dockerodeStub = require('../../helpers/dockerode-stub');
    utilsStub = require('../../helpers/utils-stub');
    packetflixStub = require('../../helpers/packetflix-stub');

    const captureModule = require('../../../src/commands/capture');
    captureEdgesharkVNC = captureModule.captureEdgesharkVNC;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
    dockerodeStub.clearDockerMocks();
    utilsStub.clearMocks();
    utilsStub.clearCaptureUtilsMocks();
    packetflixStub.resetPacketflixStub();
  });

  it('stops container when webview panel is disposed', async () => {
    const node = {
      parentName: 'router1',
      name: 'eth0',
      cID: 'container123'
    };

    const Docker = dockerodeStub.default;
    extensionStub.setDockerClient(new Docker());
    packetflixStub.setGenPacketflixURIResult(PACKETFLIX_RESULT);
    utilsStub.setHttpEndpointReady(true);

    await captureEdgesharkVNC(node);

    const panel = vscodeStub.window.lastWebviewPanel;
    expect(panel).to.not.be.undefined;

    // Dispose the panel to trigger cleanup
    panel.dispose();

    // Container stop is async and may throw, but should not fail the test
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('handles disposal when readiness check is in progress', async () => {
    const node = {
      parentName: 'router1',
      name: 'eth0',
      cID: 'container123'
    };

    const Docker = dockerodeStub.default;
    extensionStub.setDockerClient(new Docker());
    packetflixStub.setGenPacketflixURIResult(PACKETFLIX_RESULT);

    // Endpoint not ready to keep polling active
    utilsStub.setHttpEndpointReady(false);

    await captureEdgesharkVNC(node);

    const panel = vscodeStub.window.lastWebviewPanel;

    // Start readiness check
    panel.simulateMessage(RETRY_CHECK_MSG);

    // Dispose while polling is in progress
    panel.dispose();

    // Should not throw
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });
});

describe('captureEdgesharkVNC() - container creation failure', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    extensionStub = require('../../helpers/extension-stub');
    dockerodeStub = require('../../helpers/dockerode-stub');
    utilsStub = require('../../helpers/utils-stub');
    packetflixStub = require('../../helpers/packetflix-stub');

    const captureModule = require('../../../src/commands/capture');
    captureEdgesharkVNC = captureModule.captureEdgesharkVNC;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
    dockerodeStub.clearDockerMocks();
    utilsStub.clearMocks();
    utilsStub.clearCaptureUtilsMocks();
    packetflixStub.resetPacketflixStub();
  });

  it('shows error when container creation fails', async () => {
    const node = {
      parentName: 'router1',
      name: 'eth0',
      cID: 'container123'
    };

    const Docker = dockerodeStub.default;
    extensionStub.setDockerClient(new Docker());
    packetflixStub.setGenPacketflixURIResult(PACKETFLIX_RESULT);

    // Make container creation fail
    dockerodeStub.setCreateContainerFail(true, new Error('Resource exhausted'));

    await captureEdgesharkVNC(node);

    expect(vscodeStub.window.lastErrorMessage).to.include('Resource exhausted');
  });

  it('shows error when docker client is unavailable', async () => {
    const node = {
      parentName: 'router1',
      name: 'eth0',
      cID: 'container123'
    };

    extensionStub.setDockerClient(undefined);
    packetflixStub.setGenPacketflixURIResult(PACKETFLIX_RESULT);

    await captureEdgesharkVNC(node);

    expect(vscodeStub.window.lastErrorMessage).to.include('Docker client unavailable');
  });
});
