/* eslint-env mocha */
/* global describe, it, before, after, __dirname */
/**
 * Edge case tests for utils.ts sanitize function.
 * Covers truncation logic, empty results, and special character combinations.
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
  if (request.includes('extension') && !request.includes('stub') && !request.includes('.test')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  return null;
}

let utilsModule: any;

describe('sanitize() - empty and null inputs', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('returns "container" for empty string', () => {
    expect(utilsModule.sanitize('')).to.equal('container');
  });

  it('returns "c-" for string of only dashes (empty after trim gets c- prefix)', () => {
    // After trimming dashes, empty string gets c- prefix
    const result = utilsModule.sanitize('---');
    expect(result).to.equal('c-');
  });

  it('returns "c-" for string of only dots (empty after trim gets c- prefix)', () => {
    const result = utilsModule.sanitize('...');
    expect(result).to.equal('c-');
  });

  it('returns "c-" when all chars become separators then trimmed', () => {
    // All special chars become dashes, then leading/trailing removed, c- prefix added
    const result = utilsModule.sanitize('!!!');
    // !!! -> --- -> (trimmed) empty -> c- prefix -> "c-"
    expect(result).to.equal('c-');
  });
});

describe('sanitize() - leading/trailing separator removal', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('removes multiple leading dashes', () => {
    expect(utilsModule.sanitize('----name')).to.equal('name');
  });

  it('removes multiple trailing dashes', () => {
    expect(utilsModule.sanitize('name----')).to.equal('name');
  });

  it('removes multiple leading dots', () => {
    expect(utilsModule.sanitize('....name')).to.equal('name');
  });

  it('removes multiple trailing dots', () => {
    expect(utilsModule.sanitize('name....')).to.equal('name');
  });

  it('removes mixed leading dots and dashes', () => {
    expect(utilsModule.sanitize('.-.-name')).to.equal('name');
  });

  it('removes mixed trailing dots and dashes', () => {
    expect(utilsModule.sanitize('name.-.-')).to.equal('name');
  });

  it('removes both leading and trailing separators', () => {
    expect(utilsModule.sanitize('---name---')).to.equal('name');
  });

  it('removes both leading and trailing dots', () => {
    expect(utilsModule.sanitize('...name...')).to.equal('name');
  });
});

describe('sanitize() - non-alphanumeric start', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('adds c- prefix for underscore start', () => {
    expect(utilsModule.sanitize('_name')).to.equal('c-_name');
  });

  it('does not add prefix for letter start', () => {
    expect(utilsModule.sanitize('name')).to.equal('name');
  });

  it('does not add prefix for number start', () => {
    expect(utilsModule.sanitize('123name')).to.equal('123name');
  });

  it('adds c- prefix when result starts with underscore after trimming', () => {
    // "---_name" -> after removing leading dashes -> "_name" -> "c-_name"
    expect(utilsModule.sanitize('---_name')).to.equal('c-_name');
  });
});

describe('sanitize() - maxLen truncation', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('truncates to default 128 chars', () => {
    const long = 'A'.repeat(200);
    const result = utilsModule.sanitize(long);
    expect(result.length).to.equal(128);
  });

  it('truncates to custom maxLen', () => {
    const long = 'A'.repeat(50);
    const result = utilsModule.sanitize(long, { maxLen: 20 });
    expect(result.length).to.equal(20);
  });

  it('removes trailing dash after truncation', () => {
    // Create string that will have dash at position 10
    const input = 'A'.repeat(9) + '-B';
    const result = utilsModule.sanitize(input, { maxLen: 10 });
    expect(result).to.not.match(/-$/);
  });

  it('removes trailing dot after truncation', () => {
    const input = 'A'.repeat(9) + '.B';
    const result = utilsModule.sanitize(input, { maxLen: 10 });
    expect(result).to.not.match(/\.$/);
  });

  it('removes multiple trailing separators after truncation', () => {
    // Create a long string where truncation leaves trailing dashes
    const input = 'name' + '-'.repeat(50);
    const result = utilsModule.sanitize(input, { maxLen: 10 });
    expect(result).to.not.match(/[-.]$/);
    expect(result).to.equal('name');
  });

  it('handles truncation that results in empty string', () => {
    // All dashes, maxLen cuts, then trimming makes empty
    const input = 'A' + '-'.repeat(100);
    const result = utilsModule.sanitize(input, { maxLen: 5 });
    expect(result.length).to.be.greaterThan(0);
  });
});

describe('sanitize() - lowercase option', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('preserves case by default', () => {
    expect(utilsModule.sanitize('MixedCase')).to.equal('MixedCase');
  });

  it('converts to lowercase when lower=true', () => {
    expect(utilsModule.sanitize('MixedCase', { lower: true })).to.equal('mixedcase');
  });

  it('applies lowercase after all other transformations', () => {
    expect(utilsModule.sanitize('---MixedCase---', { lower: true })).to.equal('mixedcase');
  });

  it('applies lowercase to c- prefix', () => {
    expect(utilsModule.sanitize('_NAME', { lower: true })).to.equal('c-_name');
  });
});

describe('sanitize() - character replacement', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('replaces forward slash with dash', () => {
    expect(utilsModule.sanitize('a/b')).to.equal('a-b');
  });

  it('replaces colon with dash', () => {
    expect(utilsModule.sanitize('a:b')).to.equal('a-b');
  });

  it('replaces @ with dash', () => {
    expect(utilsModule.sanitize('a@b')).to.equal('a-b');
  });

  it('replaces multiple consecutive special chars with single dash', () => {
    expect(utilsModule.sanitize('a/@:b')).to.equal('a-b');
  });

  it('preserves underscores', () => {
    expect(utilsModule.sanitize('a_b_c')).to.equal('a_b_c');
  });

  it('preserves dots in middle', () => {
    expect(utilsModule.sanitize('a.b.c')).to.equal('a.b.c');
  });

  it('preserves dashes in middle', () => {
    expect(utilsModule.sanitize('a-b-c')).to.equal('a-b-c');
  });

  it('handles complex input with multiple transformations', () => {
    const result = utilsModule.sanitize('---test@name.123---', { lower: true });
    expect(result).to.equal('test-name.123');
  });
});

describe('sanitize() - combined options', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('applies both maxLen and lower', () => {
    const result = utilsModule.sanitize('ABCDEFGHIJ', { maxLen: 5, lower: true });
    expect(result).to.equal('abcde');
    expect(result.length).to.equal(5);
  });

  it('uses default options when none provided', () => {
    const result = utilsModule.sanitize('TestName');
    expect(result).to.equal('TestName');
  });

  it('handles empty options object', () => {
    const result = utilsModule.sanitize('TestName', {});
    expect(result).to.equal('TestName');
  });
});
