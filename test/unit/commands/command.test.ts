/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for command.ts - terminal and output channel command execution.
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
  if (request.includes('extension') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  if (request.includes('utils/index') || (request.includes('utils') && !request.includes('stub') && !request.includes('utils.ts'))) {
    return path.join(__dirname, '..', '..', 'helpers', 'utils-stub.js');
  }
  return null;
}

const TERMINAL_NAME_TEST = 'Test Terminal';
const TERMINAL_NAME_REUSE = 'Reuse Terminal';
const TERMINAL_NAME_FOCUS = 'Focus Terminal';
const TERMINAL_NAME_NEW_REUSE = 'New Reuse Terminal';
const CMD_TEST_COMMAND = 'test-command';

// Helper to setup module resolution for command tests
function setupCommandModuleResolution() {
  (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
    const stubPath = getStubPath(request);
    if (stubPath) {
      return stubPath;
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
}

/**
 * Tests for execCommandInTerminal function
 */
describe('command.ts - execCommandInTerminal', () => {
  let commandModule: any;
  let vscodeStub: any;

  before(() => {
    clearModuleCache();
    setupCommandModuleResolution();
    vscodeStub = require('../../helpers/vscode-stub');
    commandModule = require('../../../src/commands/command');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  it('creates a new terminal when none exists with the name', () => {
    commandModule.execCommandInTerminal('echo hello', TERMINAL_NAME_TEST);

    expect(vscodeStub.window.terminals).to.have.length(1);
    expect(vscodeStub.window.terminals[0].name).to.equal(TERMINAL_NAME_TEST);
    expect(vscodeStub.window.terminals[0].commands).to.include('echo hello');
    expect(vscodeStub.window.terminals[0].shown).to.be.true;
  });

  it('reuses existing terminal and sends Ctrl+C when reuseOnly is false', () => {
    const firstCmd = 'first command';
    const secondCmd = 'second command';
    // Create initial terminal
    commandModule.execCommandInTerminal(firstCmd, TERMINAL_NAME_REUSE);
    expect(vscodeStub.window.terminals).to.have.length(1);

    // Send another command with reuseOnly = false (default)
    commandModule.execCommandInTerminal(secondCmd, TERMINAL_NAME_REUSE, false);

    // Should still be only 1 terminal
    expect(vscodeStub.window.terminals).to.have.length(1);
    const terminal = vscodeStub.window.terminals[0];
    // Should have Ctrl+C sent followed by the new command
    expect(terminal.commands).to.include('\x03\r');
    expect(terminal.commands).to.include(secondCmd);
  });

  it('only focuses terminal when reuseOnly is true and terminal exists', () => {
    const firstCmd = 'cmd1';
    const secondCmd = 'cmd2';
    // Create initial terminal
    commandModule.execCommandInTerminal(firstCmd, TERMINAL_NAME_FOCUS);
    vscodeStub.window.terminals[0].shown = false; // Reset shown state

    // Send with reuseOnly = true
    commandModule.execCommandInTerminal(secondCmd, TERMINAL_NAME_FOCUS, true);

    // Should be only 1 terminal and no new command sent
    expect(vscodeStub.window.terminals).to.have.length(1);
    const terminal = vscodeStub.window.terminals[0];
    expect(terminal.commands).to.not.include(secondCmd);
    expect(terminal.shown).to.be.true;
  });

  it('creates terminal when reuseOnly is true but terminal does not exist', () => {
    commandModule.execCommandInTerminal('new command', TERMINAL_NAME_NEW_REUSE, true);

    expect(vscodeStub.window.terminals).to.have.length(1);
    expect(vscodeStub.window.terminals[0].name).to.equal(TERMINAL_NAME_NEW_REUSE);
    expect(vscodeStub.window.terminals[0].commands).to.include('new command');
  });
});

/**
 * Tests for Command class construction
 */
describe('command.ts - Command class construction', () => {
  let commandModule: any;

  before(() => {
    setupCommandModuleResolution();
    commandModule = require('../../../src/commands/command');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  it('constructs with spinner options', () => {
    const cmd = new commandModule.Command({
      useSpinner: true,
      command: CMD_TEST_COMMAND,
      spinnerMsg: {
        progressMsg: 'Running...',
        successMsg: 'Done!'
      }
    });

    expect(cmd).to.exist;
  });

  it('constructs with terminal options', () => {
    const cmd = new commandModule.Command({
      useSpinner: false,
      command: CMD_TEST_COMMAND,
      terminalName: 'Test Term'
    });

    expect(cmd).to.exist;
  });

  it('defaults useSpinner to false when not specified', () => {
    const cmd = new commandModule.Command({
      command: CMD_TEST_COMMAND,
      terminalName: 'Test Term'
    });

    expect(cmd).to.exist;
  });

  it('stores spinnerMsg with failMsg', () => {
    const cmd = new commandModule.Command({
      useSpinner: true,
      command: CMD_TEST_COMMAND,
      spinnerMsg: {
        progressMsg: 'Running...',
        successMsg: 'Done!',
        failMsg: 'Failed!'
      }
    });

    expect(cmd).to.exist;
  });
});

// Helper to create a testable command class
function createTestableCommand(commandModule: any) {
  return class extends (commandModule.Command as any) {
    async testExecute(args?: string[]) {
      return this.execute(args);
    }
  };
}

/**
 * Tests for Command class - TestableCommand subclass
 */
describe('command.ts - TestableCommand execution', () => {
  let commandModule: any;
  let vscodeStub: any;
  let TestableCommand: any;

  before(() => {
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    commandModule = require('../../../src/commands/command');
    TestableCommand = createTestableCommand(commandModule);
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  it('executes command in terminal mode without spinner', async () => {
    const cmd = new TestableCommand({
      useSpinner: false,
      command: 'echo',
      terminalName: 'Execute Test'
    });

    await cmd.testExecute(['hello', 'world']);

    // Should have created a terminal
    expect(vscodeStub.window.terminals).to.have.length(1);
    expect(vscodeStub.window.terminals[0].name).to.equal('Execute Test');
  });

  it('executes command with arguments joined correctly', async () => {
    const cmd = new TestableCommand({
      useSpinner: false,
      command: 'containerlab',
      terminalName: 'Args Test'
    });

    await cmd.testExecute(['deploy', '-t', 'lab.yml']);

    const terminal = vscodeStub.window.terminals[0];
    expect(terminal.commands[0]).to.include('containerlab deploy -t lab.yml');
  });

  it('executes command without arguments', async () => {
    const cmd = new TestableCommand({
      useSpinner: false,
      command: 'ls',
      terminalName: 'No Args Test'
    });

    await cmd.testExecute();

    const terminal = vscodeStub.window.terminals[0];
    expect(terminal.commands[0]).to.include('ls');
  });
});
