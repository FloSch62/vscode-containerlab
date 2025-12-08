/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach, after, __dirname */

import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import Module from 'module';
import * as vscode from '../../helpers/vscode-stub';
import { resetLoggerStub } from '../../helpers/extensionLogger-stub';

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

const LAB_LIFECYCLE_SERVICE_PATH = '../../../src/topoViewer/extension/services/LabLifecycleService';
const labLifecycleModule = require(LAB_LIFECYCLE_SERVICE_PATH) as typeof import('../../../src/topoViewer/extension/services/LabLifecycleService');
const { labLifecycleService } = labLifecycleModule;

after(() => {
  (Module as any)._resolveFilename = originalResolve;
});

describe('LabLifecycleService - validation', () => {
  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('returns error for unknown endpoint', async () => {
    const result = await labLifecycleService.handleLabLifecycleEndpoint('unknownEndpoint', '/home/test/lab.clab.yml');

    expect(result.error).to.equal('Unknown endpoint "unknownEndpoint".');
    expect(vscode.commands.executed).to.have.length(0);
  });

  it('returns noLabPath error when lab path missing', async () => {
    const result = await labLifecycleService.handleLabLifecycleEndpoint('deployLab', '');

    expect(result.error).to.equal('No lab path provided for deployment');
    expect(vscode.commands.executed).to.have.length(0);
  });
});

describe('LabLifecycleService - execution', () => {
  const LAB_PATH = '/home/test/demo.clab.yml';

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('executes deploy action with ClabLabTreeNode argument', async () => {
    const result = await labLifecycleService.handleLabLifecycleEndpoint('deployLab', LAB_PATH);

    expect(result.error).to.be.null;
    expect(result.result).to.equal(`Lab deployment initiated for ${LAB_PATH}`);
    expect(vscode.commands.executed).to.have.length(1);
    const invocation = vscode.commands.executed[0];
    expect(invocation.command).to.equal('containerlab.lab.deploy');
    const arg = invocation.args[0] as any;
    expect(arg.labPath.absolute).to.equal(LAB_PATH);
    expect(arg.collapsibleState).to.equal(vscode.TreeItemCollapsibleState.None);
  });

  it('returns error when VS Code command rejects', async () => {
    sinon.stub(vscode.commands, 'executeCommand').throws(new Error('boom'));

    const result = await labLifecycleService.handleLabLifecycleEndpoint('deployLabCleanup', LAB_PATH);

    expect(result.result).to.be.null;
    expect(result.error).to.include('Error deploying lab with cleanup');
  });
});
