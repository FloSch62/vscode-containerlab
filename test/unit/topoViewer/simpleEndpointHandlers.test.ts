/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach, after, __dirname */

import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import Module from 'module';

// Clear require cache for modules we need to stub BEFORE setting up resolution
const MODULE_PATH = '../../../src/topoViewer/extension/services/SimpleEndpointHandlers';
Object.keys(require.cache).forEach(key => {
  // Clear all topoViewer modules and stubs to ensure fresh loads
  if (key.includes('topoViewer') || key.includes('vscode-stub') || key.includes('extensionLogger-stub')) {
    delete require.cache[key];
  }
});

const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.endsWith('logging/logger')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extensionLogger-stub.js');
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

// Now import stubs and module under test
import * as vscode from '../../helpers/vscode-stub';
import { resetLoggerStub, getLogEntries } from '../../helpers/extensionLogger-stub';

const simpleEndpointsModule = require(MODULE_PATH) as typeof import('../../../src/topoViewer/extension/services/SimpleEndpointHandlers');
const { SimpleEndpointHandlers } = simpleEndpointsModule;

after(() => {
  (Module as any)._resolveFilename = originalResolve;
});

// Constants to avoid duplicate strings
const ERROR_DISPLAYED_MSG = 'Error message displayed';
const SUCCESS_TRUE = 'success';
const TEST_ERROR_MSG = 'Test error message';
const TEST_URL = 'https://example.com';
const DEBUG_MSG = 'Debug test message';
const MSG_DISPLAYED_INFO = 'Displayed info message';
const MSG_INFO = 'Info message';
const MSG_WARNING = 'Warning message';
const CLIPBOARD_KEY = 'topoClipboard';
const INVALID_JSON = 'invalid json';
const ERROR_EXECUTING_ENDPOINT = 'Error executing endpoint';
const TEST_HANDLES_JSON_ERRORS = 'handles JSON parse errors gracefully';
const ERR_NO_MESSAGE = 'No message provided';

describe('SimpleEndpointHandlers - handleShowErrorEndpoint', () => {
  let handlers: InstanceType<typeof SimpleEndpointHandlers>;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    handlers = new SimpleEndpointHandlers();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('shows error message and returns success', async () => {
    const result = await handlers.handleShowErrorEndpoint(TEST_ERROR_MSG);

    expect(result.error).to.be.null;
    expect(result.result).to.equal(ERROR_DISPLAYED_MSG);
    expect(vscode.window.lastErrorMessage).to.equal(TEST_ERROR_MSG);
  });

  it('handles undefined payload', async () => {
    const result = await handlers.handleShowErrorEndpoint(undefined);

    expect(result.error).to.be.null;
    expect(result.result).to.equal(ERROR_DISPLAYED_MSG);
  });
});

describe('SimpleEndpointHandlers - handleShowErrorMessageEndpoint', () => {
  let handlers: InstanceType<typeof SimpleEndpointHandlers>;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    handlers = new SimpleEndpointHandlers();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('shows error message from data.message', async () => {
    const payload = { message: TEST_ERROR_MSG } as any;
    const result = await handlers.handleShowErrorMessageEndpoint(payload);

    expect(result.error).to.be.null;
    expect((result.result as any)[SUCCESS_TRUE]).to.be.true;
    expect(vscode.window.lastErrorMessage).to.equal(TEST_ERROR_MSG);
  });

  it('does nothing when message is missing', async () => {
    const payload = {} as any;
    const result = await handlers.handleShowErrorMessageEndpoint(payload);

    expect(result.error).to.be.null;
    expect((result.result as any)[SUCCESS_TRUE]).to.be.true;
    expect(vscode.window.lastErrorMessage).to.equal('');
  });

  it('does nothing when payload is undefined', async () => {
    const result = await handlers.handleShowErrorMessageEndpoint(undefined);

    expect(result.error).to.be.null;
    expect((result.result as any)[SUCCESS_TRUE]).to.be.true;
  });
});

describe('SimpleEndpointHandlers - handleShowVscodeMessageEndpoint', () => {
  let handlers: InstanceType<typeof SimpleEndpointHandlers>;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    handlers = new SimpleEndpointHandlers();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('shows info message', async () => {
    const payload = JSON.stringify({ type: 'info', message: MSG_INFO });
    const result = await handlers.handleShowVscodeMessageEndpoint(payload);

    expect(result.error).to.be.null;
    expect(result.result).to.include(MSG_DISPLAYED_INFO);
    expect(vscode.window.lastInfoMessage).to.equal(MSG_INFO);
  });

  it('shows warning message', async () => {
    const payload = JSON.stringify({ type: 'warning', message: MSG_WARNING });
    const result = await handlers.handleShowVscodeMessageEndpoint(payload);

    expect(result.error).to.be.null;
    expect(result.result).to.include('Displayed warning message');
    expect(vscode.window.lastWarningMessage).to.equal(MSG_WARNING);
  });

  it('shows error message', async () => {
    const payload = JSON.stringify({ type: 'error', message: TEST_ERROR_MSG });
    const result = await handlers.handleShowVscodeMessageEndpoint(payload);

    expect(result.error).to.be.null;
    expect(result.result).to.include('Displayed error message');
    expect(vscode.window.lastErrorMessage).to.equal(TEST_ERROR_MSG);
  });

  it('logs error for unsupported type', async () => {
    const payload = JSON.stringify({ type: 'unknown', message: 'Unknown type' });
    await handlers.handleShowVscodeMessageEndpoint(payload);

    const logs = getLogEntries();
    expect(logs.some(e => e.level === 'error' && e.message.includes('Unsupported'))).to.be.true;
  });

  it(TEST_HANDLES_JSON_ERRORS, async () => {
    const result = await handlers.handleShowVscodeMessageEndpoint(INVALID_JSON);

    expect(result.error).to.be.null;
    expect(result.result).to.include(ERROR_EXECUTING_ENDPOINT);
  });
});

describe('SimpleEndpointHandlers - handleOpenExternalEndpoint', () => {
  let handlers: InstanceType<typeof SimpleEndpointHandlers>;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    handlers = new SimpleEndpointHandlers();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('opens external URL', async () => {
    const payload = JSON.stringify(TEST_URL);
    const result = await handlers.handleOpenExternalEndpoint(payload);

    expect(result.error).to.be.null;
    expect(result.result).to.include('Opened external URL');
    expect(vscode.env.lastOpenedUrl).to.not.be.undefined;
  });

  it(TEST_HANDLES_JSON_ERRORS, async () => {
    const result = await handlers.handleOpenExternalEndpoint(INVALID_JSON);

    expect(result.error).to.be.null;
    expect(result.result).to.include(ERROR_EXECUTING_ENDPOINT);
  });
});

describe('SimpleEndpointHandlers - handleOpenExternalLinkEndpoint', () => {
  let handlers: InstanceType<typeof SimpleEndpointHandlers>;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    handlers = new SimpleEndpointHandlers();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('opens link from parsed URL object', async () => {
    const payload = JSON.stringify({ url: TEST_URL });
    const result = await handlers.handleOpenExternalLinkEndpoint(payload);

    expect(result.error).to.be.null;
    expect(result.result).to.include('Opened free text link');
    expect(vscode.env.lastOpenedUrl).to.not.be.undefined;
  });

  it('warns when URL is missing', async () => {
    const payload = JSON.stringify({});
    const result = await handlers.handleOpenExternalLinkEndpoint(payload);

    expect(result.error).to.include('without a URL');
    const logs = getLogEntries();
    expect(logs.some(e => e.level === 'warn')).to.be.true;
  });

  it('handles undefined payload', async () => {
    const result = await handlers.handleOpenExternalLinkEndpoint(undefined);

    expect(result.error).to.include('without a URL');
  });

  it(TEST_HANDLES_JSON_ERRORS, async () => {
    const result = await handlers.handleOpenExternalLinkEndpoint(INVALID_JSON);

    expect(result.error).to.be.null;
    expect(result.result).to.include(ERROR_EXECUTING_ENDPOINT);
  });
});

describe('SimpleEndpointHandlers - handleDebugLogEndpoint', () => {
  let handlers: InstanceType<typeof SimpleEndpointHandlers>;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    handlers = new SimpleEndpointHandlers();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('logs debug message and returns success', async () => {
    const payload = { message: DEBUG_MSG };
    const result = await handlers.handleDebugLogEndpoint(payload);

    expect(result.error).to.be.null;
    expect(result.result).to.be.true;
    const logs = getLogEntries();
    expect(logs.some(e => e.level === 'debug' && e.message === DEBUG_MSG)).to.be.true;
  });

  it('returns error when message is missing', async () => {
    const result = await handlers.handleDebugLogEndpoint({});

    expect(result.error).to.equal(ERR_NO_MESSAGE);
    expect(result.result).to.be.false;
  });

  it('returns error when payload is undefined', async () => {
    const result = await handlers.handleDebugLogEndpoint(undefined);

    expect(result.error).to.equal(ERR_NO_MESSAGE);
    expect(result.result).to.be.false;
  });

  it('returns error when message is not a string', async () => {
    const result = await handlers.handleDebugLogEndpoint({ message: 123 });

    expect(result.error).to.equal(ERR_NO_MESSAGE);
    expect(result.result).to.be.false;
  });
});

describe('SimpleEndpointHandlers - handlePerformanceMetricsEndpoint with payloadObj', () => {
  let handlers: InstanceType<typeof SimpleEndpointHandlers>;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    handlers = new SimpleEndpointHandlers();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('processes valid metrics object', async () => {
    const payloadObj = { metrics: { load: 100, render: 200 } };
    const result = await handlers.handlePerformanceMetricsEndpoint(undefined, payloadObj);

    expect(result.error).to.be.null;
    expect((result.result as any)[SUCCESS_TRUE]).to.be.true;
    const logs = getLogEntries();
    expect(logs.some(e => e.level === 'info' && e.message.includes('performance metrics'))).to.be.true;
  });

  it('warns when metrics payload is missing', async () => {
    const result = await handlers.handlePerformanceMetricsEndpoint(undefined, {});

    expect(result.error).to.be.null;
    expect((result.result as any).warning).to.include('without metrics');
    const logs = getLogEntries();
    expect(logs.some(e => e.level === 'warn')).to.be.true;
  });

  it('warns when metrics contain no numeric values', async () => {
    // Note: null converts to 0 via Number(), so we use non-convertible strings
    const payloadObj = { metrics: { foo: 'bar', baz: 'not-a-number' } };
    const result = await handlers.handlePerformanceMetricsEndpoint(undefined, payloadObj);

    expect(result.error).to.be.null;
    const warning = (result.result as any).warning;
    expect(warning).to.be.a('string');
    expect(warning).to.include('no numeric values');
  });
});

describe('SimpleEndpointHandlers - handlePerformanceMetricsEndpoint with string payload', () => {
  let handlers: InstanceType<typeof SimpleEndpointHandlers>;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    handlers = new SimpleEndpointHandlers();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('parses JSON string payload', async () => {
    const payload = JSON.stringify({ metrics: { load: 50, render: 75 } });
    const result = await handlers.handlePerformanceMetricsEndpoint(payload, null);

    expect(result.error).to.be.null;
    expect((result.result as any)[SUCCESS_TRUE]).to.be.true;
  });

  it('handles JSON parse errors', async () => {
    const result = await handlers.handlePerformanceMetricsEndpoint(INVALID_JSON, null);

    expect(result.error).to.be.null;
    expect((result.result as any).warning).to.include('without metrics');
    const logs = getLogEntries();
    expect(logs.some(e => e.level === 'warn' && e.message.includes('Failed to parse'))).to.be.true;
  });

  it('converts string numbers to numeric', async () => {
    const payloadObj = { metrics: { load: '100', render: 200 } };
    const result = await handlers.handlePerformanceMetricsEndpoint(undefined, payloadObj);

    expect(result.error).to.be.null;
    expect((result.result as any)[SUCCESS_TRUE]).to.be.true;
  });

  it('filters out NaN values', async () => {
    const payloadObj = { metrics: { valid: 100, invalid: NaN } };
    const result = await handlers.handlePerformanceMetricsEndpoint(undefined, payloadObj);

    expect(result.error).to.be.null;
    expect((result.result as any)[SUCCESS_TRUE]).to.be.true;
  });
});

describe('SimpleEndpointHandlers - handleCopyElementsEndpoint', () => {
  let handlers: InstanceType<typeof SimpleEndpointHandlers>;
  let mockContext: any;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    handlers = new SimpleEndpointHandlers();
    mockContext = {
      globalState: {
        data: {} as Record<string, any>,
        get(key: string) {
          return this.data[key];
        },
        update(key: string, value: any) {
          this.data[key] = value;
          return Promise.resolve();
        }
      }
    };
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('stores elements in global state', async () => {
    const payload = [{ id: 'node1' }, { id: 'node2' }];
    const result = await handlers.handleCopyElementsEndpoint(mockContext, payload);

    expect(result.error).to.be.null;
    expect(result.result).to.equal('Elements copied');
    expect(mockContext.globalState.data[CLIPBOARD_KEY]).to.deep.equal(payload);
  });

  it('handles empty array', async () => {
    const result = await handlers.handleCopyElementsEndpoint(mockContext, []);

    expect(result.error).to.be.null;
    expect(result.result).to.equal('Elements copied');
    expect(mockContext.globalState.data[CLIPBOARD_KEY]).to.deep.equal([]);
  });
});

describe('SimpleEndpointHandlers - handleGetCopiedElementsEndpoint', () => {
  let handlers: InstanceType<typeof SimpleEndpointHandlers>;
  let mockContext: any;
  let mockPanel: any;
  let postedMessages: any[];

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    handlers = new SimpleEndpointHandlers();
    postedMessages = [];
    mockContext = {
      globalState: {
        data: {} as Record<string, any>,
        get(key: string) {
          return this.data[key];
        },
        update(key: string, value: any) {
          this.data[key] = value;
          return Promise.resolve();
        }
      }
    };
    mockPanel = {
      webview: {
        postMessage(message: any) {
          postedMessages.push(message);
          return Promise.resolve(true);
        }
      }
    };
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('sends clipboard data to webview', async () => {
    const clipboard = [{ id: 'node1' }];
    mockContext.globalState.data[CLIPBOARD_KEY] = clipboard;

    const result = await handlers.handleGetCopiedElementsEndpoint(mockContext, mockPanel);

    expect(result.error).to.be.null;
    expect(result.result).to.equal('Clipboard sent');
    expect(postedMessages).to.have.length(1);
    expect(postedMessages[0].type).to.equal('copiedElements');
    expect(postedMessages[0].data).to.deep.equal(clipboard);
  });

  it('sends empty array when clipboard is empty', async () => {
    const result = await handlers.handleGetCopiedElementsEndpoint(mockContext, mockPanel);

    expect(result.error).to.be.null;
    expect(postedMessages[0].data).to.deep.equal([]);
  });
});
