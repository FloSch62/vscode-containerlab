/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for the HelpFeedbackProvider tree data provider.
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
  return null;
}

// Table-driven test cases for expected links
interface HelpLinkTestCase {
  label: string;
  expectedUrl: string;
}

const expectedLinks: HelpLinkTestCase[] = [
  { label: 'Containerlab Documentation', expectedUrl: 'https://containerlab.dev/' },
  { label: 'VS Code Extension Documentation', expectedUrl: 'https://containerlab.dev/manual/vsc-extension/' },
  { label: 'Browse Labs on GitHub (srl-labs)', expectedUrl: 'https://github.com/srl-labs/' },
  { label: 'Find more labs tagged with "clab-topo"', expectedUrl: 'https://github.com/search?q=topic%3Aclab-topo++fork%3Atrue&type=repositories' },
  { label: 'Join our Discord server', expectedUrl: 'https://discord.gg/vAyddtaEV9' },
  { label: 'Download cshargextcap Wireshark plugin', expectedUrl: 'https://github.com/siemens/cshargextcap/releases/latest' }
];

// Shared context
let HelpFeedbackProvider: any;
let vscodeStub: any;

function setupHelpFeedbackTests() {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    const module = require('../../../src/treeView/helpFeedbackProvider');
    HelpFeedbackProvider = module.HelpFeedbackProvider;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });
}

describe('HelpFeedbackProvider - basic functionality', () => {
  setupHelpFeedbackTests();

  it('creates provider instance', () => {
    const provider = new HelpFeedbackProvider();
    expect(provider).to.be.an('object');
  });

  it('has onDidChangeTreeData event', () => {
    const provider = new HelpFeedbackProvider();
    expect(provider.onDidChangeTreeData).to.be.a('function');
  });
});

describe('HelpFeedbackProvider - getChildren()', () => {
  setupHelpFeedbackTests();

  it('returns array of tree items', () => {
    const provider = new HelpFeedbackProvider();
    const children = provider.getChildren();
    expect(children).to.be.an('array');
    expect(children).to.have.length(6);
  });

  it('returns items with correct labels', () => {
    const provider = new HelpFeedbackProvider();
    const children = provider.getChildren() as any[];
    const labels = children.map(item => item.label);
    expectedLinks.forEach(({ label }) => {
      expect(labels).to.include(label);
    });
  });

  expectedLinks.forEach(({ label, expectedUrl }) => {
    it(`returns item "${label}" with correct URL`, () => {
      const provider = new HelpFeedbackProvider();
      const children = provider.getChildren() as any[];
      const item = children.find(i => i.label === label);
      expect(item).to.exist;
      expect(item.command).to.deep.include({
        command: 'containerlab.openLink',
        title: 'Open Link',
        arguments: [expectedUrl]
      });
    });
  });

  it('returns items with link-external icon', () => {
    const provider = new HelpFeedbackProvider();
    const children = provider.getChildren() as any[];
    children.forEach(item => {
      expect(item.iconPath).to.be.an('object');
      expect(item.iconPath.id).to.equal('link-external');
    });
  });

  it('returns items with no collapsible state', () => {
    const provider = new HelpFeedbackProvider();
    const children = provider.getChildren() as any[];
    children.forEach(item => {
      expect(item.collapsibleState).to.equal(vscodeStub.TreeItemCollapsibleState.None);
    });
  });
});

describe('HelpFeedbackProvider - getTreeItem()', () => {
  setupHelpFeedbackTests();

  it('returns the element passed to it', () => {
    const provider = new HelpFeedbackProvider();
    const mockItem = { label: 'Test Item' } as any;
    const result = provider.getTreeItem(mockItem);
    expect(result).to.equal(mockItem);
  });
});
