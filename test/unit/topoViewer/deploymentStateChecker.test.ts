/* eslint-env mocha */
/* eslint-disable no-undef, sonarjs/no-duplicate-string */
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
  if (request.includes('/inspector') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'inspector-stub.js');
  }
  if (request.endsWith('logging/logger')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extensionLogger-stub.js');
  }
  return null;
}

/**
 * Helper to create inspect data with topo-file metadata attached to the array
 */
function createLabData(topoFile?: string): Record<string, any> {
  const result: Record<string, any> = { containers: [] };
  if (topoFile) {
    result['topo-file'] = topoFile;
  }
  return result;
}

describe('DeploymentStateChecker - checkDeploymentState - deployed by name', () => {
  let DeploymentStateChecker: any;
  let inspectorStub: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    inspectorStub = require('../../helpers/inspector-stub');
    const module = require('../../../src/topoViewer/extension/services/DeploymentStateChecker');
    DeploymentStateChecker = module.DeploymentStateChecker;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    inspectorStub.resetForTests();
  });

  it('returns deployed when lab name exists in rawInspectData', async () => {
    const checker = new DeploymentStateChecker();
    inspectorStub.setRawInspectData({
      'my-lab': createLabData('/home/user/labs/my-lab.clab.yml')
    });

    const state = await checker.checkDeploymentState('my-lab', undefined);
    expect(state).to.equal('deployed');
  });

  it('returns deployed for lab name match regardless of topoFilePath', async () => {
    const checker = new DeploymentStateChecker();
    inspectorStub.setRawInspectData({
      'test-lab': createLabData('/path/to/actual.clab.yml')
    });

    const state = await checker.checkDeploymentState('test-lab', '/different/path.clab.yml');
    expect(state).to.equal('deployed');
  });

  it('does not call updateLabName when lab found by name', async () => {
    const checker = new DeploymentStateChecker();
    inspectorStub.setRawInspectData({
      'existing-lab': createLabData('/labs/existing.clab.yml')
    });

    let called = false;
    const updateLabName = () => { called = true; };

    await checker.checkDeploymentState('existing-lab', '/labs/existing.clab.yml', updateLabName);
    expect(called).to.be.false;
  });
});

describe('DeploymentStateChecker - checkDeploymentState - deployed by topo-file', () => {
  let DeploymentStateChecker: any;
  let inspectorStub: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    inspectorStub = require('../../helpers/inspector-stub');
    const module = require('../../../src/topoViewer/extension/services/DeploymentStateChecker');
    DeploymentStateChecker = module.DeploymentStateChecker;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    inspectorStub.resetForTests();
  });

  it('returns deployed when topo-file matches', async () => {
    const checker = new DeploymentStateChecker();
    inspectorStub.setRawInspectData({
      'actual-lab-name': createLabData('/home/user/labs/topology.clab.yml')
    });

    const state = await checker.checkDeploymentState(
      'wrong-name',
      '/home/user/labs/topology.clab.yml'
    );
    expect(state).to.equal('deployed');
  });

  it('calls updateLabName when lab found by topo-file with different name', async () => {
    const checker = new DeploymentStateChecker();
    inspectorStub.setRawInspectData({
      'correct-lab-name': createLabData('/labs/test.clab.yml')
    });

    let updatedName: string | undefined;
    const updateLabName = (name: string) => { updatedName = name; };

    const state = await checker.checkDeploymentState(
      'incorrect-name',
      '/labs/test.clab.yml',
      updateLabName
    );

    expect(state).to.equal('deployed');
    expect(updatedName).to.equal('correct-lab-name');
  });

  it('does not call updateLabName when names already match', async () => {
    const checker = new DeploymentStateChecker();
    inspectorStub.setRawInspectData({
      'same-name': createLabData('/labs/topology.clab.yml')
    });

    let called = false;
    const updateLabName = () => { called = true; };

    await checker.checkDeploymentState(
      'same-name',
      '/labs/topology.clab.yml',
      updateLabName
    );

    expect(called).to.be.false;
  });

  it('handles multiple labs and finds correct one by topo-file', async () => {
    const checker = new DeploymentStateChecker();
    inspectorStub.setRawInspectData({
      'lab-alpha': createLabData('/labs/alpha.clab.yml'),
      'lab-beta': createLabData('/labs/beta.clab.yml'),
      'lab-gamma': createLabData('/labs/gamma.clab.yml')
    });

    let updatedName: string | undefined;
    const updateLabName = (name: string) => { updatedName = name; };

    const state = await checker.checkDeploymentState(
      'wrong-name',
      '/labs/beta.clab.yml',
      updateLabName
    );

    expect(state).to.equal('deployed');
    expect(updatedName).to.equal('lab-beta');
  });
});

describe('DeploymentStateChecker - checkDeploymentState - undeployed', () => {
  let DeploymentStateChecker: any;
  let inspectorStub: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    inspectorStub = require('../../helpers/inspector-stub');
    const module = require('../../../src/topoViewer/extension/services/DeploymentStateChecker');
    DeploymentStateChecker = module.DeploymentStateChecker;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    inspectorStub.resetForTests();
  });

  it('returns undeployed when lab name not found', async () => {
    const checker = new DeploymentStateChecker();
    inspectorStub.setRawInspectData({
      'other-lab': createLabData('/labs/other.clab.yml')
    });

    const state = await checker.checkDeploymentState('missing-lab', undefined);
    expect(state).to.equal('undeployed');
  });

  it('returns undeployed when topo-file not found', async () => {
    const checker = new DeploymentStateChecker();
    inspectorStub.setRawInspectData({
      'existing-lab': createLabData('/labs/existing.clab.yml')
    });

    const state = await checker.checkDeploymentState(
      'new-lab',
      '/labs/nonexistent.clab.yml'
    );
    expect(state).to.equal('undeployed');
  });

  it('returns undeployed when both name and topo-file do not match', async () => {
    const checker = new DeploymentStateChecker();
    inspectorStub.setRawInspectData({
      'lab-a': createLabData('/labs/a.clab.yml'),
      'lab-b': createLabData('/labs/b.clab.yml')
    });

    const state = await checker.checkDeploymentState(
      'lab-c',
      '/labs/c.clab.yml'
    );
    expect(state).to.equal('undeployed');
  });

  it('returns undeployed with empty rawInspectData object', async () => {
    const checker = new DeploymentStateChecker();
    inspectorStub.setRawInspectData({});

    const state = await checker.checkDeploymentState('any-lab', '/any/path.clab.yml');
    expect(state).to.equal('undeployed');
  });
});

describe('DeploymentStateChecker - checkDeploymentState - unknown', () => {
  let DeploymentStateChecker: any;
  let inspectorStub: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    inspectorStub = require('../../helpers/inspector-stub');
    const module = require('../../../src/topoViewer/extension/services/DeploymentStateChecker');
    DeploymentStateChecker = module.DeploymentStateChecker;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    inspectorStub.resetForTests();
  });

  it('returns unknown when rawInspectData is undefined', async () => {
    const checker = new DeploymentStateChecker();
    inspectorStub.setRawInspectData(undefined);

    const state = await checker.checkDeploymentState('test-lab', '/path/test.clab.yml');
    expect(state).to.equal('unknown');
  });

  it('returns unknown when rawInspectData is null', async () => {
    const checker = new DeploymentStateChecker();
    inspectorStub.setRawInspectData(null as any);

    const state = await checker.checkDeploymentState('test-lab', undefined);
    expect(state).to.equal('unknown');
  });
});

describe('DeploymentStateChecker - findLabByTopoFile - path normalization', () => {
  let DeploymentStateChecker: any;
  let inspectorStub: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    inspectorStub = require('../../helpers/inspector-stub');
    const module = require('../../../src/topoViewer/extension/services/DeploymentStateChecker');
    DeploymentStateChecker = module.DeploymentStateChecker;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    inspectorStub.resetForTests();
  });

  const pathTestCases = [
    {
      name: 'matches Windows-style backslash path with forward slash input',
      storedPath: 'C:\\Users\\test\\labs\\topology.clab.yml',
      queryPath: 'C:/Users/test/labs/topology.clab.yml',
      shouldMatch: true
    },
    {
      name: 'matches forward slash path with Windows-style backslash input',
      storedPath: '/home/user/labs/topology.clab.yml',
      queryPath: '\\home\\user\\labs\\topology.clab.yml',
      shouldMatch: true
    },
    {
      name: 'matches identical Unix paths',
      storedPath: '/home/user/labs/test.clab.yml',
      queryPath: '/home/user/labs/test.clab.yml',
      shouldMatch: true
    },
    {
      name: 'matches identical Windows paths',
      storedPath: 'C:\\labs\\test.clab.yml',
      queryPath: 'C:\\labs\\test.clab.yml',
      shouldMatch: true
    },
    {
      name: 'does not match different paths after normalization',
      storedPath: '/home/user/labs/alpha.clab.yml',
      queryPath: '/home/user/labs/beta.clab.yml',
      shouldMatch: false
    },
    {
      name: 'matches mixed separator styles in same path',
      storedPath: 'C:\\Users/test\\labs/topology.clab.yml',
      queryPath: 'C:/Users\\test/labs\\topology.clab.yml',
      shouldMatch: true
    }
  ];

  pathTestCases.forEach(testCase => {
    it(testCase.name, async () => {
      const checker = new DeploymentStateChecker();
      inspectorStub.setRawInspectData({
        'test-lab': createLabData(testCase.storedPath)
      });

      const state = await checker.checkDeploymentState('wrong-name', testCase.queryPath);

      if (testCase.shouldMatch) {
        expect(state).to.equal('deployed');
      } else {
        expect(state).to.equal('undeployed');
      }
    });
  });

  it('handles lab entries without topo-file field', async () => {
    const checker = new DeploymentStateChecker();
    inspectorStub.setRawInspectData({
      'lab-no-topo': createLabData(), // No topo-file
      'lab-with-topo': createLabData('/labs/test.clab.yml')
    });

    // Should skip lab without topo-file and find the one with matching topo-file
    const state = await checker.checkDeploymentState('unknown', '/labs/test.clab.yml');
    expect(state).to.equal('deployed');
  });

  it('returns undeployed when all labs lack topo-file field', async () => {
    const checker = new DeploymentStateChecker();
    inspectorStub.setRawInspectData({
      'lab-1': createLabData(), // No topo-file
      'lab-2': createLabData()  // No topo-file
    });

    const state = await checker.checkDeploymentState('unknown', '/labs/test.clab.yml');
    expect(state).to.equal('undeployed');
  });
});

describe('DeploymentStateChecker - singleton export', () => {
  let deploymentStateChecker: any;
  let DeploymentStateChecker: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    require('../../helpers/inspector-stub');
    const module = require('../../../src/topoViewer/extension/services/DeploymentStateChecker');
    DeploymentStateChecker = module.DeploymentStateChecker;
    deploymentStateChecker = module.deploymentStateChecker;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('exports deploymentStateChecker singleton', () => {
    expect(deploymentStateChecker).to.exist;
    expect(deploymentStateChecker).to.be.instanceOf(DeploymentStateChecker);
  });

  it('singleton is consistent across imports', () => {
    // Re-require to verify same instance
    const module2 = require('../../../src/topoViewer/extension/services/DeploymentStateChecker');
    const checker2 = module2.deploymentStateChecker;

    expect(checker2).to.equal(deploymentStateChecker);
  });

  it('singleton has checkDeploymentState method', () => {
    expect(deploymentStateChecker.checkDeploymentState).to.be.a('function');
  });
});
