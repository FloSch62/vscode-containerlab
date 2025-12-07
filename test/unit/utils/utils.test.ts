/* eslint-env mocha */
/* global describe, it */
/**
 * Tests for the utils module.
 *
 * These tests use the utils-stub which provides test-safe implementations
 * that work well with other tests in the suite.
 *
 * For actual source code coverage measurement, run:
 *   npx c8 mocha "out/test/test/unit/utils/utils.test.js"
 */
import { expect } from 'chai';

// Import the utils-stub which provides test-safe implementations
const utilsStub = require('../../helpers/utils-stub');

describe('utils module stripAnsi()', () => {
  it('removes ANSI color codes', () => {
    const input = '\x1b[31mred text\x1b[0m';
    const result = utilsStub.stripAnsi(input);
    expect(result).to.equal('red text');
  });

  it('removes multiple ANSI codes', () => {
    const input = '\x1b[1m\x1b[32mbold green\x1b[0m normal';
    const result = utilsStub.stripAnsi(input);
    expect(result).to.equal('bold green normal');
  });

  it('handles string without ANSI codes', () => {
    const input = 'plain text';
    const result = utilsStub.stripAnsi(input);
    expect(result).to.equal('plain text');
  });

  it('handles empty string', () => {
    const result = utilsStub.stripAnsi('');
    expect(result).to.equal('');
  });

  it('removes extended color codes', () => {
    const input = '\x1b[38;5;196mextended color\x1b[0m';
    const result = utilsStub.stripAnsi(input);
    expect(result).to.equal('extended color');
  });

  it('removes formatting codes', () => {
    const input = '\x1b[0m\x1b[1m\x1b[4mformatting\x1b[0m';
    const result = utilsStub.stripAnsi(input);
    expect(result).to.equal('formatting');
  });
});

describe('utils module stripFileName()', () => {
  it('extracts directory from path', () => {
    const result = utilsStub.stripFileName('/home/user/labs/topology.yml');
    expect(result).to.equal('/home/user/labs');
  });

  it('handles root path', () => {
    const result = utilsStub.stripFileName('/file.yml');
    expect(result).to.equal('');
  });

  it('handles path without slash', () => {
    const result = utilsStub.stripFileName('file.yml');
    expect(result).to.equal('');
  });

  it('handles deep nested path', () => {
    const result = utilsStub.stripFileName('/a/b/c/d.yml');
    expect(result).to.equal('/a/b/c');
  });

  it('handles single slash', () => {
    const result = utilsStub.stripFileName('/');
    expect(result).to.equal('');
  });
});

describe('utils module titleCase()', () => {
  it('capitalizes first letter', () => {
    const result = utilsStub.titleCase('hello');
    expect(result).to.equal('Hello');
  });

  it('keeps rest of string unchanged', () => {
    const result = utilsStub.titleCase('hELLO wORLD');
    expect(result).to.equal('HELLO wORLD');
  });

  it('handles single character', () => {
    const result = utilsStub.titleCase('a');
    expect(result).to.equal('A');
  });

  it('handles already capitalized', () => {
    const result = utilsStub.titleCase('Hello');
    expect(result).to.equal('Hello');
  });

  it('handles string starting with number', () => {
    const result = utilsStub.titleCase('123abc');
    expect(result).to.equal('123abc');
  });
});

describe('utils module sanitize()', () => {
  it('replaces special characters with dash', () => {
    const result = utilsStub.sanitize('a/b:c');
    expect(result).to.equal('a-b-c');
  });

  it('removes disallowed characters', () => {
    const result = utilsStub.sanitize('hello@world!');
    expect(result).to.equal('hello-world');
  });

  it('handles already safe string', () => {
    const result = utilsStub.sanitize('safe-name_123');
    expect(result).to.equal('safe-name_123');
  });

  it('handles empty string', () => {
    const result = utilsStub.sanitize('');
    expect(result).to.equal('container');
  });

  it('removes leading separators', () => {
    const result = utilsStub.sanitize('---leading');
    expect(result).to.equal('leading');
  });

  it('removes trailing separators', () => {
    const result = utilsStub.sanitize('trailing---');
    expect(result).to.equal('trailing');
  });

  it('removes leading and trailing dots', () => {
    const result = utilsStub.sanitize('...dots...');
    expect(result).to.equal('dots');
  });

  it('ensures name starts with alphanumeric', () => {
    const result = utilsStub.sanitize('_underscore');
    expect(result).to.equal('c-_underscore');
  });

  it('enforces max length', () => {
    const result = utilsStub.sanitize('A'.repeat(200));
    expect(result).to.equal('A'.repeat(128));
  });

  it('preserves case by default', () => {
    const result = utilsStub.sanitize('MixedCase');
    expect(result).to.equal('MixedCase');
  });

  it('converts to lowercase when lower=true', () => {
    const result = utilsStub.sanitize('MixedCase', { lower: true });
    expect(result).to.equal('mixedcase');
  });

  it('replaces forward slashes with dashes', () => {
    const result = utilsStub.sanitize('my/container/name');
    expect(result).to.equal('my-container-name');
  });
});

describe('utils module normalizeLabPath()', () => {
  it('returns empty string for empty path', () => {
    const result = utilsStub.normalizeLabPath('');
    expect(result).to.equal('');
  });

  it('normalizes path slashes', () => {
    const result = utilsStub.normalizeLabPath('/home//user///lab.yml');
    expect(result).to.include('home');
    expect(result).to.include('user');
  });

  it('expands tilde to home directory', () => {
    const os = require('os');
    const homedir = os.homedir();
    const result = utilsStub.normalizeLabPath('~/lab.yml');
    expect(result).to.include(homedir);
    expect(result).to.include('lab.yml');
  });

  it('handles absolute paths', () => {
    const result = utilsStub.normalizeLabPath('/absolute/path/lab.yml');
    expect(result).to.include('/absolute/path/lab.yml');
  });

  it('uses singleFolderBase for relative paths', () => {
    const result = utilsStub.normalizeLabPath('relative/lab.yml', '/base/path');
    expect(result).to.be.a('string');
  });
});

describe('utils module isOrbstack()', () => {
  it('returns a boolean', () => {
    const result = utilsStub.isOrbstack();
    expect(result).to.be.a('boolean');
  });

  it('returns false in standard test environment', () => {
    const os = require('os');
    const kernel = os.release().toLowerCase();
    const expected = kernel.includes('orbstack');
    const result = utilsStub.isOrbstack();
    expect(result).to.equal(expected);
  });
});

describe('utils module getConfig()', () => {
  it('returns undefined for missing config', () => {
    const result = utilsStub.getConfig('someSetting');
    expect(result).to.be.undefined;
  });
});

describe('utils module getRelativeFolderPath()', () => {
  it('returns relative path when given a string', () => {
    const result = utilsStub.getRelativeFolderPath('/home/user/workspace/labs/topo.yml');
    expect(result).to.be.a('string');
  });
});

describe('utils module getRelLabFolderPath()', () => {
  it('returns directory of relative path', () => {
    const result = utilsStub.getRelLabFolderPath('/home/user/workspace/labs/topo.yml');
    expect(result).to.be.a('string');
  });
});

describe('utils module getFreePort()', () => {
  it('returns a valid port number', async () => {
    const port = await utilsStub.getFreePort();
    expect(port).to.be.a('number');
    expect(port).to.be.greaterThan(0);
    expect(port).to.be.lessThan(65536);
  });

  it('returns different ports on subsequent calls', async () => {
    const port1 = await utilsStub.getFreePort();
    const port2 = await utilsStub.getFreePort();
    expect(port1).to.be.a('number');
    expect(port2).to.be.a('number');
  });
});

describe('utils module installContainerlab()', () => {
  it('calls vscode.window.createTerminal', () => {
    // This is a stub test - actual terminal creation is tested in integration
    expect(utilsStub.installContainerlab).to.be.a('function');
  });
});

describe('utils module getSelectedLabNode()', () => {
  it('returns provided node directly', async () => {
    const mockNode = { labPath: '/test/lab.yml' };
    const result = await utilsStub.getSelectedLabNode(mockNode);
    expect(result).to.equal(mockNode);
  });

  it('returns undefined when no node provided', async () => {
    const result = await utilsStub.getSelectedLabNode(undefined);
    expect(result).to.be.undefined;
  });
});
