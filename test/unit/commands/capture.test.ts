/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for the capture commands (captureInterface, killAllWiresharkVNCCtrs).
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
  if (request.includes('utils/index') || request.endsWith('/utils')) {
    return path.join(__dirname, '..', '..', 'helpers', 'utils-stub.js');
  }
  if (request.includes('packetflix')) {
    return path.join(__dirname, '..', '..', 'helpers', 'packetflix-stub.js');
  }
  return null;
}

// Shared context
let captureInterface: Function;
let killAllWiresharkVNCCtrs: Function;
let vscodeStub: any;
let extensionStub: any;
let dockerodeStub: any;
let utilsStub: any;
let packetflixStub: any;

// Table-driven test cases
interface CaptureInterfaceTestCase {
  description: string;
  node: any;
  expectedError?: string;
}

const captureInterfaceErrorCases: CaptureInterfaceTestCase[] = [
  {
    description: 'shows error when node is undefined',
    node: undefined,
    expectedError: 'No interface to capture found.'
  },
  {
    description: 'shows error when node is null',
    node: null,
    expectedError: 'No interface to capture found.'
  }
];

function setupCaptureTests() {
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
    captureInterface = captureModule.captureInterface;
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
}

describe('captureInterface() - error handling', () => {
  setupCaptureTests();

  captureInterfaceErrorCases.forEach(({ description, node, expectedError }) => {
    it(description, async () => {
      await captureInterface(node);
      expect(vscodeStub.window.lastErrorMessage).to.equal(expectedError);
    });
  });
});

describe('captureInterface() - routing based on preference', () => {
  setupCaptureTests();

  it('processes valid interface node without error', async () => {
    const node = {
      parentName: 'router1',
      name: 'eth0',
      cID: 'container123'
    };

    // Set up docker client so captureEdgesharkVNC can work
    const Docker = dockerodeStub.default;
    extensionStub.setDockerClient(new Docker());

    // Set packetflix result
    packetflixStub.setGenPacketflixURIResult(['packetflix:ws://localhost:5001/capture', 'localhost']);

    await captureInterface(node);

    // Should not show error message
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });
});

describe('killAllWiresharkVNCCtrs() - container removal', () => {
  setupCaptureTests();

  it('removes containers matching prefix and image', async () => {
    const Docker = dockerodeStub.default;
    const client = new Docker();
    extensionStub.setDockerClient(client);

    // Add a container that matches
    dockerodeStub.addListContainer({
      Id: 'wireshark-vnc-123',
      Names: ['/clab-wireshark-vnc-testuser-router1_eth0-12345'],
      Image: 'ghcr.io/srl-labs/clab-wireshark-vnc:latest'
    });
    dockerodeStub.setContainer('wireshark-vnc-123', {
      running: true,
      paused: false,
      name: 'clab-wireshark-vnc-testuser-router1_eth0-12345'
    });

    await killAllWiresharkVNCCtrs();

    // Should not show error
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('handles no docker client gracefully', async () => {
    extensionStub.setDockerClient(undefined);

    // Should not throw - but will show an error message since docker is unavailable
    await killAllWiresharkVNCCtrs();
    // The error message is expected when docker client is undefined
    expect(vscodeStub.window.lastErrorMessage).to.include('Failed to remove Wireshark VNC');
  });

  it('handles empty container list', async () => {
    const Docker = dockerodeStub.default;
    extensionStub.setDockerClient(new Docker());

    // No containers added
    await killAllWiresharkVNCCtrs();

    // Should not show error
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });
});
