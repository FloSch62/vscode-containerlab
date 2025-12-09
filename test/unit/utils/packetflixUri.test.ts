/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, afterEach, __dirname, global */
/**
 * Tests for packetflix URI generation with mocked fetch.
 * This allows testing the genPacketflixURI function when Edgeshark appears to be running.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';
import * as sinon from 'sinon';

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
  if (request.includes('edgeshark') && !request.includes('stub') && !request.includes('.test')) {
    return path.join(__dirname, '..', '..', 'helpers', 'edgeshark-stub.js');
  }
  if ((request.endsWith('/utils') || request.endsWith('./utils')) && !request.includes('stub') && !request.includes('.test') && !request.includes('packetflix')) {
    return path.join(__dirname, '..', '..', 'helpers', 'utils-stub.js');
  }
  return null;
}

// Test node interface mock
function createMockInterfaceNode(name: string, parentName: string) {
  return {
    name,
    parentName,
    label: name,
    netns: 4026532270,
  };
}

let packetflixModule: any;
let vscodeStub: any;
let fetchStub: sinon.SinonStub;

describe('genPacketflixURI() - with mocked Edgeshark', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    // Mock fetch to make Edgeshark appear running
    fetchStub = sinon.stub(global, 'fetch');
    fetchStub.resolves({ ok: true } as Response);
    clearModuleCache();
    packetflixModule = require('../../../src/utils/packetflix');
  });

  afterEach(() => {
    fetchStub.restore();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('generates URI for single interface', async () => {
    const node = createMockInterfaceNode('eth0', 'container1');
    const result = await packetflixModule.genPacketflixURI([node]);

    expect(result).to.be.an('array');
    expect(result).to.have.length(2);
    const [uri, hostname] = result;
    expect(uri).to.include('packetflix:ws://');
    expect(uri).to.include('eth0');
    expect(uri).to.include('container1');
    expect(hostname).to.be.a('string');
  });

  it('includes port from configuration', async () => {
    vscodeStub.setConfigValue('containerlab.capture.packetflixPort', 5001);
    const node = createMockInterfaceNode('eth1', 'mycontainer');
    const result = await packetflixModule.genPacketflixURI([node]);

    expect(result).to.be.an('array');
    const [uri] = result;
    expect(uri).to.include('5001');
  });

  it('generates URI for multiple interfaces', async () => {
    const nodes = [
      createMockInterfaceNode('eth0', 'container1'),
      createMockInterfaceNode('eth1', 'container1'),
    ];
    const result = await packetflixModule.genPacketflixURI(nodes);

    expect(result).to.be.an('array');
    expect(result).to.have.length(2);
    const [uri] = result;
    expect(uri).to.include('eth0');
    expect(uri).to.include('eth1');
  });

  it('returns valid URI array when capture succeeds', async () => {
    const node = createMockInterfaceNode('eth0', 'container1');
    const result = await packetflixModule.genPacketflixURI([node]);

    expect(result).to.be.an('array');
    expect(result.length).to.equal(2);
    // URI and hostname are returned
    expect(result[0]).to.include('packetflix');
    expect(result[1]).to.be.a('string');
  });
});

describe('genPacketflixURI() - for VNC mode', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    fetchStub = sinon.stub(global, 'fetch');
    fetchStub.resolves({ ok: true } as Response);
    clearModuleCache();
    packetflixModule = require('../../../src/utils/packetflix');
  });

  afterEach(() => {
    fetchStub.restore();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('uses 127.0.0.1 for VNC mode', async () => {
    const node = createMockInterfaceNode('eth0', 'container1');
    const result = await packetflixModule.genPacketflixURI([node], true);

    expect(result).to.be.an('array');
    const [, hostname] = result;
    expect(hostname).to.equal('127.0.0.1');
  });
});

describe('genPacketflixURI() - Edgeshark not available', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    // Mock fetch to throw (Edgeshark not running)
    fetchStub = sinon.stub(global, 'fetch');
    fetchStub.rejects(new Error('Connection refused'));
    clearModuleCache();
    packetflixModule = require('../../../src/utils/packetflix');
  });

  afterEach(() => {
    fetchStub.restore();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('prompts user to start Edgeshark when not running', async () => {
    const node = createMockInterfaceNode('eth0', 'container1');
    // User declines to start Edgeshark
    const result = await packetflixModule.genPacketflixURI([node]);

    // When user doesn't accept to start Edgeshark, result should be undefined
    expect(result).to.be.undefined;
  });

  it('returns undefined when user declines to start Edgeshark', async () => {
    const node = createMockInterfaceNode('eth0', 'container1');
    const result = await packetflixModule.genPacketflixURI([node]);

    expect(result).to.be.undefined;
  });
});
