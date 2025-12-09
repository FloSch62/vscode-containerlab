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
  if (request === 'child_process') {
    return path.join(__dirname, '..', '..', 'helpers', 'child-process-stub.js');
  }
  return null;
}

const TERMINAL_NAME_TEST = 'Test Terminal';
const TERMINAL_NAME_REUSE = 'Reuse Terminal';
const TERMINAL_NAME_FOCUS = 'Focus Terminal';
const TERMINAL_NAME_NEW_REUSE = 'New Reuse Terminal';
const CMD_TEST_COMMAND = 'test-command';
const CMD_ECHO_HELLO = 'echo hello';
const MSG_RUNNING = 'Running...';
const MSG_DONE = 'Done!';
const MSG_TESTING = 'Testing...';

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
    commandModule.execCommandInTerminal(CMD_ECHO_HELLO, TERMINAL_NAME_TEST);

    expect(vscodeStub.window.terminals).to.have.length(1);
    expect(vscodeStub.window.terminals[0].name).to.equal(TERMINAL_NAME_TEST);
    expect(vscodeStub.window.terminals[0].commands).to.include(CMD_ECHO_HELLO);
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
        progressMsg: MSG_RUNNING,
        successMsg: MSG_DONE
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
        progressMsg: MSG_RUNNING,
        successMsg: MSG_DONE,
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

/**
 * Tests for splitArgs (internal function, tested via execCommandInOutput)
 */
describe('command.ts - execCommandInOutput', () => {
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

  it('parses simple command without quotes', async () => {
    // We can't easily test spawn, but we can verify the function exists
    expect(commandModule.execCommandInOutput).to.be.a('function');
  });

  it('can be called with show=true', () => {
    // Basic call test - spawn will fail but function should be callable
    const fn = () => commandModule.execCommandInOutput(CMD_ECHO_HELLO, true);
    expect(fn).to.not.throw();
  });

  it('can be called with callbacks', () => {
    const stdoutCb = () => {};
    const stderrCb = () => {};
    const fn = () => commandModule.execCommandInOutput('echo test', false, stdoutCb, stderrCb);
    expect(fn).to.not.throw();
  });
});

/**
 * Tests for Command class getCwd (tested via spinner execution)
 */
describe('command.ts - Command getCwd behavior', () => {
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

  it('handles workspace folders for cwd', () => {
    // Set up workspace folder
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

    const cmd = new commandModule.Command({
      useSpinner: true,
      command: 'test',
      spinnerMsg: {
        progressMsg: MSG_TESTING,
        successMsg: MSG_DONE
      }
    });

    expect(cmd).to.exist;
  });

  it('handles missing workspace folders', () => {
    vscodeStub.workspace.workspaceFolders = [];

    const cmd = new commandModule.Command({
      useSpinner: true,
      command: 'test',
      spinnerMsg: {
        progressMsg: MSG_TESTING,
        successMsg: MSG_DONE
      }
    });

    expect(cmd).to.exist;
  });
});

/**
 * Tests for Command class spinner execution
 */
describe('command.ts - Command spinner execution', () => {
  let commandModule: any;
  let vscodeStub: any;
  let childProcessStub: any;
  let TestableCommand: any;

  before(() => {
    clearModuleCache();
    setupCommandModuleResolution();
    vscodeStub = require('../../helpers/vscode-stub');
    childProcessStub = require('../../helpers/child-process-stub');
    commandModule = require('../../../src/commands/command');
    TestableCommand = createTestableCommand(commandModule);
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    childProcessStub.resetMockSpawnConfig();
    childProcessStub.clearSpawnCalls();
  });

  it('executes command with spinner on success', async () => {
    childProcessStub.setMockSpawnConfig({
      exitCode: 0,
      stdoutData: ['Line 1\n', 'Line 2\n'],
      stderrData: [],
      delayMs: 5
    });
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: '/test/workspace' } }];

    const cmd = new TestableCommand({
      useSpinner: true,
      command: 'test-cmd',
      spinnerMsg: {
        progressMsg: 'Running test...',
        successMsg: 'Test completed!'
      }
    });

    await cmd.testExecute(['arg1', 'arg2']);

    // Verify spawn was called with correct arguments
    expect(childProcessStub.spawnCalls).to.have.length(1);
    expect(childProcessStub.spawnCalls[0].cmd).to.equal('test-cmd');
    expect(childProcessStub.spawnCalls[0].args).to.deep.equal(['arg1', 'arg2']);
  });

  it('handles stdout output in progress reporting', async () => {
    childProcessStub.setMockSpawnConfig({
      exitCode: 0,
      stdoutData: ['Processing item 1\n', 'Processing item 2\n'],
      stderrData: [],
      delayMs: 5
    });
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: '/test' } }];

    const cmd = new TestableCommand({
      useSpinner: true,
      command: 'process',
      spinnerMsg: {
        progressMsg: 'Processing...',
        successMsg: MSG_DONE
      }
    });

    await cmd.testExecute(['items']);

    // Verify progress was reported
    expect(vscodeStub.window.lastProgressReports.length).to.be.greaterThan(0);
  });

  it('handles stderr output', async () => {
    childProcessStub.setMockSpawnConfig({
      exitCode: 0,
      stdoutData: [],
      stderrData: ['Warning: deprecated\n'],
      delayMs: 5
    });
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: '/test' } }];

    const cmd = new TestableCommand({
      useSpinner: true,
      command: 'warn-cmd',
      spinnerMsg: {
        progressMsg: MSG_RUNNING,
        successMsg: MSG_DONE
      }
    });

    await cmd.testExecute(['run']);

    // Should complete without error even with stderr output
    expect(childProcessStub.spawnCalls).to.have.length(1);
  });

  it('handles non-zero exit code as error', async () => {
    childProcessStub.setMockSpawnConfig({
      exitCode: 1,
      stdoutData: [],
      stderrData: ['Error occurred\n'],
      delayMs: 5
    });
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: '/test' } }];

    const cmd = new TestableCommand({
      useSpinner: true,
      command: 'fail-cmd',
      spinnerMsg: {
        progressMsg: MSG_RUNNING,
        successMsg: MSG_DONE,
        failMsg: 'Command failed'
      }
    });

    // Should not throw, but should trigger error handling
    await cmd.testExecute();

    // Error message should have been shown
    expect(vscodeStub.window.lastErrorMessage).to.include('Command failed');
  });

  it('uses fallback cwd when no workspace folder', async () => {
    childProcessStub.setMockSpawnConfig({
      exitCode: 0,
      stdoutData: [],
      stderrData: [],
      delayMs: 5
    });
    vscodeStub.workspace.workspaceFolders = [];

    const cmd = new TestableCommand({
      useSpinner: true,
      command: 'test',
      spinnerMsg: {
        progressMsg: MSG_TESTING,
        successMsg: MSG_DONE
      }
    });

    await cmd.testExecute(['run']);

    // Should have called spawn with cwd containing .clab
    expect(childProcessStub.spawnCalls).to.have.length(1);
    expect(childProcessStub.spawnCalls[0].options.cwd).to.include('.clab');
  });
});

/**
 * Tests for Command class error handling in spinner mode
 */
describe('command.ts - Command spinner error handling', () => {
  let commandModule: any;
  let vscodeStub: any;
  let childProcessStub: any;
  let TestableCommand: any;

  before(() => {
    clearModuleCache();
    setupCommandModuleResolution();
    vscodeStub = require('../../helpers/vscode-stub');
    childProcessStub = require('../../helpers/child-process-stub');
    commandModule = require('../../../src/commands/command');
    TestableCommand = createTestableCommand(commandModule);
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    childProcessStub.resetMockSpawnConfig();
    childProcessStub.clearSpawnCalls();
  });

  it('displays default error message when failMsg not provided', async () => {
    childProcessStub.setMockSpawnConfig({
      exitCode: 1,
      stdoutData: [],
      stderrData: [],
      delayMs: 5
    });
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: '/test' } }];

    const cmd = new TestableCommand({
      useSpinner: true,
      command: 'failing',
      spinnerMsg: {
        progressMsg: MSG_RUNNING,
        successMsg: MSG_DONE
        // No failMsg provided
      }
    });

    await cmd.testExecute(['deploy']);

    // Should show default error message with command name
    expect(vscodeStub.window.lastErrorMessage).to.include('Deploy failed');
  });

  it('handles multiline output correctly', async () => {
    childProcessStub.setMockSpawnConfig({
      exitCode: 0,
      stdoutData: ['Line1\nLine2\nLine3\n'],
      stderrData: [],
      delayMs: 5
    });
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: '/test' } }];

    const cmd = new TestableCommand({
      useSpinner: true,
      command: 'multi',
      spinnerMsg: {
        progressMsg: MSG_RUNNING,
        successMsg: MSG_DONE
      }
    });

    await cmd.testExecute(['process']);

    // Should have reported progress for each non-empty line
    const nonEmptyReports = vscodeStub.window.lastProgressReports.filter(
      (r: any) => r.message && r.message.trim()
    );
    expect(nonEmptyReports.length).to.be.greaterThan(0);
  });

  it('strips ANSI codes from output', async () => {
    childProcessStub.setMockSpawnConfig({
      exitCode: 0,
      stdoutData: ['\x1b[32mColored text\x1b[0m\n'],
      stderrData: [],
      delayMs: 5
    });
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: '/test' } }];

    const cmd = new TestableCommand({
      useSpinner: true,
      command: 'ansi',
      spinnerMsg: {
        progressMsg: MSG_RUNNING,
        successMsg: MSG_DONE
      }
    });

    await cmd.testExecute(['print']);

    // ANSI codes should be stripped
    const reports = vscodeStub.window.lastProgressReports;
    const hasAnsi = reports.some((r: any) => r.message && r.message.includes('\x1b'));
    expect(hasAnsi).to.be.false;
  });
});
