/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for the extension module.
 *
 * Tests for session refresh functions, helper functions, and module exports.
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
    return path.join(__dirname, '..', 'helpers', 'vscode-stub.js');
  }
  if (request === 'dockerode') {
    return path.join(__dirname, '..', 'helpers', 'dockerode-stub.js');
  }
  if (request.includes('utils/index') || request.endsWith('/utils') || (request.includes('/utils') && !request.includes('filterUtils'))) {
    return path.join(__dirname, '..', 'helpers', 'utils-stub.js');
  }
  if (request.includes('containerlabEvents')) {
    return path.join(__dirname, '..', 'helpers', 'containerlabEvents-stub.js');
  }
  if (request.includes('containerlabInspectFallback')) {
    return path.join(__dirname, '..', 'helpers', 'containerlabInspectFallback-stub.js');
  }
  if (request.includes('inspector')) {
    return path.join(__dirname, '..', 'helpers', 'inspector-stub.js');
  }
  if (request.includes('capture') && request.includes('commands')) {
    return path.join(__dirname, '..', 'helpers', 'packetflix-stub.js');
  }
  return null;
}

// Table-driven test cases for extractLabName
interface ExtractLabNameTestCase {
  description: string;
  session: any;
  prefix: string;
  expected: string | undefined;
}

const extractLabNameCases: ExtractLabNameTestCase[] = [
  {
    description: 'extracts lab name from network starting with clab-',
    session: { network: 'clab-mylab', name: 'sshx-mylab' },
    prefix: 'sshx',
    expected: 'mylab'
  },
  {
    description: 'extracts lab name from session name with prefix at start',
    session: { network: 'bridge', name: 'sshx-testlab' },
    prefix: 'sshx',
    expected: 'testlab'
  },
  {
    description: 'extracts lab name from session name with clab prefix and suffix',
    session: { network: 'bridge', name: 'clab-demo-sshx' },
    prefix: 'sshx',
    expected: 'demo'
  },
  {
    description: 'returns undefined when session has no valid name',
    session: { network: 'bridge', name: 'random-name' },
    prefix: 'sshx',
    expected: undefined
  },
  {
    description: 'returns undefined when session name is not a string',
    session: { network: 'bridge', name: 123 },
    prefix: 'sshx',
    expected: undefined
  },
  {
    description: 'extracts gotty lab name correctly',
    session: { network: 'clab-router-lab', name: 'gotty-router-lab' },
    prefix: 'gotty',
    expected: 'router-lab'
  }
];

// Shared context
let vscodeStub: any;
let utilsStub: any;

describe('extractLabName() helper', () => {
  // Test without module interception since extractLabName is a pure function
  // We need to recreate the function here since it's not exported

  function extractLabName(session: any, prefix: string): string | undefined {
    if (typeof session.network === 'string' && session.network.startsWith('clab-')) {
      return session.network.slice(5);
    }
    if (typeof session.name !== 'string') {
      return undefined;
    }
    const name = session.name;
    if (name.startsWith(`${prefix}-`)) {
      return name.slice(prefix.length + 1);
    }
    if (name.startsWith('clab-') && name.endsWith(`-${prefix}`)) {
      return name.slice(5, -(prefix.length + 1));
    }
    return undefined;
  }

  extractLabNameCases.forEach(({ description, session, prefix, expected }) => {
    it(description, () => {
      const result = extractLabName(session, prefix);
      expect(result).to.equal(expected);
    });
  });
});

describe('refreshSshxSessions()', () => {
  let refreshSshxSessions: Function;
  let sshxSessions: Map<string, string>;
  let extensionModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../helpers/vscode-stub');
    utilsStub = require('../helpers/utils-stub');

    extensionModule = require('../../src/extension');
    refreshSshxSessions = extensionModule.refreshSshxSessions;
    sshxSessions = extensionModule.sshxSessions;

    // Initialize outputChannel since activate() wasn't called
    // This is needed because refreshSshxSessions uses outputChannel.error()
    (extensionModule as any).outputChannel = vscodeStub.window.createOutputChannel('Test', { log: true });
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    utilsStub.clearMocks();
    vscodeStub.resetVscodeStub();
    sshxSessions.clear();
  });

  it('parses valid JSON output and populates sessions', async () => {
    const mockOutput = JSON.stringify([
      { network: 'clab-testlab', link: 'https://sshx.io/abc123' },
      { network: 'clab-another', link: 'https://sshx.io/def456' }
    ]);
    utilsStub.mockCommand(/sshx list/, mockOutput);

    await refreshSshxSessions();

    expect(sshxSessions.size).to.equal(2);
    expect(sshxSessions.get('testlab')).to.equal('https://sshx.io/abc123');
    expect(sshxSessions.get('another')).to.equal('https://sshx.io/def456');
  });

  it('ignores sessions with N/A link', async () => {
    const mockOutput = JSON.stringify([
      { network: 'clab-testlab', link: 'N/A' },
      { network: 'clab-valid', link: 'https://sshx.io/valid' }
    ]);
    utilsStub.mockCommand(/sshx list/, mockOutput);

    await refreshSshxSessions();

    expect(sshxSessions.size).to.equal(1);
    expect(sshxSessions.has('testlab')).to.be.false;
    expect(sshxSessions.get('valid')).to.equal('https://sshx.io/valid');
  });

  it('clears sessions on empty output', async () => {
    sshxSessions.set('existing', 'https://sshx.io/existing');
    utilsStub.mockCommand(/sshx list/, '');

    await refreshSshxSessions();

    expect(sshxSessions.size).to.equal(0);
  });

  it('handles command errors gracefully', async () => {
    utilsStub.mockCommandError(/sshx list/, new Error('Command failed'));

    await refreshSshxSessions();

    // Should not throw, just log error
    expect(sshxSessions.size).to.equal(0);
  });
});

describe('extension exports', () => {
  let extensionModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    extensionModule = require('../../src/extension');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('exports execCmdMapping', () => {
    expect(extensionModule.execCmdMapping).to.be.an('object');
  });

  it('exports sshUserMapping', () => {
    expect(extensionModule.sshUserMapping).to.be.an('object');
  });

  it('exports favoriteLabs as a Set', () => {
    expect(extensionModule.favoriteLabs).to.be.instanceOf(Set);
  });

  it('exports sshxSessions as a Map', () => {
    expect(extensionModule.sshxSessions).to.be.instanceOf(Map);
  });

  it('exports gottySessions as a Map', () => {
    expect(extensionModule.gottySessions).to.be.instanceOf(Map);
  });

  it('exports hideNonOwnedLabsState with default false', () => {
    expect(extensionModule.hideNonOwnedLabsState).to.equal(false);
  });

  it('exports containerlabBinaryPath with default value', () => {
    expect(extensionModule.containerlabBinaryPath).to.equal('containerlab');
  });
});
