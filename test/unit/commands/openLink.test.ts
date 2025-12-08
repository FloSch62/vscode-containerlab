/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, afterEach, __dirname */
/**
 * Tests for the openLink utility function which opens external URLs.
 */
import { expect } from 'chai';
import sinon from 'sinon';
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
  if (request === 'vscode') return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  return null;
}

let openLink: Function;
let vscodeStub: any;

const TEST_URL_HTTPS = 'https://example.com';

function setupOpenLinkTests() {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    const openLinkModule = require('../../../src/commands/openLink');
    openLink = openLinkModule.openLink;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.env.lastOpenedUrl = undefined;
    sinon.spy(vscodeStub.env, 'openExternal');
    sinon.spy(vscodeStub.Uri, 'parse');
  });

  afterEach(() => {
    sinon.restore();
  });
}

describe('openLink - basic URL handling', () => {
  setupOpenLinkTests();

  it('opens an HTTPS URL correctly', () => {
    openLink(TEST_URL_HTTPS);

    const parseSpy = vscodeStub.Uri.parse as sinon.SinonSpy;
    const openSpy = vscodeStub.env.openExternal as sinon.SinonSpy;

    expect(parseSpy.calledOnceWith(TEST_URL_HTTPS)).to.be.true;
    expect(openSpy.calledOnce).to.be.true;
    expect(vscodeStub.env.lastOpenedUrl.fsPath).to.equal(TEST_URL_HTTPS);
  });

  it('opens an HTTP URL correctly', () => {
    const url = 'http://example.com';
    openLink(url);

    const parseSpy = vscodeStub.Uri.parse as sinon.SinonSpy;
    const openSpy = vscodeStub.env.openExternal as sinon.SinonSpy;

    expect(parseSpy.calledOnceWith(url)).to.be.true;
    expect(openSpy.calledOnce).to.be.true;
  });

  it('opens a URL with path correctly', () => {
    const url = 'https://github.com/srl-labs/containerlab';
    openLink(url);

    const parseSpy = vscodeStub.Uri.parse as sinon.SinonSpy;
    expect(parseSpy.calledOnceWith(url)).to.be.true;
  });
});

describe('openLink - complex URLs', () => {
  setupOpenLinkTests();

  it('opens a URL with query parameters correctly', () => {
    const url = 'https://example.com/search?q=containerlab&page=1';
    openLink(url);
    expect((vscodeStub.Uri.parse as sinon.SinonSpy).calledOnceWith(url)).to.be.true;
  });

  it('opens a URL with anchor correctly', () => {
    const url = 'https://example.com/docs#installation';
    openLink(url);
    expect((vscodeStub.Uri.parse as sinon.SinonSpy).calledOnceWith(url)).to.be.true;
  });

  it('opens a URL with port number correctly', () => {
    const url = 'http://localhost:8080';
    openLink(url);
    expect((vscodeStub.Uri.parse as sinon.SinonSpy).calledOnceWith(url)).to.be.true;
  });

  it('opens a complex URL with all components correctly', () => {
    const url = 'https://user:pass@example.com:8443/path/to/resource?param1=value1#section';
    openLink(url);
    expect((vscodeStub.Uri.parse as sinon.SinonSpy).calledOnceWith(url)).to.be.true;
  });

  it('calls Uri.parse before env.openExternal', () => {
    openLink(TEST_URL_HTTPS);
    const parseSpy = vscodeStub.Uri.parse as sinon.SinonSpy;
    const openSpy = vscodeStub.env.openExternal as sinon.SinonSpy;
    expect(parseSpy.calledBefore(openSpy)).to.be.true;
  });

  it('passes the parsed URI to openExternal', () => {
    openLink(TEST_URL_HTTPS);
    const parseSpy = vscodeStub.Uri.parse as sinon.SinonSpy;
    const openSpy = vscodeStub.env.openExternal as sinon.SinonSpy;
    const parsedUri = parseSpy.returnValues[0];
    expect(openSpy.calledOnceWith(parsedUri)).to.be.true;
  });
});
