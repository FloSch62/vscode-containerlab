/* eslint-env mocha */
/* global describe, it, after, beforeEach, __dirname */
/**
 * Tests for YamlValidator.ts - YAML validation for containerlab topologies.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.endsWith('logging/logger')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extensionLogger-stub.js');
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

import * as yamlValidatorModule from '../../../src/topoViewer/extension/services/YamlValidator';
import * as vscodeStub from '../../helpers/vscode-stub';

describe('YamlValidator - validateYamlContent with valid YAML', () => {
  let mockContext: any;

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    mockContext = {};
  });

  it('validates minimal valid YAML with only name', async () => {
    const yaml = 'name: test-lab';
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('validates YAML with name and empty topology', async () => {
    const yaml = `
name: test-lab
topology: {}
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('validates YAML with name, nodes, and no links', async () => {
    const yaml = `
name: test-lab
topology:
  nodes:
    node1:
      kind: linux
      image: alpine:latest
    node2:
      kind: linux
      image: alpine:latest
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('validates YAML with name, nodes, and valid links', async () => {
    const yaml = `
name: test-lab
topology:
  nodes:
    node1:
      kind: linux
    node2:
      kind: linux
  links:
    - endpoints: ["node1:eth1", "node2:eth1"]
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('validates YAML with name and links but no nodes', async () => {
    const yaml = `
name: test-lab
topology:
  links:
    - endpoints: ["node1:eth1", "node2:eth1"]
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });
});

describe('YamlValidator - validateYamlContent with missing/invalid name', () => {
  let mockContext: any;

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    mockContext = {};
  });

  it('rejects YAML without name field', async () => {
    const yaml = `
topology:
  nodes:
    node1:
      kind: linux
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('name');
    expect(vscodeStub.window.lastErrorMessage).to.include('required');
  });

  it('rejects YAML with empty name', async () => {
    const yaml = `
name: ""
topology:
  nodes:
    node1:
      kind: linux
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('name');
  });

  it('rejects YAML with whitespace-only name', async () => {
    const yaml = `
name: "   "
topology: {}
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('name');
    expect(vscodeStub.window.lastErrorMessage).to.include('empty');
  });

  it('rejects YAML with null name', async () => {
    const yaml = `
name: null
topology: {}
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('name');
  });

  it('rejects YAML with numeric name', async () => {
    const yaml = `
name: 123
topology: {}
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('name');
  });
});

describe('YamlValidator - validateYamlContent with invalid topology', () => {
  let mockContext: any;

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    mockContext = {};
  });

  it('rejects YAML with topology as string', async () => {
    const yaml = `
name: test-lab
topology: "invalid"
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('topology');
    expect(vscodeStub.window.lastErrorMessage).to.include('object');
  });

  it('rejects YAML with topology as array', async () => {
    const yaml = `
name: test-lab
topology: []
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('topology');
    expect(vscodeStub.window.lastErrorMessage).to.include('object');
  });

  it('rejects YAML with topology as number', async () => {
    const yaml = `
name: test-lab
topology: 123
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('topology');
  });

  it('rejects YAML with topology as null', async () => {
    const yaml = `
name: test-lab
topology: null
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('topology');
  });
});

describe('YamlValidator - validateYamlContent with invalid nodes', () => {
  let mockContext: any;

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    mockContext = {};
  });

  it('rejects YAML with nodes as array', async () => {
    const yaml = `
name: test-lab
topology:
  nodes: []
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('nodes');
    expect(vscodeStub.window.lastErrorMessage).to.include('object');
  });

  it('rejects YAML with nodes as string', async () => {
    const yaml = `
name: test-lab
topology:
  nodes: "invalid"
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('nodes');
  });

  it('rejects YAML with nodes as number', async () => {
    const yaml = `
name: test-lab
topology:
  nodes: 123
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('nodes');
  });

  it('rejects YAML with nodes as null', async () => {
    const yaml = `
name: test-lab
topology:
  nodes: null
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('nodes');
  });

  it('validates YAML with node having non-object value (minimal node)', async () => {
    const yaml = `
name: test-lab
topology:
  nodes:
    node1: null
`;
    // This should pass validation but log a warning (not tested here)
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });
});

describe('YamlValidator - validateYamlContent with invalid links', () => {
  let mockContext: any;

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    mockContext = {};
  });

  it('rejects YAML with links as object', async () => {
    const yaml = `
name: test-lab
topology:
  links: {}
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('links');
    expect(vscodeStub.window.lastErrorMessage).to.include('array');
  });

  it('rejects YAML with links as string', async () => {
    const yaml = `
name: test-lab
topology:
  links: "invalid"
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('links');
  });

  it('rejects YAML with links as number', async () => {
    const yaml = `
name: test-lab
topology:
  links: 456
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('links');
  });

  it('rejects YAML with links as null', async () => {
    const yaml = `
name: test-lab
topology:
  links: null
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('links');
  });
});

describe('YamlValidator - validateYamlContent with YAML syntax errors', () => {
  let mockContext: any;

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    mockContext = {};
  });

  it('handles invalid YAML with unclosed quotes', async () => {
    const yaml = `
name: "test-lab
topology: {}
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('syntax');
  });

  it('handles invalid YAML with bad indentation', async () => {
    const yaml = `
name: test-lab
  topology:
nodes:
  node1: {}
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.not.equal('');
  });

  it('handles YAML that is not an object at root level', async () => {
    const yaml = `
- item1
- item2
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('object');
  });

  it('handles YAML with only scalar value at root', async () => {
    const yaml = 'just a string';
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('object');
  });

  it('handles empty YAML string', async () => {
    const yaml = '';
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.not.equal('');
  });

  it('handles YAML with null content', async () => {
    const yaml = 'null';
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.false;
    expect(vscodeStub.window.lastErrorMessage).to.include('object');
  });
});

describe('YamlValidator - link reference validation', () => {
  let mockContext: any;

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    mockContext = {};
  });

  it('validates when all link endpoints reference defined nodes', async () => {
    const yaml = `
name: test-lab
topology:
  nodes:
    node1:
      kind: linux
    node2:
      kind: linux
  links:
    - endpoints: ["node1:eth1", "node2:eth1"]
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('validates when link references undefined node (warning only)', async () => {
    const yaml = `
name: test-lab
topology:
  nodes:
    node1:
      kind: linux
  links:
    - endpoints: ["node1:eth1", "node2:eth1"]
`;
    // Should still return true, but log a warning (not captured in error message)
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('validates when multiple links reference undefined nodes', async () => {
    const yaml = `
name: test-lab
topology:
  nodes:
    node1:
      kind: linux
  links:
    - endpoints: ["node1:eth1", "node2:eth1"]
    - endpoints: ["node1:eth2", "node3:eth1"]
    - endpoints: ["node4:eth1", "node5:eth1"]
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('validates when link has no endpoints array', async () => {
    const yaml = `
name: test-lab
topology:
  nodes:
    node1:
      kind: linux
  links:
    - type: vxlan
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('validates when link endpoints is not an array', async () => {
    const yaml = `
name: test-lab
topology:
  nodes:
    node1:
      kind: linux
  links:
    - endpoints: "invalid"
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('validates when endpoint is not a string', async () => {
    const yaml = `
name: test-lab
topology:
  nodes:
    node1:
      kind: linux
  links:
    - endpoints: [123, 456]
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('validates when endpoint has no colon separator', async () => {
    const yaml = `
name: test-lab
topology:
  nodes:
    node1:
      kind: linux
  links:
    - endpoints: ["node1", "node2"]
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('skips link validation when nodes is empty', async () => {
    const yaml = `
name: test-lab
topology:
  nodes: {}
  links:
    - endpoints: ["node1:eth1", "node2:eth1"]
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('skips link validation when links is empty', async () => {
    const yaml = `
name: test-lab
topology:
  nodes:
    node1:
      kind: linux
  links: []
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });
});

describe('YamlValidator - edge cases and special scenarios', () => {
  let mockContext: any;

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    mockContext = {};
  });

  it('validates YAML with extra top-level fields', async () => {
    const yaml = `
name: test-lab
mgmt:
  network: custom
  ipv4-subnet: 172.20.20.0/24
topology:
  nodes:
    node1:
      kind: linux
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('validates complex nested topology structure', async () => {
    const yaml = `
name: test-lab
topology:
  defaults:
    kind: linux
  kinds:
    linux:
      image: alpine:latest
  nodes:
    node1:
      kind: linux
      mgmt_ipv4: 172.20.20.2
    node2:
      kind: linux
      mgmt_ipv4: 172.20.20.3
  links:
    - endpoints: ["node1:eth1", "node2:eth1"]
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('validates YAML with name containing special characters', async () => {
    const yaml = `
name: test-lab_v1.0-alpha
topology: {}
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('validates YAML with unicode characters in name', async () => {
    const yaml = `
name: test-lab-日本語
topology: {}
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });

  it('handles YAML with comments', async () => {
    const yaml = `
# This is a test lab
name: test-lab
# Topology section
topology:
  nodes:
    # First node
    node1:
      kind: linux
`;
    const result = await yamlValidatorModule.validateYamlContent(mockContext, yaml);
    expect(result).to.be.true;
    expect(vscodeStub.window.lastErrorMessage).to.equal('');
  });
});
