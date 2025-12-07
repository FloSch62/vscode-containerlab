/* eslint-env mocha */
/* eslint-disable no-undef, sonarjs/no-duplicate-string, aggregate-complexity/aggregate-complexity */
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
  if (request.includes('/extension') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  if (request === 'dockerode') {
    return path.join(__dirname, '..', '..', 'helpers', 'dockerode-stub.js');
  }
  return null;
}

describe('Docker utilities', () => {
  let dockerModule: any;
  let extensionStub: any;
  let dockerodeStub: any;
  let vscodeStub: any;

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

    vscodeStub = require('../../helpers/vscode-stub');
    extensionStub = require('../../helpers/extension-stub');
    dockerodeStub = require('../../helpers/dockerode-stub');
    dockerModule = require('../../../src/utils/docker/docker');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    extensionStub.resetExtensionStub();
    dockerodeStub.clearDockerMocks();
    vscodeStub.window.lastErrorMessage = '';
    vscodeStub.window.lastInfoMessage = '';
  });

  describe('checkAndPullDockerImage', () => {
    it('returns false when docker client is unavailable', async () => {
      // Don't set a docker client
      const result = await dockerModule.checkAndPullDockerImage(
        'some-image:latest',
        'missing'
      );
      expect(result).to.be.false;
    });

    it('returns true when image exists locally', async () => {
      // Create a mock docker client
      const Docker = dockerodeStub.default;
      const mockClient = new Docker();
      extensionStub.setDockerClient(mockClient);
      dockerodeStub.setImageExists('test-image:latest', true);

      const result = await dockerModule.checkAndPullDockerImage(
        'test-image:latest',
        'missing'
      );
      expect(result).to.be.true;
    });

    it('returns false when image does not exist and policy is never', async () => {
      const Docker = dockerodeStub.default;
      const mockClient = new Docker();
      extensionStub.setDockerClient(mockClient);
      dockerodeStub.setImageExists('missing-image:latest', false);

      const result = await dockerModule.checkAndPullDockerImage(
        'missing-image:latest',
        'never'
      );
      expect(result).to.be.false;
    });

    it('pulls image when missing and policy is missing', async () => {
      const Docker = dockerodeStub.default;
      const mockClient = new Docker();
      extensionStub.setDockerClient(mockClient);
      dockerodeStub.setImageExists('missing-image:latest', false, false);

      const result = await dockerModule.checkAndPullDockerImage(
        'missing-image:latest',
        'missing'
      );

      // Pull should have been called
      expect(dockerodeStub.getPullCallCount()).to.equal(1);
      expect(result).to.be.true;
    });

    it('pulls image when exists and policy is always', async () => {
      const Docker = dockerodeStub.default;
      const mockClient = new Docker();
      extensionStub.setDockerClient(mockClient);
      dockerodeStub.setImageExists('existing-image:latest', true, false);

      const result = await dockerModule.checkAndPullDockerImage(
        'existing-image:latest',
        'always'
      );

      // Pull should have been called even though image exists
      expect(dockerodeStub.getPullCallCount()).to.equal(1);
      expect(result).to.be.true;
    });

    it('returns false when pull fails', async () => {
      const Docker = dockerodeStub.default;
      const mockClient = new Docker();
      extensionStub.setDockerClient(mockClient);
      // Set image to not exist, and pull should fail
      dockerodeStub.setImageExists('failing-image:latest', false, true);

      const result = await dockerModule.checkAndPullDockerImage(
        'failing-image:latest',
        'missing'
      );

      expect(dockerodeStub.getPullCallCount()).to.equal(1);
      expect(result).to.be.false;
    });
  });

  describe('Container actions', () => {
    it('returns early when docker client is unavailable', async () => {
      // Don't set a docker client
      await dockerModule.startContainer('container-id');
      // Should not throw, just return - verify no error message shown
      expect(vscodeStub.window.lastErrorMessage).to.equal('');
    });

    it('shows error when container ID is nil', async () => {
      const Docker = dockerodeStub.default;
      const mockClient = new Docker();
      extensionStub.setDockerClient(mockClient);

      await dockerModule.startContainer('');

      expect(vscodeStub.window.lastErrorMessage).to.include(
        'Failed to start container'
      );
    });

    it('starts container successfully', async () => {
      const Docker = dockerodeStub.default;
      const mockClient = new Docker();
      extensionStub.setDockerClient(mockClient);
      dockerodeStub.setContainer('test-container', {
        running: false,
        paused: false,
        name: 'test-container'
      });

      await dockerModule.startContainer('test-container');

      expect(vscodeStub.window.lastInfoMessage).to.include('start');
      expect(vscodeStub.window.lastInfoMessage).to.include('Success');
    });

    it('stops container successfully', async () => {
      const Docker = dockerodeStub.default;
      const mockClient = new Docker();
      extensionStub.setDockerClient(mockClient);
      dockerodeStub.setContainer('test-container', {
        running: true,
        paused: false,
        name: 'test-container'
      });

      await dockerModule.stopContainer('test-container');

      expect(vscodeStub.window.lastInfoMessage).to.include('stop');
      expect(vscodeStub.window.lastInfoMessage).to.include('Success');
    });

    it('pauses container successfully', async () => {
      const Docker = dockerodeStub.default;
      const mockClient = new Docker();
      extensionStub.setDockerClient(mockClient);
      dockerodeStub.setContainer('test-container', {
        running: true,
        paused: false,
        name: 'test-container'
      });

      await dockerModule.pauseContainer('test-container');

      expect(vscodeStub.window.lastInfoMessage).to.include('pause');
      expect(vscodeStub.window.lastInfoMessage).to.include('Success');
    });

    it('unpauses container successfully', async () => {
      const Docker = dockerodeStub.default;
      const mockClient = new Docker();
      extensionStub.setDockerClient(mockClient);
      dockerodeStub.setContainer('test-container', {
        running: true,
        paused: true,
        name: 'test-container'
      });

      await dockerModule.unpauseContainer('test-container');

      expect(vscodeStub.window.lastInfoMessage).to.include('unpause');
      expect(vscodeStub.window.lastInfoMessage).to.include('Success');
    });
  });
});
