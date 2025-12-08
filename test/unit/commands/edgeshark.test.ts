/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for edgeshark.ts - Edgeshark installation/uninstallation commands.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;

function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.endsWith('/command') || request.endsWith('\\command')) {
    return path.join(__dirname, '..', '..', 'helpers', 'command-stub.js');
  }
  return null;
}

let edgesharkModule: any;
let vscodeStub: any;
let commandStub: any;

const CURL_SL = 'curl -sL';
const DOCKER_COMPOSE = 'docker compose';
const COMPOSE_URL = 'https://github.com/siemens/edgeshark/raw/main/deployments/wget/docker-compose.yaml';
const DOCKER_DEFAULT_PLATFORM = 'DOCKER_DEFAULT_PLATFORM=';
const TMPFILE_PREFIX = 'tmpFile=';
const SED_INJECT = 'sed -i';
const ENV_VAR_PREFIX = '          - ';
const INSTALL_TERMINAL = 'Edgeshark Installation';
const UNINSTALL_TERMINAL = 'Edgeshark Uninstallation';
const CONFIG_KEY = 'containerlab.edgeshark.extraEnvironmentVars';
const TEST_ENV_VAR = 'VAR1=value1';

function setupEdgesharkTests() {
  before(() => {
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    commandStub = require('../../helpers/command-stub');
    edgesharkModule = require('../../../src/commands/edgeshark');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    commandStub.resetCommandStub();
  });
}

describe('edgeshark - getEdgesharkInstallCmd default', () => {
  setupEdgesharkTests();

  it('returns default curl command when no extraEnvironmentVars configured', () => {
    const cmd = edgesharkModule.getEdgesharkInstallCmd();

    expect(cmd).to.be.a('string');
    expect(cmd).to.include(CURL_SL);
    expect(cmd).to.include(COMPOSE_URL);
    expect(cmd).to.include(`${DOCKER_DEFAULT_PLATFORM} ${DOCKER_COMPOSE} -f - up -d`);
    expect(cmd).to.not.include(TMPFILE_PREFIX);
  });

  it('returns default command when extraEnvironmentVars is empty string', () => {
    vscodeStub.setConfigValue(CONFIG_KEY, '');

    const cmd = edgesharkModule.getEdgesharkInstallCmd();

    expect(cmd).to.include(CURL_SL);
    expect(cmd).to.not.include(TMPFILE_PREFIX);
    expect(cmd).to.not.include(SED_INJECT);
  });

  it('returns default command when all environment variables are empty/whitespace', () => {
    vscodeStub.setConfigValue(CONFIG_KEY, '  ,  ,   ');

    const cmd = edgesharkModule.getEdgesharkInstallCmd();

    expect(cmd).to.include(CURL_SL);
    expect(cmd).to.not.include(TMPFILE_PREFIX);
  });
});

describe('edgeshark - getEdgesharkInstallCmd with env vars', () => {
  setupEdgesharkTests();

  it('returns modified command with single environment variable', () => {
    vscodeStub.setConfigValue(CONFIG_KEY, TEST_ENV_VAR);

    const cmd = edgesharkModule.getEdgesharkInstallCmd();

    expect(cmd).to.include('tmpFile="$(mktemp -t edgeshark-compose.XXXXXX)"');
    expect(cmd).to.include(`${CURL_SL} ${COMPOSE_URL} -o "$tmpFile"`);
    expect(cmd).to.include(SED_INJECT);
    expect(cmd).to.include(`${ENV_VAR_PREFIX}${TEST_ENV_VAR}`);
    expect(cmd).to.include('gostwire:');
    expect(cmd).to.include('edgeshark:');
  });

  it('returns modified command with multiple environment variables', () => {
    vscodeStub.setConfigValue(CONFIG_KEY, `${TEST_ENV_VAR},VAR2=value2,VAR3=value3`);

    const cmd = edgesharkModule.getEdgesharkInstallCmd();

    expect(cmd).to.include(TMPFILE_PREFIX);
    expect(cmd).to.include(`${ENV_VAR_PREFIX}${TEST_ENV_VAR}`);
    expect(cmd).to.include(`${ENV_VAR_PREFIX}VAR2=value2`);
    expect(cmd).to.include(`${ENV_VAR_PREFIX}VAR3=value3`);
  });

  it('filters out empty and whitespace-only environment variables', () => {
    vscodeStub.setConfigValue(CONFIG_KEY, `${TEST_ENV_VAR},  ,VAR2=value2,   ,`);

    const cmd = edgesharkModule.getEdgesharkInstallCmd();

    expect(cmd).to.include(`${ENV_VAR_PREFIX}${TEST_ENV_VAR}`);
    expect(cmd).to.include(`${ENV_VAR_PREFIX}VAR2=value2`);
    expect(cmd).to.include(TMPFILE_PREFIX);
  });

  it('trims whitespace from environment variable values', () => {
    vscodeStub.setConfigValue(CONFIG_KEY, `  ${TEST_ENV_VAR}  ,  VAR2=value2  `);

    const cmd = edgesharkModule.getEdgesharkInstallCmd();

    expect(cmd).to.include(`${ENV_VAR_PREFIX}${TEST_ENV_VAR}`);
    expect(cmd).to.include(`${ENV_VAR_PREFIX}VAR2=value2`);
  });
});

describe('edgeshark - getEdgesharkUninstallCmd', () => {
  setupEdgesharkTests();

  it('returns docker compose down command', () => {
    const cmd = edgesharkModule.getEdgesharkUninstallCmd();

    expect(cmd).to.include(CURL_SL);
    expect(cmd).to.include(COMPOSE_URL);
    expect(cmd).to.include(`${DOCKER_DEFAULT_PLATFORM} ${DOCKER_COMPOSE} -f - down`);
  });

  it('returns consistent uninstall command regardless of config', () => {
    vscodeStub.setConfigValue(CONFIG_KEY, TEST_ENV_VAR);

    const cmd = edgesharkModule.getEdgesharkUninstallCmd();

    expect(cmd).to.include(CURL_SL);
    expect(cmd).to.not.include(TMPFILE_PREFIX);
    expect(cmd).to.not.include(SED_INJECT);
  });
});

describe('edgeshark - installEdgeshark', () => {
  setupEdgesharkTests();

  it('executes install command in terminal', async () => {
    await edgesharkModule.installEdgeshark();

    expect(commandStub.calls).to.have.length(1);
    expect(commandStub.calls[0].terminalName).to.equal(INSTALL_TERMINAL);
    expect(commandStub.calls[0].command).to.include(CURL_SL);
    expect(commandStub.calls[0].command).to.include(DOCKER_COMPOSE);
    expect(commandStub.calls[0].command).to.include('up -d');
  });

  it('executes install command with environment variables when configured', async () => {
    vscodeStub.setConfigValue(CONFIG_KEY, `${TEST_ENV_VAR},VAR2=value2`);

    await edgesharkModule.installEdgeshark();

    expect(commandStub.calls).to.have.length(1);
    expect(commandStub.calls[0].terminalName).to.equal(INSTALL_TERMINAL);
    expect(commandStub.calls[0].command).to.include(TMPFILE_PREFIX);
    expect(commandStub.calls[0].command).to.include(TEST_ENV_VAR);
  });

  it('uses default install command when no environment variables configured', async () => {
    await edgesharkModule.installEdgeshark();

    const cmd = commandStub.calls[0].command;
    expect(cmd).to.include(CURL_SL);
    expect(cmd).to.not.include(TMPFILE_PREFIX);
  });
});

describe('edgeshark - uninstallEdgeshark', () => {
  setupEdgesharkTests();

  it('executes uninstall command in terminal', async () => {
    await edgesharkModule.uninstallEdgeshark();

    expect(commandStub.calls).to.have.length(1);
    expect(commandStub.calls[0].terminalName).to.equal(UNINSTALL_TERMINAL);
    expect(commandStub.calls[0].command).to.include(CURL_SL);
    expect(commandStub.calls[0].command).to.include('down');
  });

  it('executes same uninstall command regardless of config', async () => {
    vscodeStub.setConfigValue(CONFIG_KEY, TEST_ENV_VAR);

    await edgesharkModule.uninstallEdgeshark();

    const cmd = commandStub.calls[0].command;
    expect(cmd).to.include(CURL_SL);
    expect(cmd).to.not.include(TMPFILE_PREFIX);
    expect(cmd).to.not.include(TEST_ENV_VAR);
  });
});

describe('edgeshark - exported constants', () => {
  setupEdgesharkTests();

  it('EDGESHARK_INSTALL_CMD is defined', () => {
    expect(edgesharkModule.EDGESHARK_INSTALL_CMD).to.be.a('string');
    expect(edgesharkModule.EDGESHARK_INSTALL_CMD).to.include(DOCKER_COMPOSE);
  });

  it('EDGESHARK_UNINSTALL_CMD is defined', () => {
    expect(edgesharkModule.EDGESHARK_UNINSTALL_CMD).to.be.a('string');
    expect(edgesharkModule.EDGESHARK_UNINSTALL_CMD).to.include(DOCKER_COMPOSE);
    expect(edgesharkModule.EDGESHARK_UNINSTALL_CMD).to.include('down');
  });
});
