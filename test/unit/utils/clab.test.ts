/* eslint-env mocha */
/* global describe, it */
/**
 * Tests for the clab utility module.
 */
import { expect } from 'chai';
import { isClabYamlFile } from '../../../src/utils/clab';

describe('isClabYamlFile() - valid clab files', () => {
  it('returns true for .clab.yml extension', () => {
    expect(isClabYamlFile('topology.clab.yml')).to.be.true;
  });

  it('returns true for .clab.yaml extension', () => {
    expect(isClabYamlFile('topology.clab.yaml')).to.be.true;
  });

  it('returns true for paths with .clab.yml', () => {
    expect(isClabYamlFile('/home/user/labs/my-lab.clab.yml')).to.be.true;
  });

  it('returns true for paths with .clab.yaml', () => {
    expect(isClabYamlFile('/home/user/labs/my-lab.clab.yaml')).to.be.true;
  });
});

describe('isClabYamlFile() - invalid clab files', () => {
  it('returns false for regular .yml files', () => {
    expect(isClabYamlFile('config.yml')).to.be.false;
  });

  it('returns false for regular .yaml files', () => {
    expect(isClabYamlFile('config.yaml')).to.be.false;
  });

  it('returns false for files without yml/yaml extension', () => {
    expect(isClabYamlFile('topology.clab.json')).to.be.false;
  });

  it('returns false for empty string', () => {
    expect(isClabYamlFile('')).to.be.false;
  });

  it('returns false for partial match at start', () => {
    expect(isClabYamlFile('.clab.yml.backup')).to.be.false;
  });

  it('returns false for files with clab in name but wrong extension', () => {
    expect(isClabYamlFile('my-clab-topology.txt')).to.be.false;
  });
});

describe('isClabYamlFile() - edge cases', () => {
  it('handles uppercase extension', () => {
    // The function uses endsWith which is case-sensitive
    expect(isClabYamlFile('topology.clab.YML')).to.be.false;
    expect(isClabYamlFile('topology.clab.YAML')).to.be.false;
  });

  it('handles mixed case extension', () => {
    expect(isClabYamlFile('topology.clab.Yml')).to.be.false;
    expect(isClabYamlFile('topology.clab.Yaml')).to.be.false;
  });

  it('handles just the extension', () => {
    expect(isClabYamlFile('.clab.yml')).to.be.true;
    expect(isClabYamlFile('.clab.yaml')).to.be.true;
  });

  it('handles Windows-style paths', () => {
    expect(isClabYamlFile('C:\\Users\\labs\\topo.clab.yml')).to.be.true;
  });

  it('handles paths with spaces', () => {
    expect(isClabYamlFile('/home/user/my labs/topology.clab.yml')).to.be.true;
  });
});
