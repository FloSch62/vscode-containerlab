/* eslint-env mocha */
/* global describe, it, beforeEach */

import { expect } from 'chai';
import * as YAML from 'yaml';

// Direct import since this uses pure YAML operations
import { YamlSettingsManager, LabSettings } from '../../../src/topoViewer/extension/services/YamlSettingsManager';

// Constants to avoid duplicate strings
const LAB_NAME = 'test-lab';
const LAB_PREFIX = 'clab-test';
const MGMT_NETWORK = '172.20.20.0/24';
const MGMT_IPV6_SUBNET = '2001:db8::/64';
const YAML_NAME_LABEL = 'name:';
const YAML_PREFIX_LABEL = 'prefix:';
const YAML_MGMT_LABEL = 'mgmt:';
const OLD_NAME_VALUE = 'old-name';
const YAML_BASE = 'name: test-lab\ntopology:\n  nodes: {}';
const YAML_OLD_NAME = 'name: old-name\ntopology:\n  nodes: {}';
const YAML_WITH_MGMT = 'name: lab\nmgmt:\n  network: old-net\ntopology:\n  nodes: {}';

describe('YamlSettingsManager - applyExistingSettings name', () => {
  let manager: YamlSettingsManager;

  beforeEach(() => {
    manager = new YamlSettingsManager();
  });

  it('updates name when present in settings', () => {
    const doc = YAML.parseDocument(YAML_OLD_NAME);
    const settings: LabSettings = { name: LAB_NAME };

    manager.applyExistingSettings(doc, settings);

    expect(doc.get('name')).to.equal(LAB_NAME);
  });

  it('does not update name when empty string', () => {
    const doc = YAML.parseDocument(YAML_OLD_NAME);
    const settings: LabSettings = { name: '' };

    manager.applyExistingSettings(doc, settings);

    expect(doc.get('name')).to.equal(OLD_NAME_VALUE);
  });

  it('does not update name when undefined', () => {
    const doc = YAML.parseDocument(YAML_OLD_NAME);
    const settings: LabSettings = {};

    manager.applyExistingSettings(doc, settings);

    expect(doc.get('name')).to.equal(OLD_NAME_VALUE);
  });
});

describe('YamlSettingsManager - applyExistingSettings prefix', () => {
  let manager: YamlSettingsManager;

  beforeEach(() => {
    manager = new YamlSettingsManager();
  });

  it('updates prefix when it exists', () => {
    const doc = YAML.parseDocument('name: lab\nprefix: old-prefix\ntopology:\n  nodes: {}');
    const settings: LabSettings = { prefix: LAB_PREFIX };

    const result = manager.applyExistingSettings(doc, settings);

    expect(doc.get('prefix')).to.equal(LAB_PREFIX);
    expect(result.hadPrefix).to.be.true;
  });

  it('deletes prefix when set to null', () => {
    const doc = YAML.parseDocument('name: lab\nprefix: old-prefix\ntopology:\n  nodes: {}');
    const settings: LabSettings = { prefix: null };

    manager.applyExistingSettings(doc, settings);

    expect(doc.has('prefix')).to.be.false;
  });

  it('does not add prefix if it does not exist', () => {
    const doc = YAML.parseDocument(YAML_BASE);
    const settings: LabSettings = { prefix: LAB_PREFIX };

    const result = manager.applyExistingSettings(doc, settings);

    expect(doc.has('prefix')).to.be.false;
    expect(result.hadPrefix).to.be.false;
  });

  it('reports hadPrefix correctly', () => {
    const docWith = YAML.parseDocument('name: lab\nprefix: test\ntopology:\n  nodes: {}');
    const docWithout = YAML.parseDocument(YAML_BASE);

    const resultWith = manager.applyExistingSettings(docWith, {});
    const resultWithout = manager.applyExistingSettings(docWithout, {});

    expect(resultWith.hadPrefix).to.be.true;
    expect(resultWithout.hadPrefix).to.be.false;
  });
});

describe('YamlSettingsManager - applyExistingSettings mgmt', () => {
  let manager: YamlSettingsManager;

  beforeEach(() => {
    manager = new YamlSettingsManager();
  });

  it('updates mgmt when it exists', () => {
    const doc = YAML.parseDocument(YAML_WITH_MGMT);
    const settings: LabSettings = { mgmt: { network: MGMT_NETWORK } };

    const result = manager.applyExistingSettings(doc, settings);

    const mgmt = doc.get('mgmt') as any;
    expect(mgmt).to.have.property('network', MGMT_NETWORK);
    expect(result.hadMgmt).to.be.true;
  });

  it('deletes mgmt when set to null', () => {
    const doc = YAML.parseDocument(YAML_WITH_MGMT);
    const settings: LabSettings = { mgmt: null };

    manager.applyExistingSettings(doc, settings);

    expect(doc.has('mgmt')).to.be.false;
  });

  it('deletes mgmt when set to empty object', () => {
    const doc = YAML.parseDocument(YAML_WITH_MGMT);
    const settings: LabSettings = { mgmt: {} };

    manager.applyExistingSettings(doc, settings);

    expect(doc.has('mgmt')).to.be.false;
  });

  it('does not add mgmt if it does not exist', () => {
    const doc = YAML.parseDocument(YAML_BASE);
    const settings: LabSettings = { mgmt: { network: MGMT_NETWORK } };

    const result = manager.applyExistingSettings(doc, settings);

    expect(doc.has('mgmt')).to.be.false;
    expect(result.hadMgmt).to.be.false;
  });

  it('reports hadMgmt correctly', () => {
    const docWith = YAML.parseDocument('name: lab\nmgmt:\n  network: test\ntopology:\n  nodes: {}');
    const docWithout = YAML.parseDocument(YAML_BASE);

    const resultWith = manager.applyExistingSettings(docWith, {});
    const resultWithout = manager.applyExistingSettings(docWithout, {});

    expect(resultWith.hadMgmt).to.be.true;
    expect(resultWithout.hadMgmt).to.be.false;
  });
});

describe('YamlSettingsManager - insertMissingSettings prefix', () => {
  let manager: YamlSettingsManager;

  beforeEach(() => {
    manager = new YamlSettingsManager();
  });

  it('inserts prefix after name when missing', () => {
    const yaml = YAML_BASE;
    const settings: LabSettings = { prefix: LAB_PREFIX };

    const result = manager.insertMissingSettings(yaml, settings, false, false);

    expect(result).to.include(`prefix: ${LAB_PREFIX}`);
    const lines = result.split('\n');
    const nameIdx = lines.findIndex(l => l.includes(YAML_NAME_LABEL));
    const prefixIdx = lines.findIndex(l => l.includes(YAML_PREFIX_LABEL));
    expect(prefixIdx).to.equal(nameIdx + 1);
  });

  it('does not insert prefix if already present', () => {
    const yaml = 'name: test-lab\nprefix: existing\ntopology:\n  nodes: {}';
    const settings: LabSettings = { prefix: LAB_PREFIX };

    const result = manager.insertMissingSettings(yaml, settings, true, false);

    const prefixCount = (result.match(/prefix:/g) || []).length;
    expect(prefixCount).to.equal(1);
  });

  it('does not insert prefix if undefined in settings', () => {
    const yaml = YAML_BASE;
    const settings: LabSettings = {};

    const result = manager.insertMissingSettings(yaml, settings, false, false);

    expect(result).to.not.include(YAML_PREFIX_LABEL);
  });

  it('does not insert prefix if null in settings', () => {
    const yaml = YAML_BASE;
    const settings: LabSettings = { prefix: null };

    const result = manager.insertMissingSettings(yaml, settings, false, false);

    expect(result).to.not.include(YAML_PREFIX_LABEL);
  });

  it('quotes empty string prefix', () => {
    const yaml = YAML_BASE;
    const settings: LabSettings = { prefix: '' };

    const result = manager.insertMissingSettings(yaml, settings, false, false);

    expect(result).to.include('prefix: ""');
  });

  it('returns unchanged if name not found', () => {
    const yaml = 'topology:\n  nodes: {}';
    const settings: LabSettings = { prefix: LAB_PREFIX };

    const result = manager.insertMissingSettings(yaml, settings, false, false);

    expect(result).to.equal(yaml);
  });
});

describe('YamlSettingsManager - insertMissingSettings mgmt', () => {
  let manager: YamlSettingsManager;

  beforeEach(() => {
    manager = new YamlSettingsManager();
  });

  it('inserts mgmt after prefix when missing', () => {
    const yaml = 'name: test-lab\nprefix: clab\ntopology:\n  nodes: {}';
    const settings: LabSettings = { mgmt: { network: MGMT_NETWORK } };

    const result = manager.insertMissingSettings(yaml, settings, true, false);

    expect(result).to.include(YAML_MGMT_LABEL);
    expect(result).to.include(MGMT_NETWORK);
  });

  it('inserts mgmt after name if no prefix', () => {
    const yaml = YAML_BASE;
    const settings: LabSettings = { mgmt: { network: MGMT_NETWORK } };

    const result = manager.insertMissingSettings(yaml, settings, false, false);

    expect(result).to.include(YAML_MGMT_LABEL);
    const lines = result.split('\n');
    const nameIdx = lines.findIndex(l => l.includes(YAML_NAME_LABEL));
    const mgmtIdx = lines.findIndex(l => l.trim().startsWith(YAML_MGMT_LABEL));
    expect(mgmtIdx).to.be.greaterThan(nameIdx);
  });

  it('does not insert mgmt if already present', () => {
    const yaml = 'name: test-lab\nmgmt:\n  network: existing\ntopology:\n  nodes: {}';
    const settings: LabSettings = { mgmt: { network: MGMT_NETWORK } };

    const result = manager.insertMissingSettings(yaml, settings, false, true);

    const mgmtCount = (result.match(/mgmt:/g) || []).length;
    expect(mgmtCount).to.equal(1);
  });

  it('does not insert mgmt if undefined', () => {
    const yaml = YAML_BASE;
    const settings: LabSettings = {};

    const result = manager.insertMissingSettings(yaml, settings, false, false);

    expect(result).to.not.include(YAML_MGMT_LABEL);
  });

  it('does not insert mgmt if empty object', () => {
    const yaml = YAML_BASE;
    const settings: LabSettings = { mgmt: {} };

    const result = manager.insertMissingSettings(yaml, settings, false, false);

    expect(result).to.not.include(YAML_MGMT_LABEL);
  });

  it('handles multiple mgmt properties', () => {
    const yaml = 'name: test-lab\nprefix: clab\ntopology:\n  nodes: {}';
    const settings: LabSettings = {
      mgmt: {
        network: MGMT_NETWORK,
        'ipv6-subnet': MGMT_IPV6_SUBNET
      }
    };

    const result = manager.insertMissingSettings(yaml, settings, true, false);

    expect(result).to.include(YAML_MGMT_LABEL);
    expect(result).to.include('network:');
  });

  it('returns unchanged if name not found', () => {
    const yaml = 'topology:\n  nodes: {}';
    const settings: LabSettings = { mgmt: { network: MGMT_NETWORK } };

    const result = manager.insertMissingSettings(yaml, settings, false, false);

    expect(result).to.equal(yaml);
  });
});

describe('YamlSettingsManager - combined operations', () => {
  let manager: YamlSettingsManager;

  beforeEach(() => {
    manager = new YamlSettingsManager();
  });

  it('handles full workflow: update and insert', () => {
    const originalYaml = YAML_OLD_NAME;
    const doc = YAML.parseDocument(originalYaml);
    const settings: LabSettings = {
      name: LAB_NAME,
      prefix: LAB_PREFIX,
      mgmt: { network: MGMT_NETWORK }
    };

    const { hadPrefix, hadMgmt } = manager.applyExistingSettings(doc, settings);
    const updatedYaml = doc.toString();
    const finalYaml = manager.insertMissingSettings(updatedYaml, settings, hadPrefix, hadMgmt);

    expect(finalYaml).to.include(`name: ${LAB_NAME}`);
    expect(finalYaml).to.include(`prefix: ${LAB_PREFIX}`);
    expect(finalYaml).to.include(YAML_MGMT_LABEL);
    expect(finalYaml).to.include(MGMT_NETWORK);
  });

  it('preserves existing fields when updating', () => {
    const originalYaml = 'name: old-name\nprefix: old-prefix\nmgmt:\n  network: old-net\ntopology:\n  nodes:\n    srl: {}';
    const doc = YAML.parseDocument(originalYaml);
    const settings: LabSettings = {
      name: LAB_NAME,
      prefix: LAB_PREFIX,
      mgmt: { network: MGMT_NETWORK }
    };

    manager.applyExistingSettings(doc, settings);
    const updatedYaml = doc.toString();

    expect(updatedYaml).to.include(`name: ${LAB_NAME}`);
    expect(updatedYaml).to.include(`prefix: ${LAB_PREFIX}`);
    expect(updatedYaml).to.include(MGMT_NETWORK);
    expect(updatedYaml).to.include('topology:');
    expect(updatedYaml).to.include('srl:');
  });
});
