/* eslint-env mocha */
/* eslint-disable no-undef */
/**
 * Tests for the docker images module.
 *
 * Tests image caching, fetching, and event monitoring functionality.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;

let imagesModule: any;
let extensionStub: any;
let dockerodeStub: any;

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
  if (request.includes('/extension') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  if (request === 'dockerode') {
    return path.join(__dirname, '..', '..', 'helpers', 'dockerode-stub.js');
  }
  return null;
}

function setupModules() {
  clearModuleCache();
  (Module as any)._resolveFilename = function(
    request: string,
    parent: any,
    isMain: boolean,
    options: any
  ) {
    const stubPath = getStubPath(request);
    if (stubPath) {
      return stubPath;
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };

  extensionStub = require('../../helpers/extension-stub');
  dockerodeStub = require('../../helpers/dockerode-stub');
  imagesModule = require('../../../src/utils/docker/images');
}

function cleanupModules() {
  (Module as any)._resolveFilename = originalResolve;
  clearModuleCache();
}

function resetStubs() {
  extensionStub.resetExtensionStub();
  dockerodeStub.clearDockerMocks();
}

describe('getDockerImages() - cache access', () => {
  before(setupModules);
  after(cleanupModules);
  beforeEach(resetStubs);

  it('returns empty array initially', () => {
    const result = imagesModule.getDockerImages();
    expect(result).to.be.an('array');
  });

  it('returns a copy of the cache, not the original', () => {
    const result1 = imagesModule.getDockerImages();
    const result2 = imagesModule.getDockerImages();
    expect(result1).to.not.equal(result2);
    expect(result1).to.deep.equal(result2);
  });
});

describe('refreshDockerImages() - basic functionality', () => {
  before(setupModules);
  after(cleanupModules);
  beforeEach(resetStubs);

  it('does not throw when docker client is unavailable', async () => {
    const images = await imagesModule.refreshDockerImages();
    expect(imagesModule.getDockerImages()).to.deep.equal([]);
    expect(images).to.be.undefined;
  });

  it('updates cache when docker client is available', async () => {
    const Docker = dockerodeStub.default;
    const mockClient = new Docker();

    mockClient.listImages = async () => [
      { RepoTags: ['test-image:latest'], Created: Date.now() / 1000 },
      { RepoTags: ['another-image:v1'], Created: Date.now() / 1000 - 1000 }
    ];

    extensionStub.setDockerClient(mockClient);

    await imagesModule.refreshDockerImages();

    const images = imagesModule.getDockerImages();
    expect(images).to.include('test-image:latest');
    expect(images).to.include('another-image:v1');
  });
});

describe('refreshDockerImages() - filtering', () => {
  before(setupModules);
  after(cleanupModules);
  beforeEach(resetStubs);

  it('filters out invalid tags', async () => {
    const Docker = dockerodeStub.default;
    const mockClient = new Docker();

    mockClient.listImages = async () => [
      { RepoTags: ['valid:tag'], Created: Date.now() / 1000 },
      { RepoTags: ['<none>:<none>'], Created: Date.now() / 1000 },
      { RepoTags: ['image:<none>'], Created: Date.now() / 1000 },
      { RepoTags: null, Created: Date.now() / 1000 }
    ];

    extensionStub.setDockerClient(mockClient);

    await imagesModule.refreshDockerImages();

    const images = imagesModule.getDockerImages();
    expect(images).to.include('valid:tag');
    expect(images).to.not.include('<none>:<none>');
    expect(images).to.not.include('image:<none>');
  });
});

describe('refreshDockerImages() - error handling', () => {
  before(setupModules);
  after(cleanupModules);
  beforeEach(resetStubs);

  it('handles errors gracefully without throwing', async () => {
    const Docker = dockerodeStub.default;
    const mockClient = new Docker();

    mockClient.listImages = async () => {
      throw new Error('Docker API error');
    };

    extensionStub.setDockerClient(mockClient);

    await imagesModule.refreshDockerImages();
    expect(imagesModule.getDockerImages()).to.be.an('array');
  });
});

describe('onDockerImagesUpdated - event emitter', () => {
  before(setupModules);
  after(cleanupModules);
  beforeEach(resetStubs);

  it('is an event emitter', () => {
    expect(imagesModule.onDockerImagesUpdated).to.be.a('function');
  });
});

describe('startDockerImageEventMonitor() - initialization', () => {
  before(setupModules);
  after(cleanupModules);
  beforeEach(resetStubs);

  it('does nothing when docker client is unavailable', () => {
    extensionStub.setDockerClient(null);
    const mockContext = { subscriptions: [] };

    imagesModule.startDockerImageEventMonitor(mockContext);
    expect(mockContext.subscriptions.length).to.equal(0);
  });
});

describe('startDockerImageEventMonitor() - event handling', () => {
  before(setupModules);
  after(cleanupModules);
  beforeEach(resetStubs);

  it('registers event handler when docker client is available', async () => {
    const Docker = dockerodeStub.default;
    const mockClient = new Docker();

    const mockStream = {
      listeners: {} as Record<string, Function[]>,
      on(event: string, handler: Function) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(handler);
      },
      off(event: string, handler: Function) {
        if (this.listeners[event]) {
          const idx = this.listeners[event].indexOf(handler);
          if (idx >= 0) this.listeners[event].splice(idx, 1);
        }
      },
      removeAllListeners() {
        this.listeners = {};
      }
    };

    mockClient.getEvents = async () => mockStream;
    mockClient.listImages = async () => [];

    extensionStub.setDockerClient(mockClient);

    const mockContext = { subscriptions: [] as any[] };
    imagesModule.startDockerImageEventMonitor(mockContext);

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockStream.listeners['data']).to.have.length(1);
    expect(mockStream.listeners['error']).to.have.length(1);
  });
});

describe('startDockerImageEventMonitor() - error handling', () => {
  before(setupModules);
  after(cleanupModules);
  beforeEach(resetStubs);

  it('handles getEvents errors gracefully', async () => {
    const Docker = dockerodeStub.default;
    const mockClient = new Docker();

    mockClient.getEvents = async () => {
      throw new Error('Failed to get events');
    };

    extensionStub.setDockerClient(mockClient);

    const mockContext = { subscriptions: [] as any[] };

    imagesModule.startDockerImageEventMonitor(mockContext);
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockContext.subscriptions.length).to.equal(0);
  });
});
