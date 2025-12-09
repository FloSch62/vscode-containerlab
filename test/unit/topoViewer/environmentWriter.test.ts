/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach, after, __dirname */

import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import Module from 'module';
import fs from 'fs';
import * as os from 'os';
import * as vscode from '../../helpers/vscode-stub';
import { resetLoggerStub } from '../../helpers/extensionLogger-stub';
import * as environmentWriterModule from '../../../src/topoViewer/extension/services/EnvironmentWriter';

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

const { mapEnvironmentJsonToHyphenated, createFolderAndWriteJson, generateStaticAssetUris } = environmentWriterModule;
type EnvironmentWriterState = environmentWriterModule.EnvironmentWriterState;
type EnvironmentJson = import('../../../src/topoViewer/shared/types/topoViewerType').EnvironmentJson;

after(() => {
  (Module as any)._resolveFilename = originalResolve;
});

function createContext(root: string): any {
  return { extensionUri: { fsPath: root, toString: () => root } };
}

const DEFAULT_PORT = '8082';
const DEFAULT_ALLOWED_HOST = 'host.local';
const SAMPLE_LAB_NAME = 'sample-lab';

describe('EnvironmentWriter - serialization', () => {
  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('converts camelCase EnvironmentJson to hyphenated JSON', () => {
    const envJson: EnvironmentJson = {
      workingDirectory: '/tmp',
      clabPrefix: 'clab',
      clabName: SAMPLE_LAB_NAME,
      clabServerAddress: '127.0.0.1',
      clabAllowedHostname: DEFAULT_ALLOWED_HOST,
      clabAllowedHostname01: DEFAULT_ALLOWED_HOST,
      clabServerPort: DEFAULT_PORT,
      deploymentType: 'vs-code',
      topoviewerVersion: '1.0.0',
      topviewerPresetLayout: 'false',
      envCyTopoJsonBytes: { nodes: [], edges: [] } as any
    };

    const hyphenated = mapEnvironmentJsonToHyphenated(envJson);
    const parsed = JSON.parse(hyphenated);

    expect(parsed).to.include({
      'working-directory': '/tmp',
      'clab-prefix': 'clab',
      'clab-name': SAMPLE_LAB_NAME,
      'clab-server-address': '127.0.0.1',
      'clab-allowed-hostname': DEFAULT_ALLOWED_HOST,
      'clab-allowed-hostname01': DEFAULT_ALLOWED_HOST,
      'clab-server-port': DEFAULT_PORT,
      'deployment-type': 'vs-code',
      'topoviewer-version': '1.0.0',
      'topoviewer-layout-preset': 'false'
    });
    expect(parsed.EnvCyTopoJsonBytes).to.deep.equal(envJson.envCyTopoJsonBytes);
  });
});

describe('EnvironmentWriter - folder and files', () => {
  const ROOT = '/ext-root';
  const FOLDER = 'lab-folder';
  const YAML_CONTENT = 'name: demo-lab\nprefix: demo\n\ntopology:\n  nodes: {}';
  let mkdirStub: sinon.SinonStub;
  let writeFileStub: sinon.SinonStub;

  beforeEach(() => {
    resetLoggerStub();
    mkdirStub = sinon.stub(fs.promises, 'mkdir').resolves();
    writeFileStub = sinon.stub(fs.promises, 'writeFile').resolves();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('writes cyto and environment files, updates state, and returns URIs', async () => {
    const state: EnvironmentWriterState = {
      currentClabTopo: undefined,
      currentClabDoc: undefined,
      currentIsPresetLayout: true,
      currentClabName: undefined,
      currentClabPrefix: undefined,
      allowedhostname: undefined
    };
    const cytoTopology = { nodes: [{ id: 'n1' }], edges: [] } as any;
    const context = createContext(ROOT);

    const uris = await createFolderAndWriteJson(context as any, FOLDER, cytoTopology, YAML_CONTENT, state);

    const expectedDir = `${ROOT}/topoViewerData/${FOLDER}`;
    expect(mkdirStub.calledOnceWithExactly(expectedDir, { recursive: true })).to.be.true;
    expect(writeFileStub.callCount).to.equal(2);

    const cytoArgs = writeFileStub.firstCall.args;
    expect(cytoArgs[0]).to.equal(`${expectedDir}/dataCytoMarshall.json`);
    expect(JSON.parse(cytoArgs[1] as string)).to.deep.equal(cytoTopology);

    const envArgs = writeFileStub.secondCall.args;
    expect(envArgs[0]).to.equal(`${expectedDir}/environment.json`);
    const envPayload = JSON.parse(envArgs[1] as string);
    const expectedHost = os.hostname();
    expect(envPayload).to.include({
      'working-directory': '.',
      'clab-prefix': 'demo',
      'clab-name': 'demo-lab',
      'clab-server-address': '',
      'clab-allowed-hostname': expectedHost,
      'clab-allowed-hostname01': expectedHost,
      'clab-server-port': DEFAULT_PORT,
      'deployment-type': 'vs-code',
      'topoviewer-layout-preset': 'true'
    });
    expect(envPayload.EnvCyTopoJsonBytes).to.deep.equal(cytoTopology);
    expect(state.currentClabName).to.equal('demo-lab');
    expect(state.currentClabPrefix).to.equal('demo');
    expect(state.currentClabDoc).to.exist;
    expect(state.allowedhostname).to.equal(expectedHost);
    expect(uris[0].fsPath).to.equal(`${expectedDir}/dataCytoMarshall.json`);
    expect(uris[1].fsPath).to.equal(`${expectedDir}/environment.json`);
  });

  it('propagates file system errors and logs them', async () => {
    sinon.restore();
    resetLoggerStub();
    sinon.stub(fs.promises, 'mkdir').rejects(new Error('mkdir failure'));
    const state: EnvironmentWriterState = {
      currentClabTopo: undefined,
      currentClabDoc: undefined,
      currentIsPresetLayout: false,
      currentClabName: undefined,
      currentClabPrefix: undefined,
      allowedhostname: undefined
    };
    const context = createContext(ROOT);

    try {
      await createFolderAndWriteJson(context as any, FOLDER, { nodes: [] } as any, YAML_CONTENT, state);
      expect.fail('Expected createFolderAndWriteJson to throw');
    } catch (err: any) {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('mkdir failure');
    }
  });
});

describe('EnvironmentWriter - static assets', () => {
  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('builds static asset URIs using webview.asWebviewUri', () => {
    const asWebviewUri = sinon.stub().callsFake((uri: any) => ({
      toString: () => `web://${uri.fsPath}`
    }));
    const webview = { asWebviewUri };
    const context = createContext('/ext');

    const uris = generateStaticAssetUris(context as any, webview as any);

    expect(asWebviewUri.callCount).to.equal(3);
    expect(uris.css).to.equal('web:///ext/dist/css');
    expect(uris.js).to.equal('web:///ext/dist/js');
    expect(uris.images).to.equal('web:///ext/dist/images');
  });
});
