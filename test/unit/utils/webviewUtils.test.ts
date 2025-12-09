/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach, after, __dirname */

import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import Module from 'module';

// Clear require cache for modules we need to stub BEFORE setting up resolution
Object.keys(require.cache).forEach(key => {
  if (key.includes('webview') || key.includes('vscode-stub')) {
    delete require.cache[key];
  }
});

const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

// Import stubs and module under test
import * as vscode from '../../helpers/vscode-stub';

const webviewUtilsModule = require('../../../src/utils/webview') as typeof import('../../../src/utils/webview');
const { tryPostMessage, isHttpEndpointReady } = webviewUtilsModule;

after(() => {
  (Module as any)._resolveFilename = originalResolve;
});

// Test constants
const TEST_URL = 'http://localhost:5001/test';
const TEST_MESSAGE = { type: 'test', data: 'hello' };

describe('webview utils - tryPostMessage', () => {
  let mockPanel: any;
  let postedMessages: any[];

  beforeEach(() => {
    vscode.resetVscodeStub();
    postedMessages = [];
    mockPanel = {
      webview: {
        postMessage: async (message: any) => {
          postedMessages.push(message);
          return true;
        }
      }
    };
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('posts message to webview panel', async () => {
    await tryPostMessage(mockPanel, TEST_MESSAGE);

    expect(postedMessages).to.have.length(1);
    expect(postedMessages[0]).to.deep.equal(TEST_MESSAGE);
  });

  it('handles string message', async () => {
    const stringMessage = 'simple string message';
    await tryPostMessage(mockPanel, stringMessage);

    expect(postedMessages).to.have.length(1);
    expect(postedMessages[0]).to.equal(stringMessage);
  });

  it('handles null message', async () => {
    await tryPostMessage(mockPanel, null);

    expect(postedMessages).to.have.length(1);
    expect(postedMessages[0]).to.be.null;
  });

  it('ignores errors when panel is disposed', async () => {
    const disposedPanel = {
      webview: {
        postMessage: async () => {
          throw new Error('Panel disposed');
        }
      }
    } as any;

    // Should not throw - verify by checking completion
    const result = await tryPostMessage(disposedPanel, TEST_MESSAGE);
    expect(result).to.be.undefined;
  });

  it('resolves even when postMessage rejects', async () => {
    const rejectingPanel = {
      webview: {
        postMessage: async () => {
          return Promise.reject(new Error('Webview unavailable'));
        }
      }
    } as any;

    // Should not throw and should complete
    const result = await tryPostMessage(rejectingPanel, TEST_MESSAGE);
    expect(result).to.be.undefined;
  });
});

describe('webview utils - isHttpEndpointReady success cases', () => {
  let fetchStub: sinon.SinonStub;

  beforeEach(() => {
    fetchStub = sinon.stub(globalThis, 'fetch');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns true when endpoint returns 200', async () => {
    fetchStub.resolves({ ok: true } as Response);

    const result = await isHttpEndpointReady(TEST_URL);

    expect(result).to.be.true;
    expect(fetchStub.calledOnce).to.be.true;
    expect(fetchStub.firstCall.args[0]).to.equal(TEST_URL);
  });

  it('returns true for any 2xx status', async () => {
    fetchStub.resolves({ ok: true, status: 201 } as Response);

    const result = await isHttpEndpointReady(TEST_URL);

    expect(result).to.be.true;
  });
});

describe('webview utils - isHttpEndpointReady failure cases', () => {
  let fetchStub: sinon.SinonStub;

  beforeEach(() => {
    fetchStub = sinon.stub(globalThis, 'fetch');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns false when endpoint returns 404', async () => {
    fetchStub.resolves({ ok: false, status: 404 } as Response);

    const result = await isHttpEndpointReady(TEST_URL);

    expect(result).to.be.false;
  });

  it('returns false when endpoint returns 500', async () => {
    fetchStub.resolves({ ok: false, status: 500 } as Response);

    const result = await isHttpEndpointReady(TEST_URL);

    expect(result).to.be.false;
  });

  it('returns false when fetch throws network error', async () => {
    fetchStub.rejects(new Error('Network error'));

    const result = await isHttpEndpointReady(TEST_URL);

    expect(result).to.be.false;
  });

  it('returns false when connection is refused', async () => {
    fetchStub.rejects(new Error('ECONNREFUSED'));

    const result = await isHttpEndpointReady(TEST_URL);

    expect(result).to.be.false;
  });
});

describe('webview utils - isHttpEndpointReady accepts timeout parameter', () => {
  let fetchStub: sinon.SinonStub;

  beforeEach(() => {
    fetchStub = sinon.stub(globalThis, 'fetch');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('accepts a custom timeout parameter', async () => {
    // Test that the function accepts the parameter and works with immediate response
    fetchStub.resolves({ ok: true } as Response);

    const result = await isHttpEndpointReady(TEST_URL, 1000);
    expect(result).to.be.true;
    expect(fetchStub.calledOnce).to.be.true;
  });

  it('uses default timeout when not specified', async () => {
    fetchStub.resolves({ ok: true } as Response);

    const result = await isHttpEndpointReady(TEST_URL);
    expect(result).to.be.true;
    expect(fetchStub.calledOnce).to.be.true;
  });
});
