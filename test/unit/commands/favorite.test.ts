/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for the `toggleFavorite` command.
 *
 * These tests verify that favorites can be added and removed,
 * and that the state is persisted to globalState.
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
  if (request.includes('extension') && !request.includes('stub') && !request.includes('.test')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  return null;
}

// Test constants
const TEST_LAB_PATH = '/home/user/lab.yml';
const TEST_NEW_LAB_PATH = '/home/user/new-lab.yml';
const TEST_OTHER_LAB_PATH = '/home/user/other-lab.yml';

// eslint-disable-next-line aggregate-complexity/aggregate-complexity
describe('favorite command', () => {
  let toggleFavorite: Function;
  let extensionStub: any;
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

    extensionStub = require('../../helpers/extension-stub');
    vscodeStub = require('../../helpers/vscode-stub');
    const favoriteModule = require('../../../src/commands/favorite');
    toggleFavorite = favoriteModule.toggleFavorite;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    extensionStub.resetExtensionStub();
    vscodeStub.window.lastErrorMessage = '';
    vscodeStub.window.lastInfoMessage = '';
    vscodeStub.commands.executed.length = 0;
  });

  describe('toggleFavorite()', () => {
    it('adds lab to favorites when not already favorite', async () => {
      const node = { labPath: { absolute: TEST_LAB_PATH } } as any;

      await toggleFavorite(node);

      expect(extensionStub.favoriteLabs.has(TEST_LAB_PATH)).to.be.true;
      expect(vscodeStub.window.lastInfoMessage).to.include('Marked lab as favorite');
    });

    it('removes lab from favorites when already favorite', async () => {
      const node = { labPath: { absolute: TEST_LAB_PATH } } as any;
      extensionStub.favoriteLabs.add(TEST_LAB_PATH);

      await toggleFavorite(node);

      expect(extensionStub.favoriteLabs.has(TEST_LAB_PATH)).to.be.false;
      expect(vscodeStub.window.lastInfoMessage).to.include('Removed favorite lab');
    });

    it('persists favorites to globalState when adding', async () => {
      const node = { labPath: { absolute: TEST_NEW_LAB_PATH } } as any;

      await toggleFavorite(node);

      const saved = await extensionStub.extensionContext.globalState.get('favoriteLabs');
      expect(saved).to.deep.equal([TEST_NEW_LAB_PATH]);
    });

    it('persists favorites to globalState when removing', async () => {
      const node = { labPath: { absolute: TEST_LAB_PATH } } as any;
      extensionStub.favoriteLabs.add(TEST_LAB_PATH);
      extensionStub.favoriteLabs.add(TEST_OTHER_LAB_PATH);

      await toggleFavorite(node);

      const saved = await extensionStub.extensionContext.globalState.get('favoriteLabs');
      expect(saved).to.deep.equal([TEST_OTHER_LAB_PATH]);
    });

    it('triggers refresh command after toggling', async () => {
      const node = { labPath: { absolute: TEST_LAB_PATH } } as any;

      await toggleFavorite(node);

      const refreshCmd = vscodeStub.commands.executed.find(
        (c: any) => c.command === 'containerlab.refresh'
      );
      expect(refreshCmd).to.exist;
    });

    it('does nothing when node is undefined', async () => {
      await toggleFavorite(undefined);

      expect(extensionStub.favoriteLabs.size).to.equal(0);
      expect(vscodeStub.window.lastInfoMessage).to.equal('');
    });

    it('does nothing when node has no labPath', async () => {
      const node = {} as any;

      await toggleFavorite(node);

      expect(extensionStub.favoriteLabs.size).to.equal(0);
      expect(vscodeStub.window.lastInfoMessage).to.equal('');
    });

    it('does nothing when labPath has no absolute path', async () => {
      const node = { labPath: {} } as any;

      await toggleFavorite(node);

      expect(extensionStub.favoriteLabs.size).to.equal(0);
      expect(vscodeStub.window.lastInfoMessage).to.equal('');
    });
  });
});
