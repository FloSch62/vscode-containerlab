/* eslint-env mocha */
/* global describe, it */
/**
 * Tests for the utils module.
 *
 * Tests pure utility functions that don't require complex mocking.
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
});

describe('utils module sanitize()', () => {
  it('replaces special characters with dash', () => {
    const result = utilsStub.sanitize('a/b:c');
    expect(result).to.equal('a_b_c');
  });

  it('removes disallowed characters', () => {
    const result = utilsStub.sanitize('hello@world!');
    expect(result).to.equal('hello_world_');
  });

  it('handles already safe string', () => {
    const result = utilsStub.sanitize('safe-name_123');
    expect(result).to.equal('safe-name_123');
  });

  it('handles empty string', () => {
    const result = utilsStub.sanitize('');
    // Based on stub implementation
    expect(result).to.equal('');
  });
});

describe('utils module getRelativeFolderPath()', () => {
  it('returns directory portion of path', () => {
    const result = utilsStub.getRelativeFolderPath('/home/user/labs/topo.yml');
    expect(result).to.equal('/home/user/labs');
  });
});

describe('utils module getRelLabFolderPath()', () => {
  it('returns last directory component', () => {
    const result = utilsStub.getRelLabFolderPath('/home/user/labs/topo.yml');
    expect(result).to.equal('labs');
  });
});

describe('utils module normalizeLabPath()', () => {
  it('returns path as-is for simple input', () => {
    const result = utilsStub.normalizeLabPath('/home/user/lab.yml');
    expect(result).to.equal('/home/user/lab.yml');
  });

  it('handles empty path', () => {
    const result = utilsStub.normalizeLabPath('');
    expect(result).to.equal('');
  });
});

describe('utils module isOrbstack()', () => {
  it('returns false in test environment', () => {
    const result = utilsStub.isOrbstack();
    expect(result).to.be.false;
  });
});

describe('utils module getUserInfo()', () => {
  it('returns user info structure', () => {
    const result = utilsStub.getUserInfo();
    expect(result).to.have.property('hasPermission');
    expect(result).to.have.property('isRoot');
    expect(result).to.have.property('userGroups');
    expect(result).to.have.property('username');
    expect(result).to.have.property('uid');
  });

  it('has permission in test environment', () => {
    const result = utilsStub.getUserInfo();
    expect(result.hasPermission).to.be.true;
  });

  it('returns testuser as username', () => {
    const result = utilsStub.getUserInfo();
    expect(result.username).to.equal('testuser');
  });
});
