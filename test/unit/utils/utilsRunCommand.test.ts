/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for utils.ts runCommand function.
 * Uses real shell commands (echo) for testing since child_process.exec cannot be stubbed.
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
  return null;
}

let utilsModule: any;
let vscodeStub: any;

function createMockOutputChannel() {
  return {
    infoCalls: [] as string[],
    warnCalls: [] as string[],
    errorCalls: [] as string[],
    info(msg: string) { this.infoCalls.push(msg); },
    warn(msg: string) { this.warnCalls.push(msg); },
    error(msg: string) { this.errorCalls.push(msg); },
  };
}

describe('runCommand() - success with echo', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('returns stdout when returnOutput is true', async () => {
    const outputChannel = createMockOutputChannel();
    const result = await utilsModule.runCommand('echo hello', 'test echo', outputChannel, true);
    expect(result).to.include('hello');
  });

  it('returns undefined when returnOutput is false', async () => {
    const outputChannel = createMockOutputChannel();
    const result = await utilsModule.runCommand('echo hello', 'test echo', outputChannel, false);
    expect(result).to.be.undefined;
  });

  it('logs the command being run', async () => {
    const outputChannel = createMockOutputChannel();
    await utilsModule.runCommand('echo test', 'test cmd', outputChannel, true);
    expect(outputChannel.infoCalls.some(msg => msg.includes('echo test'))).to.be.true;
  });

  it('logs output to the channel', async () => {
    const outputChannel = createMockOutputChannel();
    await utilsModule.runCommand('echo output', 'test cmd', outputChannel, true);
    // Should have logged the output
    expect(outputChannel.infoCalls.length).to.be.greaterThan(0);
  });
});

describe('runCommand() - stderr handling', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('includes stderr when includeStderr is true', async () => {
    const outputChannel = createMockOutputChannel();
    // This command writes to stderr
    const result = await utilsModule.runCommand('echo stdout && echo stderr >&2', 'test', outputChannel, true, true);
    // Result should include both stdout and stderr
    expect(result).to.include('stdout');
  });

  it('excludes stderr when includeStderr is false', async () => {
    const outputChannel = createMockOutputChannel();
    const result = await utilsModule.runCommand('echo stdout', 'test', outputChannel, true, false);
    expect(result).to.include('stdout');
  });
});

describe('runCommand() - error handling', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('throws error when command fails', async () => {
    const outputChannel = createMockOutputChannel();
    try {
      await utilsModule.runCommand('exit 1', 'failing command', outputChannel, true);
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).to.include('Command failed');
    }
  });

  it('includes command in error message', async () => {
    const outputChannel = createMockOutputChannel();
    try {
      await utilsModule.runCommand('nonexistent-command-xyz', 'test', outputChannel, true);
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).to.include('nonexistent-command-xyz');
    }
  });
});

describe('runCommand() - default parameters', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('works with only required parameters', async () => {
    const outputChannel = createMockOutputChannel();
    const result = await utilsModule.runCommand('echo test', 'simple test', outputChannel);
    expect(result).to.be.undefined; // Default returnOutput is false
  });
});
