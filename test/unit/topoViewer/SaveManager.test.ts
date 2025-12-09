/* eslint-env mocha, node */
/* global describe, it, global, __dirname */

import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import Module from 'module';
import { JSDOM } from 'jsdom';

import {
  loadCytoStyleCalls,
  resetBaseStylesStub
} from '../../helpers/webview-baseStyles-stub';
import {
  updateNodePositionCalls,
  handleGeoDataCalls,
  resetNodeUtilsStub
} from '../../helpers/webview-nodeUtils-stub';
import { resetLoggerStub } from '../../helpers/extensionLogger-stub';
import topoViewerState from '../../../src/topoViewer/webview/app/state';
import type { SaveManager as SaveManagerClass } from '../../../src/topoViewer/webview/core/SaveManager';

const originalResolve = (Module as any)._resolveFilename;
const baseStylesStubPath = path.join(
  __dirname,
  '..',
  '..',
  'helpers',
  'webview-baseStyles-stub.js'
);
const nodeUtilsStubPath = path.join(
  __dirname,
  '..',
  '..',
  'helpers',
  'webview-nodeUtils-stub.js'
);
const linkTypesStubPath = path.join(
  __dirname,
  '..',
  '..',
  'helpers',
  'webview-linkTypes-stub.js'
);
const loggerStubPath = path.join(
  __dirname,
  '..',
  '..',
  'helpers',
  'extensionLogger-stub.js'
);

// Provide a window/document for imported messaging module
const importDom = new JSDOM('<div></div>');
(global as any).window = importDom.window as any;
(global as any).document = importDom.window.document;

(Module as any)._resolveFilename = function (
  request: string,
  parent: any,
  isMain: boolean,
  options: any
) {
  if (request.endsWith('features/canvas/BaseStyles')) {
    return baseStylesStubPath;
  }
  if (request.endsWith('features/nodes/NodeUtils')) {
    return nodeUtilsStubPath;
  }
  if (request.endsWith('shared/utilities/LinkTypes')) {
    return linkTypesStubPath;
  }
  if (request.endsWith('logging/logger')) {
    return loggerStubPath;
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

// Import after stubbing module resolution
const saveManagerModule = require('../../../src/topoViewer/webview/core/SaveManager') as typeof import('../../../src/topoViewer/webview/core/SaveManager');
const { SaveManager } = saveManagerModule;
// Restore resolver immediately to avoid impacting other suites
(Module as any)._resolveFilename = originalResolve;
importDom.window.close();
delete (global as any).window;
delete (global as any).document;

function createNode(id: string, role: string) {
  const nodeJson = {
    data: { id, name: id, topoViewerRole: role },
    position: { x: 1, y: 2 }
  };
  return {
    data: (key: string) => (nodeJson as any).data[key],
    json: () => ({ ...nodeJson }),
    parent: () => ({
      nonempty: () => false
    })
  };
}

function setupSaveManagerContext(): {
  dom: JSDOM;
  messageSender: { sendMessageToVscodeEndpointPost: sinon.SinonStub };
  saveManager: SaveManagerClass;
} {
  const dom = new JSDOM('<div id="root"></div>');
  (global as any).window = dom.window as any;
  (global as any).document = dom.window.document;
  (window as any).topoViewerMode = 'editor';
  resetBaseStylesStub();
  resetNodeUtilsStub();
  resetLoggerStub();
  (topoViewerState as any).editorEngine = {
    layoutAlgoManager: { isGeoMapInitialized: false },
    groupStyleManager: {
      getGroupStyles: () => [{ id: 'g1' }],
      applyStyleToNode: sinon.spy()
    },
    freeTextManager: { reapplyAllFreeTextStyles: sinon.spy() },
    freeShapesManager: { reapplyAllShapeStyles: sinon.spy() }
  } as any;

  const messageSender = {
    sendMessageToVscodeEndpointPost: sinon.stub().resolves({ ok: true })
  };
  const saveManager = new SaveManager(messageSender as any);
  return { dom, messageSender, saveManager };
}

function cleanupSaveManagerContext(dom: JSDOM): void {
  dom.window.close();
  delete (global as any).window;
  delete (global as any).document;
  resetBaseStylesStub();
  resetNodeUtilsStub();
  sinon.restore();
}

describe('SaveManager - saveTopo', () => {

  it('sends filtered nodes and normalized edges to backend', async () => {
    const { dom, messageSender, saveManager } = setupSaveManagerContext();

    const cy = {
      nodes: () => [createNode('keep-me', 'pe'), createNode('skip-free', 'freeText')],
      edges: () => [
        {
          json: () => ({
            data: {
              id: 'e1',
              source: 'keep-me',
              target: 'sp-special',
              sourceEndpoint: 'eth0',
              targetEndpoint: 'ge-0/0/0'
            }
          })
        },
        {
          json: () => ({
            data: {
              id: 'e2',
              source: 'a',
              target: 'b',
              endpoints: ['a:e1', 'b:e2']
            }
          })
        },
        { json: () => ({ data: { id: 'invalid', source: 'a', target: 'b' } }) }
      ]
    };

    try {
      await saveManager.saveTopo(cy as any, false);

      expect(messageSender.sendMessageToVscodeEndpointPost.calledOnce).to.be.true;
      const [endpoint, payload] = messageSender.sendMessageToVscodeEndpointPost.firstCall.args;
      expect(endpoint).to.equal('topo-editor-viewport-save');
      expect(payload).to.have.length(3);
      const edgePayload = payload.filter((el: any) => el.data?.source);
      const firstEdge = edgePayload.find((el: any) => el.data?.id === 'e1');
      expect(firstEdge?.data?.endpoints).to.deep.equal(['keep-me:eth0', 'sp-special']);
      expect(edgePayload.find((el: any) => el.data?.id === 'e2')?.data?.endpoints).to.deep.equal([
        'a:e1',
        'b:e2'
      ]);
      expect(payload.find((el: any) => el.data?.id === 'invalid')).to.be.undefined;

      expect(loadCytoStyleCalls.length).to.equal(1);
      expect(updateNodePositionCalls.length).to.equal(1);
      expect(handleGeoDataCalls.length).to.equal(1);
      const gsm = (topoViewerState as any).editorEngine.groupStyleManager;
      expect(gsm.applyStyleToNode.calledOnceWith('g1')).to.be.true;
    } finally {
      cleanupSaveManagerContext(dom);
    }
  });

  it('skips style reload on suppressNotification and reapplies geo scaling', async () => {
    const { dom, saveManager } = setupSaveManagerContext();
    const layoutAlgoManager = {
      isGeoMapInitialized: true,
      calculateGeoScale: sinon.stub().returns(2),
      applyGeoScale: sinon.spy()
    };
    (topoViewerState as any).editorEngine.layoutAlgoManager = layoutAlgoManager;
    const cy = {
      nodes: () => [createNode('n1', 'pe')],
      edges: () => []
    };

    try {
      await saveManager.saveTopo(cy as any, true);

      expect(loadCytoStyleCalls.length).to.equal(0);
      expect(layoutAlgoManager.applyGeoScale.calledOnceWith(true, 2)).to.be.true;
      expect(updateNodePositionCalls.length).to.equal(1);
      expect(handleGeoDataCalls.length).to.equal(1);
    } finally {
      cleanupSaveManagerContext(dom);
    }
  });
});
