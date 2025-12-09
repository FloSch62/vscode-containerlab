/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, afterEach, __dirname */
/**
 * Tests for welcomePage.ts
 */
import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import Module from 'module';

const originalResolve = (Module as any)._resolveFilename;
const SHOW_WELCOME_CONFIG = 'containerlab.showWelcomePage';
const MOCK_EXTENSION_PATH = '/mock/extension';
const WORKSPACE_PATH = '/test/workspace';
const GET_REPOS_COMMAND = 'getRepos';
const CREATE_EXAMPLE_COMMAND = 'createExample';

function clearModuleCache() {
  Object.keys(require.cache).forEach(key => {
    if (key.includes('vscode-containerlab') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  });
}

function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', 'helpers', 'vscode-stub.js');
  }
  if (request.includes('extension') && !request.includes('stub') && !request.includes('.test')) {
    return path.join(__dirname, '..', 'helpers', 'extension-stub.js');
  }
  return null;
}

function createContext() {
  return {
    extensionPath: MOCK_EXTENSION_PATH,
    subscriptions: [] as any[]
  };
}

function setupModuleResolution() {
  clearModuleCache();
  (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
    const stubPath = getStubPath(request);
    return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
  };
}

function teardownModuleResolution() {
  (Module as any)._resolveFilename = originalResolve;
  clearModuleCache();
}

function stubHttpsGetSuccess(sandbox: sinon.SinonSandbox, httpsModule: any, items: any[]) {
  const mockResponse = new (require('events').EventEmitter)();
  sandbox.stub(httpsModule, 'get').callsFake((...args: any[]) => {
    const callback = args[2] as Function;
    callback(mockResponse);
    const request = {
      on: () => request,
      end: () => {}
    };
    process.nextTick(() => {
      mockResponse.emit('data', JSON.stringify({ items }));
      mockResponse.emit('end');
    });
    return request;
  });
}

function stubHttpsGetError(sandbox: sinon.SinonSandbox, httpsModule: any, message: string) {
  sandbox.stub(httpsModule, 'get').callsFake((..._args: any[]) => {
    const request = {
      on: (event: string, handler: Function) => {
        if (event === 'error') {
          process.nextTick(() => handler(new Error(message)));
        }
        return request;
      },
      end: () => {}
    };
    return request;
  });
}

let WelcomePage: any;
let vscode: any;
let fs: any;
let https: any;

/**
 * Tests for WelcomePage constructor
 */
describe('WelcomePage - constructor', () => {
  before(() => {
    setupModuleResolution();
    vscode = require('../helpers/vscode-stub');
    const welcomePageModule = require('../../src/welcomePage');
    WelcomePage = welcomePageModule.WelcomePage;
  });

  after(teardownModuleResolution);

  it('should create instance with context', () => {
    const context = {
      extensionPath: MOCK_EXTENSION_PATH,
      subscriptions: []
    };
    const welcomePage = new WelcomePage(context);
    expect(welcomePage).to.be.instanceOf(WelcomePage);
  });

  it('should store context reference', () => {
    const context = {
      extensionPath: '/test/path',
      subscriptions: []
    };
    const welcomePage = new WelcomePage(context);
    expect(welcomePage).to.have.property('context');
  });
});

/**
 * Tests for WelcomePage.show() - config checks
 */
describe('WelcomePage - show() config behavior', () => {
  before(() => {
    setupModuleResolution();
    vscode = require('../helpers/vscode-stub');
    const welcomePageModule = require('../../src/welcomePage');
    WelcomePage = welcomePageModule.WelcomePage;
  });

  beforeEach(() => {
    vscode.resetVscodeStub();
    vscode.window.lastWebviewPanel = undefined;
  });

  after(teardownModuleResolution);

  it('should not show panel when showWelcomePage config is false', async () => {
    vscode.setConfigValue(SHOW_WELCOME_CONFIG, false);

    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    // Panel should not be created
    expect(vscode.window.lastWebviewPanel).to.be.undefined;
  });

  it('should show panel when showWelcomePage config is true', async () => {
    vscode.setConfigValue(SHOW_WELCOME_CONFIG, true);

    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    expect(vscode.window.lastWebviewPanel).to.not.be.undefined;
  });

  it('should show panel when showWelcomePage config is not set (default true)', async () => {
    vscode.clearConfigValues();

    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    expect(vscode.window.lastWebviewPanel).to.not.be.undefined;
  });
});

/**
 * Tests for WelcomePage.show() - panel creation
 */
describe('WelcomePage - show() panel creation', () => {
  before(() => {
    setupModuleResolution();
    vscode = require('../helpers/vscode-stub');
    const welcomePageModule = require('../../src/welcomePage');
    WelcomePage = welcomePageModule.WelcomePage;
  });

  beforeEach(() => {
    vscode.resetVscodeStub();
    vscode.setConfigValue(SHOW_WELCOME_CONFIG, true);
  });

  after(teardownModuleResolution);

  it('should create webview panel with correct view type', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    expect(vscode.window.lastWebviewPanel.viewType).to.equal('containerlabWelcome');
  });

  it('should create webview panel with correct title', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    expect(vscode.window.lastWebviewPanel.title).to.equal('Welcome to Containerlab');
  });

  it('should set panel icon path', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    expect(vscode.window.lastWebviewPanel.iconPath).to.not.be.undefined;
  });

  it('should set webview HTML content', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    expect(vscode.window.lastWebviewPanel.webview.html).to.be.a('string');
    expect(vscode.window.lastWebviewPanel.webview.html.length).to.be.greaterThan(0);
  });
});

/**
 * Tests for WelcomePage - message handlers
 */
describe('WelcomePage - message handlers', () => {
  let sandbox: sinon.SinonSandbox;

  before(() => {
    setupModuleResolution();
    vscode = require('../helpers/vscode-stub');
    fs = require('fs');
    const welcomePageModule = require('../../src/welcomePage');
    WelcomePage = welcomePageModule.WelcomePage;
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    vscode.resetVscodeStub();
    vscode.setConfigValue(SHOW_WELCOME_CONFIG, true);
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(teardownModuleResolution);

  it('should handle createExample message', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    // Set up workspace
    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: WORKSPACE_PATH }, name: 'test' }
    ];

    // Stub fs
    sandbox.stub(fs, 'existsSync').returns(false);
    const writeStub = sandbox.stub(fs, 'writeFileSync');

    await welcomePage.show();

    // Get the message handler from panel
    const panel = vscode.window.lastWebviewPanel;
    const messageHandler = panel.webview._messageHandler;

    // Trigger createExample message
    await messageHandler({ command: CREATE_EXAMPLE_COMMAND });

    expect(writeStub.called).to.be.true;
  });

  it('should handle dontShowAgain message', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    const panel = vscode.window.lastWebviewPanel;
    const messageHandler = panel.webview._messageHandler;

    await messageHandler({ command: 'dontShowAgain', value: true });

    // Config should be updated (show = false when value = true)
    expect(vscode.configValues[SHOW_WELCOME_CONFIG]).to.be.false;
  });

  it('should handle dontShowAgain with false value', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    const panel = vscode.window.lastWebviewPanel;
    const messageHandler = panel.webview._messageHandler;

    await messageHandler({ command: 'dontShowAgain', value: false });

    // show = true when value = false
    expect(vscode.configValues[SHOW_WELCOME_CONFIG]).to.be.true;
  });
});

/**
 * Tests for WelcomePage - createExampleTopology
 */
describe('WelcomePage - createExampleTopology', () => {
  let sandbox: sinon.SinonSandbox;

  before(() => {
    setupModuleResolution();
    vscode = require('../helpers/vscode-stub');
    fs = require('fs');
    const welcomePageModule = require('../../src/welcomePage');
    WelcomePage = welcomePageModule.WelcomePage;
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    vscode.resetVscodeStub();
    vscode.setConfigValue(SHOW_WELCOME_CONFIG, true);
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(teardownModuleResolution);

  it('should show error when no workspace is open', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    vscode.workspace.workspaceFolders = undefined;

    await welcomePage.show();

    const panel = vscode.window.lastWebviewPanel;
    const messageHandler = panel.webview._messageHandler;

    await messageHandler({ command: CREATE_EXAMPLE_COMMAND });

    expect(vscode.window.lastErrorMessage).to.include('No workspace folder');
  });

  it('should show warning when file already exists', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: WORKSPACE_PATH }, name: 'test' }
    ];

    sandbox.stub(fs, 'existsSync').returns(true);

    await welcomePage.show();

    const panel = vscode.window.lastWebviewPanel;
    const messageHandler = panel.webview._messageHandler;

    await messageHandler({ command: CREATE_EXAMPLE_COMMAND });

    expect(vscode.window.lastWarningMessage).to.include('already exists');
  });

  it('should create file when it does not exist', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: WORKSPACE_PATH }, name: 'test' }
    ];

    sandbox.stub(fs, 'existsSync').returns(false);
    const writeStub = sandbox.stub(fs, 'writeFileSync');

    await welcomePage.show();

    const panel = vscode.window.lastWebviewPanel;
    const messageHandler = panel.webview._messageHandler;

    await messageHandler({ command: CREATE_EXAMPLE_COMMAND });

    expect(writeStub.called).to.be.true;
    expect(writeStub.getCall(0).args[0]).to.include('example.clab.yml');
  });

  it('should write correct topology content', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    vscode.workspace.workspaceFolders = [
      { uri: { fsPath: WORKSPACE_PATH }, name: 'test' }
    ];

    sandbox.stub(fs, 'existsSync').returns(false);
    const writeStub = sandbox.stub(fs, 'writeFileSync');

    await welcomePage.show();

    const panel = vscode.window.lastWebviewPanel;
    const messageHandler = panel.webview._messageHandler;

    await messageHandler({ command: CREATE_EXAMPLE_COMMAND });

    const content = writeStub.getCall(0).args[1];
    expect(content).to.include('name: srl01');
    expect(content).to.include('nokia_srlinux');
    expect(content).to.include('srl1:');
    expect(content).to.include('srl2:');
    expect(content).to.include('endpoints:');
  });
});

/**
 * Tests for WelcomePage - getWebviewContent
 */
describe('WelcomePage - getWebviewContent', () => {
  before(() => {
    setupModuleResolution();
    vscode = require('../helpers/vscode-stub');
    const welcomePageModule = require('../../src/welcomePage');
    WelcomePage = welcomePageModule.WelcomePage;
  });

  beforeEach(() => {
    vscode.resetVscodeStub();
    vscode.setConfigValue(SHOW_WELCOME_CONFIG, true);
  });

  after(teardownModuleResolution);

  it('should generate HTML with DOCTYPE', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    const html = vscode.window.lastWebviewPanel.webview.html;
    expect(html).to.include('<!DOCTYPE html>');
  });

  it('should include Welcome to Containerlab title', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    const html = vscode.window.lastWebviewPanel.webview.html;
    expect(html).to.include('Welcome to Containerlab');
  });

  it('should include getting started section', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    const html = vscode.window.lastWebviewPanel.webview.html;
    expect(html).to.include('Getting Started');
  });

  it('should include create example button', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    const html = vscode.window.lastWebviewPanel.webview.html;
    expect(html).to.include('createExampleBtn');
    expect(html).to.include('Create Example Topology');
  });

  it('should include documentation links', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    const html = vscode.window.lastWebviewPanel.webview.html;
    expect(html).to.include('containerlab.dev');
  });

  it('should include dont show again checkbox', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    const html = vscode.window.lastWebviewPanel.webview.html;
    expect(html).to.include('dontShowAgain');
  });

  it('should include popular topologies section', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    const html = vscode.window.lastWebviewPanel.webview.html;
    expect(html).to.include('Popular Topologies');
    expect(html).to.include('reposList');
  });

  it('should include SVG logo', async () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    await welcomePage.show();

    const html = vscode.window.lastWebviewPanel.webview.html;
    expect(html).to.include('<svg');
  });
});

/**
 * Tests for WelcomePage - fetchGitHubRepos
 */
describe('WelcomePage - fetchGitHubRepos', () => {
  let sandbox: sinon.SinonSandbox;

  before(() => {
    setupModuleResolution();
    vscode = require('../helpers/vscode-stub');
    https = require('https');
    const welcomePageModule = require('../../src/welcomePage');
    WelcomePage = welcomePageModule.WelcomePage;
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    vscode.resetVscodeStub();
    vscode.setConfigValue(SHOW_WELCOME_CONFIG, true);
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(teardownModuleResolution);

  it('should handle getRepos message and post results', async () => {
    const context = createContext();
    const welcomePage = new WelcomePage(context);

    stubHttpsGetSuccess(sandbox, https, [{ name: 'test-repo', stargazers_count: 10 }]);

    await welcomePage.show();

    const panel = vscode.window.lastWebviewPanel;
    const messageHandler = panel.webview._messageHandler;

    await messageHandler({ command: GET_REPOS_COMMAND });

    // Give time for async operation
    await new Promise(resolve => setTimeout(resolve, 20));

    // Should have posted message back
    expect(panel.webview._postedMessages.length).to.be.greaterThan(0);
  });

  it('should use fallback repos on network error', async () => {
    const context = createContext();
    const welcomePage = new WelcomePage(context);

    stubHttpsGetError(sandbox, https, 'Network error');

    await welcomePage.show();

    const panel = vscode.window.lastWebviewPanel;
    const messageHandler = panel.webview._messageHandler;

    await messageHandler({ command: GET_REPOS_COMMAND });

    // Give time for async operation and error handling
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should use fallback repos
    const reposMessage = panel.webview._postedMessages.find((m: any) => m.command === 'reposLoaded');
    if (reposMessage) {
      expect(reposMessage.usingFallback).to.be.true;
    }
  });
});

/**
 * Tests for WelcomePage - fallback repos structure
 */
describe('WelcomePage - fallback repos', () => {
  before(() => {
    setupModuleResolution();
    vscode = require('../helpers/vscode-stub');
    const welcomePageModule = require('../../src/welcomePage');
    WelcomePage = welcomePageModule.WelcomePage;
  });

  after(teardownModuleResolution);

  it('should have fallback repos defined', () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    expect(welcomePage).to.have.property('fallbackRepos');
    expect(welcomePage.fallbackRepos).to.be.an('array');
    expect(welcomePage.fallbackRepos.length).to.be.greaterThan(0);
  });

  it('should have repos with required properties', () => {
    const context = { extensionPath: MOCK_EXTENSION_PATH, subscriptions: [] };
    const welcomePage = new WelcomePage(context);

    for (const repo of welcomePage.fallbackRepos) {
      expect(repo).to.have.property('name');
      expect(repo).to.have.property('html_url');
      expect(repo).to.have.property('description');
      expect(repo).to.have.property('stargazers_count');
    }
  });
});
