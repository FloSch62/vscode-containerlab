/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach */

import { expect } from 'chai';
import sinon from 'sinon';

// Import modules under test directly (pure functions, no vscode dependency)
import { isClabYamlFile } from '../../../src/utils/clab';
import { delay } from '../../../src/utils/async';
import {
  WIRESHARK_VNC_CTR_NAME_PREFIX,
  DEFAULT_WIRESHARK_VNC_DOCKER_PULL_POLICY,
  DEFAULT_WIRESHARK_VNC_DOCKER_IMAGE,
  DEFAULT_ATTACH_SHELL_CMD,
  DEFAULT_ATTACH_TELNET_PORT,
  ImagePullPolicy,
  ContainerAction
} from '../../../src/utils/consts';

// Constants for test strings
const CLAB_YML_EXT = '.clab.yml';
const CLAB_YAML_EXT = '.clab.yaml';
const SAMPLE_LAB = 'lab';
const SAMPLE_LAB_YML = 'lab.clab.yml';
const SAMPLE_LAB_YAML = 'lab.clab.yaml';

describe('clab utils - isClabYamlFile basic cases', () => {
  it('returns true for .clab.yml extension', () => {
    expect(isClabYamlFile(SAMPLE_LAB_YML)).to.be.true;
  });

  it('returns true for .clab.yaml extension', () => {
    expect(isClabYamlFile(SAMPLE_LAB_YAML)).to.be.true;
  });

  it('returns false for regular .yml file', () => {
    expect(isClabYamlFile('config.yml')).to.be.false;
  });

  it('returns false for regular .yaml file', () => {
    expect(isClabYamlFile('config.yaml')).to.be.false;
  });
});

describe('clab utils - isClabYamlFile edge cases', () => {
  it('returns false for .json file', () => {
    expect(isClabYamlFile('topology.json')).to.be.false;
  });

  it('returns false for file without extension', () => {
    expect(isClabYamlFile(SAMPLE_LAB)).to.be.false;
  });

  it('returns false for empty string', () => {
    expect(isClabYamlFile('')).to.be.false;
  });

  it('returns true for full path with .clab.yml', () => {
    expect(isClabYamlFile('/home/user/labs/topology.clab.yml')).to.be.true;
  });

  it('returns true for full path with .clab.yaml', () => {
    expect(isClabYamlFile('/home/user/labs/topology.clab.yaml')).to.be.true;
  });

  it('returns false for .clab without yaml extension', () => {
    expect(isClabYamlFile('topology.clab')).to.be.false;
  });

  it('returns true for just the extension .clab.yml', () => {
    expect(isClabYamlFile(CLAB_YML_EXT)).to.be.true;
  });

  it('returns true for just the extension .clab.yaml', () => {
    expect(isClabYamlFile(CLAB_YAML_EXT)).to.be.true;
  });

  it('is case sensitive - returns false for uppercase .CLAB.YML', () => {
    expect(isClabYamlFile('topology.CLAB.YML')).to.be.false;
  });

  it('is case sensitive - returns false for mixed case .Clab.Yml', () => {
    expect(isClabYamlFile('topology.Clab.Yml')).to.be.false;
  });
});

describe('async utils - delay basic behavior', () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it('resolves after specified milliseconds', async () => {
    let resolved = false;
    const delayPromise = delay(1000).then(() => {
      resolved = true;
    });

    expect(resolved).to.be.false;

    clock.tick(999);
    await Promise.resolve(); // Flush microtasks
    expect(resolved).to.be.false;

    clock.tick(1);
    await delayPromise;
    expect(resolved).to.be.true;
  });

  it('resolves immediately for 0ms delay', async () => {
    let resolved = false;
    const delayPromise = delay(0).then(() => {
      resolved = true;
    });

    expect(resolved).to.be.false;

    clock.tick(0);
    await delayPromise;
    expect(resolved).to.be.true;
  });

  it('handles small delays', async () => {
    let resolved = false;
    const delayPromise = delay(10).then(() => {
      resolved = true;
    });

    clock.tick(9);
    await Promise.resolve();
    expect(resolved).to.be.false;

    clock.tick(1);
    await delayPromise;
    expect(resolved).to.be.true;
  });
});

describe('async utils - delay edge cases', () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it('handles large delays', async () => {
    let resolved = false;
    const delayPromise = delay(60000).then(() => {
      resolved = true;
    });

    clock.tick(59999);
    await Promise.resolve();
    expect(resolved).to.be.false;

    clock.tick(1);
    await delayPromise;
    expect(resolved).to.be.true;
  });

  it('multiple delays resolve independently', async () => {
    let resolved1 = false;
    let resolved2 = false;

    const delay1 = delay(100).then(() => {
      resolved1 = true;
    });
    const delay2 = delay(200).then(() => {
      resolved2 = true;
    });

    clock.tick(100);
    await delay1;
    expect(resolved1).to.be.true;
    expect(resolved2).to.be.false;

    clock.tick(100);
    await delay2;
    expect(resolved2).to.be.true;
  });

  it('returns a Promise that resolves to undefined', async () => {
    const result = delay(0);
    expect(result).to.be.instanceOf(Promise);

    clock.tick(0);
    const resolved = await result;
    expect(resolved).to.be.undefined;
  });
});

describe('consts - constant values stability', () => {
  it('WIRESHARK_VNC_CTR_NAME_PREFIX has expected value', () => {
    expect(WIRESHARK_VNC_CTR_NAME_PREFIX).to.equal('clab_vsc_ws');
  });

  it('DEFAULT_WIRESHARK_VNC_DOCKER_PULL_POLICY has expected value', () => {
    expect(DEFAULT_WIRESHARK_VNC_DOCKER_PULL_POLICY).to.equal(ImagePullPolicy.Always);
  });

  it('DEFAULT_WIRESHARK_VNC_DOCKER_IMAGE has expected value', () => {
    expect(DEFAULT_WIRESHARK_VNC_DOCKER_IMAGE).to.equal('ghcr.io/kaelemc/wireshark-vnc-docker:latest');
  });

  it('DEFAULT_ATTACH_SHELL_CMD has expected value', () => {
    expect(DEFAULT_ATTACH_SHELL_CMD).to.equal('sh');
  });

  it('DEFAULT_ATTACH_TELNET_PORT has expected value', () => {
    expect(DEFAULT_ATTACH_TELNET_PORT).to.equal(5000);
  });
});

describe('consts - ImagePullPolicy enum', () => {
  it('has Never value', () => {
    expect(ImagePullPolicy.Never).to.equal('never');
  });

  it('has Missing value', () => {
    expect(ImagePullPolicy.Missing).to.equal('missing');
  });

  it('has Always value', () => {
    expect(ImagePullPolicy.Always).to.equal('always');
  });

  it('has expected enum string values', () => {
    // const enums are inlined at compile time, so we check values individually
    expect(ImagePullPolicy.Never).to.be.a('string');
    expect(ImagePullPolicy.Missing).to.be.a('string');
    expect(ImagePullPolicy.Always).to.be.a('string');
  });
});

describe('consts - ContainerAction enum', () => {
  it('has Start value', () => {
    expect(ContainerAction.Start).to.equal('start');
  });

  it('has Stop value', () => {
    expect(ContainerAction.Stop).to.equal('stop');
  });

  it('has Pause value', () => {
    expect(ContainerAction.Pause).to.equal('pause');
  });

  it('has Unpause value', () => {
    expect(ContainerAction.Unpause).to.equal('unpause');
  });

  it('has expected enum string values', () => {
    // const enums are inlined at compile time, so we check values individually
    expect(ContainerAction.Start).to.be.a('string');
    expect(ContainerAction.Stop).to.be.a('string');
    expect(ContainerAction.Pause).to.be.a('string');
    expect(ContainerAction.Unpause).to.be.a('string');
  });
});
