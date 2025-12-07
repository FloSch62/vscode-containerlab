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

describe('command.ts - terminal and output execution', () => {
  let commandModule: any;
  let vscodeStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

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

  describe('execCommandInTerminal()', () => {
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

  describe('Command class', () => {
    it('constructs with spinner options', () => {
      const cmd = new commandModule.Command({
        useSpinner: true,
        command: 'test-command',
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
        command: 'test-command',
        terminalName: 'Test Term'
      });

      expect(cmd).to.exist;
    });
  });
});
