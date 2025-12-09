/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, afterEach, __dirname */
import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'fs';
import path from 'path';
import Module from 'module';
import * as vscode from '../../helpers/vscode-stub';
import { iconManager } from '../../../src/topoViewer/extension/services/IconManager';

function createUri(p: string): any {
  return { path: p, fsPath: p, toString: () => p };
}

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

/**
 * Import and delete tests
 */
describe('IconManager - import and delete', () => {
  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('imports supported icons and writes sanitized filename', async () => {
    sinon.stub(iconManager, 'ensureCustomIconDirectory').resolves('/icons');
    sinon.stub(iconManager, 'pathExists').resolves(false);
    sinon.stub(vscode.workspace.fs, 'readFile').resolves(new Uint8Array([1, 2, 3]));
    const writeStub = sinon.stub(fs.promises, 'writeFile').resolves();

    const result = await iconManager.importCustomIcon(createUri('/home/user/icons/my-icon.png'));

    expect(result.name).to.equal('my-icon');
    expect(result.filePath).to.equal('/icons/my-icon.png');
    expect(writeStub.calledOnce).to.be.true;
  });

  it('rejects unsupported icon extensions', async () => {
    let caught: Error | undefined;
    try {
      await iconManager.importCustomIcon(createUri('/home/user/icons/logo.gif'));
    } catch (err: any) {
      caught = err;
    }
    expect(caught).to.exist;
    expect(caught?.message).to.include('Only .svg and .png icons are supported.');
  });

  it('deletes custom icon files when present', async () => {
    const pathExistsStub = sinon.stub(iconManager, 'pathExists');
    pathExistsStub.onFirstCall().resolves(true); // dir exists
    pathExistsStub.onSecondCall().resolves(true); // .svg file exists
    pathExistsStub.onThirdCall().resolves(false); // .png
    sinon.stub(fs.promises, 'unlink').resolves();
    sinon.stub(iconManager, 'getCustomIconDirectory').returns('/icons');

    const result = await iconManager.deleteCustomIcon('router');

    expect(result).to.be.true;
  });

  it('returns false when custom icon directory is missing', async () => {
    sinon.stub(iconManager, 'pathExists').resolves(false);
    sinon.stub(iconManager, 'getCustomIconDirectory').returns('/missing');

    const result = await iconManager.deleteCustomIcon('router');

    expect(result).to.be.false;
  });
});

/**
 * Load and picker option tests
 */
describe('IconManager - load and picker options', () => {
  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('loads custom icons from directory and builds data URIs', async () => {
    const dirents = [
      { name: 'router.svg', isFile: () => true },
      { name: 'switch.png', isFile: () => true },
      { name: 'notes.txt', isFile: () => true },
      { name: 'folder', isFile: () => false }
    ];
    sinon.stub(iconManager, 'getCustomIconDirectory').returns('/icons');
    sinon.stub(fs.promises, 'readdir').resolves(dirents as any);
    sinon.stub(fs.promises, 'readFile')
      .onFirstCall().resolves(Buffer.from('svgdata'))
      .onSecondCall().resolves(Buffer.from('pngdata'));

    const icons = await iconManager.loadCustomIcons();

    expect(Object.keys(icons)).to.include.members(['router', 'switch']);
    expect(icons.router).to.match(/^data:image\/svg\+xml;base64,/);
    expect(icons.switch).to.match(/^data:image\/png;base64,/);
    expect(Object.keys(icons)).to.not.include('notes');
  });

  it('returns empty map when icon directory does not exist', async () => {
    sinon.stub(iconManager, 'getCustomIconDirectory').returns('/missing');
    sinon.stub(fs.promises, 'readdir').rejects({ code: 'ENOENT' });

    const icons = await iconManager.loadCustomIcons();

    expect(icons).to.deep.equal({});
  });

  it('provides picker options with defaultUri for local uploads', () => {
    const opts = iconManager.getIconPickerOptions('local');

    expect(opts.canSelectMany).to.be.false;
    expect(opts.filters?.Images).to.include('svg');
    expect(opts.defaultUri).to.exist;
  });

  it('promptIconUploadSource respects remote selection', async () => {
    vscode.env.remoteName = 'ssh-remote';
    (sinon.stub(vscode.window as any, 'showQuickPick') as any).resolves({
      label: 'Upload from local machine',
      description: '',
      value: 'local'
    });

    const pick = await iconManager.promptIconUploadSource();

    expect(pick).to.equal('local');
  });
});
