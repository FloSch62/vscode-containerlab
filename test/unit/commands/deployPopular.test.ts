/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, afterEach, __dirname */
/**
 * Tests for the `deployPopularLab` command.
 *
 * These tests verify that the deployPopularLab function properly handles user
 * selection from the popular repos picker and correctly creates a ClabLabTreeNode
 * to pass to the deploy function.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;

// Helper to clear module cache for all vscode-containerlab modules
function clearModuleCache() {
  Object.keys(require.cache).forEach(key => {
    if (key.includes('vscode-containerlab') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  });
}

// Helper to resolve stub paths for module interception
function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.includes('popularLabs') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'popularLabs-stub.js');
  }
  if (request === './deploy' || request.endsWith('/deploy')) {
    return path.join(__dirname, '..', '..', 'helpers', 'deploy-stub.js');
  }
  return null;
}

const TEST_REPO_URL = 'https://github.com/srl-labs/test-lab';

describe('deployPopularLab command', () => {
  let deployPopularLab: Function;
  let popularLabsStub: any;
  let deployStub: any;
  let vscodeStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    popularLabsStub = require('../../helpers/popularLabs-stub');
    deployStub = require('../../helpers/deploy-stub');
    vscodeStub = require('../../helpers/vscode-stub');
    const deployPopularModule = require('../../../src/commands/deployPopular');
    deployPopularLab = deployPopularModule.deployPopularLab;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    popularLabsStub.resetPopularLabsStub();
    deployStub.resetDeployStub();
    vscodeStub.resetVscodeStub();
  });

  describe('deployPopularLab()', () => {
    it('does nothing when user cancels picker (returns undefined)', async () => {
      popularLabsStub.setPickPopularRepoResult(undefined);

      await deployPopularLab();

      expect(deployStub.deployCalls.length).to.equal(0);
    });

    it('calls deploy with correct node when user selects a repo', async () => {
      const mockPick = {
        label: 'test-repo',
        description: 'Test repository',
        detail: '⭐ 42',
        repo: TEST_REPO_URL,
      };
      popularLabsStub.setPickPopularRepoResult(mockPick);

      await deployPopularLab();

      expect(deployStub.deployCalls.length).to.equal(1);
      const call = deployStub.deployCalls[0];
      expect(call.node).to.exist;
      expect(call.node.labPath).to.exist;
      expect(call.node.labPath.absolute).to.equal(TEST_REPO_URL);
      expect(call.node.labPath.relative).to.equal('');
    });

    it('creates ClabLabTreeNode with empty label', async () => {
      const mockPick = {
        label: 'srl-telemetry-lab',
        description: 'A lab demonstrating the telemetry stack with SR Linux.',
        detail: '⭐ 85',
        repo: 'https://github.com/srl-labs/srl-telemetry-lab',
      };
      popularLabsStub.setPickPopularRepoResult(mockPick);

      await deployPopularLab();

      expect(deployStub.deployCalls.length).to.equal(1);
      const call = deployStub.deployCalls[0];
      expect(call.node).to.exist;
      expect(call.node.label).to.equal('');
    });

    it('creates ClabLabTreeNode with TreeItemCollapsibleState.None', async () => {
      const mockPick = {
        label: 'test-lab',
        description: 'Test lab',
        detail: '⭐ 10',
        repo: TEST_REPO_URL,
      };
      popularLabsStub.setPickPopularRepoResult(mockPick);

      await deployPopularLab();

      expect(deployStub.deployCalls.length).to.equal(1);
      const call = deployStub.deployCalls[0];
      expect(call.node).to.exist;
      expect(call.node.collapsibleState).to.equal(vscodeStub.TreeItemCollapsibleState.None);
    });

    it('passes repo URL from pick result to node labPath.absolute', async () => {
      const customRepoUrl = 'https://github.com/custom/custom-lab';
      const mockPick = {
        label: 'custom-lab',
        description: 'Custom lab',
        detail: '⭐ 99',
        repo: customRepoUrl,
      };
      popularLabsStub.setPickPopularRepoResult(mockPick);

      await deployPopularLab();

      expect(deployStub.deployCalls.length).to.equal(1);
      const call = deployStub.deployCalls[0];
      expect(call.node.labPath.absolute).to.equal(customRepoUrl);
    });
  });
});
