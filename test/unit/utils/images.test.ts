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

before(() => {
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
});

after(() => {
  (Module as any)._resolveFilename = originalResolve;
  clearModuleCache();
});

beforeEach(() => {
  extensionStub.resetExtensionStub();
  dockerodeStub.clearDockerMocks();
});

describe('Docker images module', () => {
  describe('getDockerImages()', () => {
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

  describe('refreshDockerImages()', () => {
    it('does not throw when docker client is unavailable', async () => {
      // Don't set a docker client
      const images = await imagesModule.refreshDockerImages();
      expect(imagesModule.getDockerImages()).to.deep.equal([]);
      expect(images).to.be.undefined;
    });

    it('updates cache when docker client is available', async () => {
      const Docker = dockerodeStub.default;
      const mockClient = new Docker();

      // Add a listImages method to the mock
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

  describe('onDockerImagesUpdated', () => {
    it('is an event emitter', () => {
      expect(imagesModule.onDockerImagesUpdated).to.be.a('function');
    });
  });
});
