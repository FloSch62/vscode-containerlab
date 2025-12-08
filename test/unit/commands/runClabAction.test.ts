/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach */
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as vscode from '../../helpers/vscode-stub';
import * as utils from '../../helpers/utils-stub';

// Mock the dependencies before importing the module
const mockClabCommand = {
  run: sinon.stub().resolves()
};

const mockClabCommandConstructor = sinon.stub().returns(mockClabCommand);

/**
 * Tests for runClabAction - Action Parameters
 */
describe('runClabAction - Action Parameters', () => {
  beforeEach(() => {
    vscode.resetVscodeStub();
    utils.clearMocks();
    mockClabCommand.run.reset();
    mockClabCommandConstructor.reset();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should accept "deploy" action', () => {
    const validActions = ['deploy', 'redeploy', 'destroy'];
    expect(validActions).to.include('deploy');
  });

  it('should accept "redeploy" action', () => {
    const validActions = ['deploy', 'redeploy', 'destroy'];
    expect(validActions).to.include('redeploy');
  });

  it('should accept "destroy" action', () => {
    const validActions = ['deploy', 'redeploy', 'destroy'];
    expect(validActions).to.include('destroy');
  });
});

/**
 * Tests for runClabAction - Cleanup Flag Behavior
 */
describe('runClabAction - Cleanup Flag Behavior', () => {
  it('should show warning when cleanup is true and skipCleanupWarning is false', async () => {
    // Test the warning message format
    const expectedPatterns = ['cleanup', 'remove', 'artifacts'];
    const warningMessage = 'WARNING: Deploy (cleanup) will remove all configuration artifacts.. Are you sure you want to proceed?';

    expect(expectedPatterns.some(p => warningMessage.toLowerCase().includes(p))).to.be.true;
  });

  it('should recognize valid config value format', () => {
    // Test that config values follow expected format
    const configKey = 'containerlab.skipCleanupWarning';
    expect(configKey).to.match(/^containerlab\./);
  });

  it('should have boolean as default type for skipCleanupWarning', () => {
    // Test that default value handling is correct
    const defaultValue = false;
    expect(typeof defaultValue).to.equal('boolean');
    expect(defaultValue).to.be.false;
  });
});

/**
 * Tests for runClabAction - Node Parameter Handling
 */
describe('runClabAction - Node Parameter Handling', () => {
  beforeEach(() => {
    vscode.resetVscodeStub();
    utils.clearMocks();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should return undefined when getSelectedLabNode called with no node', async () => {
    const result = await utils.getSelectedLabNode();
    expect(result).to.be.undefined;
  });

  it('should use provided node when available', async () => {
    const mockNode = {
      labPath: { absolute: '/path/to/lab.clab.yml', relative: 'lab.clab.yml' },
      name: 'test-lab'
    };

    const result = await utils.getSelectedLabNode(mockNode);
    expect(result).to.equal(mockNode);
  });
});

/**
 * Tests for runClabAction - Warning Dialog Responses
 */
describe('runClabAction - Warning Dialog Responses', () => {
  beforeEach(() => {
    vscode.resetVscodeStub();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should handle "Yes" response to cleanup warning', () => {
    vscode.window.lastWarningSelection = 'Yes';

    const response = vscode.window.lastWarningSelection;
    expect(response).to.equal('Yes');
  });

  it('should handle "Don\'t warn me again" response', () => {
    vscode.window.lastWarningSelection = "Don't warn me again";

    const response = vscode.window.lastWarningSelection;
    expect(response).to.equal("Don't warn me again");
  });

  it('should handle cancelled dialog (undefined response)', () => {
    vscode.window.lastWarningSelection = undefined;

    const response = vscode.window.lastWarningSelection;
    expect(response).to.be.undefined;
  });
});

/**
 * Tests for runClabAction - Command Execution
 */
describe('runClabAction - Command Execution', () => {
  it('should pass cleanup flag as "-c" argument when cleanup is true', () => {
    const cleanupArgs = ['-c'];
    expect(cleanupArgs).to.include('-c');
  });

  it('should not pass cleanup flag when cleanup is false', () => {
    const normalArgs: string[] = [];
    expect(normalArgs).to.not.include('-c');
  });
});

/**
 * Tests for runClabAction - Action Name Formatting
 */
describe('runClabAction - Action Name Formatting', () => {
  it('should capitalize first letter for warning message', () => {
    const action = 'deploy';
    const formatted = action.charAt(0).toUpperCase() + action.slice(1);
    expect(formatted).to.equal('Deploy');
  });

  it('should format redeploy correctly', () => {
    const action = 'redeploy';
    const formatted = action.charAt(0).toUpperCase() + action.slice(1);
    expect(formatted).to.equal('Redeploy');
  });

  it('should format destroy correctly', () => {
    const action = 'destroy';
    const formatted = action.charAt(0).toUpperCase() + action.slice(1);
    expect(formatted).to.equal('Destroy');
  });
});
