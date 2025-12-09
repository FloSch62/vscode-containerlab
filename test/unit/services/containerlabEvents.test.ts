/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

// Constants for test data
const TEST_LAB = 'mylab';
const TEST_CONTAINER_ID = 'abc123456789';
const TEST_NODE_NAME = 'node1';
const TEST_CLAB_NODE_NAME = 'clab-mylab-node1';
const RUNNING_STATE = 'running';
const EXITED_STATE = 'exited';

// Helper to clear module cache
function clearModuleCache(): void {
  Object.keys(require.cache).forEach(key => {
    if (key.includes('vscode-containerlab') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  });
}

// Helper to setup module interception
function setupModuleInterception(originalResolve: any): void {
  (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
    if (request === 'vscode') {
      return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
    }
    if (request.includes('extension') && !request.includes('stub') && !request.includes('test')) {
      return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
}

// =============================================================================
// containerlabEvents - Basic Container Operations
// =============================================================================

describe('containerlabEvents - containers', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let eventsModule: any;

  before(() => {
    clearModuleCache();
    setupModuleInterception(originalResolve);
    require('../../helpers/vscode-stub');
    eventsModule = require('../../../src/services/containerlabEvents');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    eventsModule.resetForTests();
  });

  it('returns empty object initially', () => {
    expect(eventsModule.getGroupedContainers()).to.deep.equal({});
  });

  it('groups containers by lab name after container event', () => {
    const event = {
      type: 'container',
      action: 'start',
      actor_id: TEST_CONTAINER_ID,
      attributes: {
        containerlab: TEST_LAB,
        'clab-topo-file': '/path/to/mylab.clab.yml',
        name: TEST_CLAB_NODE_NAME,
        'clab-node-name': TEST_NODE_NAME,
        'clab-node-kind': 'linux',
        state: RUNNING_STATE,
        image: 'alpine:latest'
      }
    };
    eventsModule.injectTestEventLine(JSON.stringify(event));

    const containers = eventsModule.getGroupedContainers();
    expect(containers).to.have.property(TEST_LAB);
    expect(containers[TEST_LAB]).to.have.length(1);
    expect(containers[TEST_LAB][0].ShortID).to.equal(TEST_CONTAINER_ID);
    expect(containers[TEST_LAB][0].State).to.equal(RUNNING_STATE);
  });

  it('updates container state on subsequent events', () => {
    const startEvent = {
      type: 'container', action: 'start', actor_id: TEST_CONTAINER_ID,
      attributes: { containerlab: TEST_LAB, name: TEST_CLAB_NODE_NAME, state: RUNNING_STATE }
    };
    const stopEvent = {
      type: 'container', action: 'stop', actor_id: TEST_CONTAINER_ID,
      attributes: { containerlab: TEST_LAB, name: TEST_CLAB_NODE_NAME, state: EXITED_STATE }
    };

    eventsModule.injectTestEventLine(JSON.stringify(startEvent));
    eventsModule.injectTestEventLine(JSON.stringify(stopEvent));

    const containers = eventsModule.getGroupedContainers();
    expect(containers[TEST_LAB][0].State).to.equal(EXITED_STATE);
  });

  it('removes container on destroy event', () => {
    const createEvent = {
      type: 'container', action: 'create', actor_id: TEST_CONTAINER_ID,
      attributes: { containerlab: TEST_LAB, name: TEST_CLAB_NODE_NAME, state: 'created' }
    };
    const destroyEvent = {
      type: 'container', action: 'destroy', actor_id: TEST_CONTAINER_ID, attributes: {}
    };

    eventsModule.injectTestEventLine(JSON.stringify(createEvent));
    expect(eventsModule.getGroupedContainers()).to.have.property(TEST_LAB);

    eventsModule.injectTestEventLine(JSON.stringify(destroyEvent));
    expect(eventsModule.getGroupedContainers()).to.deep.equal({});
  });

  it('handles multiple labs', () => {
    const event1 = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: 'lab1', name: TEST_NODE_NAME, state: RUNNING_STATE }
    };
    const event2 = {
      type: 'container', action: 'start', actor_id: 'def456',
      attributes: { containerlab: 'lab2', name: 'node2', state: RUNNING_STATE }
    };

    eventsModule.injectTestEventLine(JSON.stringify(event1));
    eventsModule.injectTestEventLine(JSON.stringify(event2));

    const containers = eventsModule.getGroupedContainers();
    expect(containers).to.have.property('lab1');
    expect(containers).to.have.property('lab2');
  });
});

// =============================================================================
// containerlabEvents - State Derivation and Actions
// =============================================================================

describe('containerlabEvents - state derivation', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let eventsModule: any;

  before(() => {
    clearModuleCache();
    setupModuleInterception(originalResolve);
    require('../../helpers/vscode-stub');
    eventsModule = require('../../../src/services/containerlabEvents');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    eventsModule.resetForTests();
  });

  it('derives state from action when state is not provided', () => {
    const event = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME }
    };
    eventsModule.injectTestEventLine(JSON.stringify(event));
    expect(eventsModule.getGroupedContainers()[TEST_LAB][0].State).to.equal(RUNNING_STATE);
  });

  it('ignores exec events', () => {
    const createEvent = {
      type: 'container', action: 'create', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: 'created' }
    };
    const execEvent = {
      type: 'container', action: 'exec_start: bash', actor_id: 'abc123', attributes: {}
    };

    eventsModule.injectTestEventLine(JSON.stringify(createEvent));
    const beforeExec = eventsModule.getGroupedContainers()[TEST_LAB][0].State;

    eventsModule.injectTestEventLine(JSON.stringify(execEvent));
    expect(eventsModule.getGroupedContainers()[TEST_LAB][0].State).to.equal(beforeExec);
  });

  it('handles pause and unpause actions', () => {
    const startEvent = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: RUNNING_STATE }
    };
    const pauseEvent = {
      type: 'container', action: 'pause', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME }
    };
    const unpauseEvent = {
      type: 'container', action: 'unpause', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME }
    };

    eventsModule.injectTestEventLine(JSON.stringify(startEvent));
    expect(eventsModule.getGroupedContainers()[TEST_LAB][0].State).to.equal(RUNNING_STATE);

    eventsModule.injectTestEventLine(JSON.stringify(pauseEvent));
    expect(eventsModule.getGroupedContainers()[TEST_LAB][0].State).to.equal('paused');

    eventsModule.injectTestEventLine(JSON.stringify(unpauseEvent));
    expect(eventsModule.getGroupedContainers()[TEST_LAB][0].State).to.equal(RUNNING_STATE);
  });

  it('handles die action', () => {
    const startEvent = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: RUNNING_STATE }
    };
    const dieEvent = {
      type: 'container', action: 'die', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME }
    };

    eventsModule.injectTestEventLine(JSON.stringify(startEvent));
    eventsModule.injectTestEventLine(JSON.stringify(dieEvent));

    expect(eventsModule.getGroupedContainers()[TEST_LAB][0].State).to.equal(EXITED_STATE);
  });
});

// =============================================================================
// containerlabEvents - Network and Labels
// =============================================================================

describe('containerlabEvents - network and labels', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let eventsModule: any;

  before(() => {
    clearModuleCache();
    setupModuleInterception(originalResolve);
    require('../../helpers/vscode-stub');
    eventsModule = require('../../../src/services/containerlabEvents');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    eventsModule.resetForTests();
  });

  it('parses network settings from attributes', () => {
    const event = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: {
        containerlab: TEST_LAB, name: TEST_NODE_NAME,
        mgmt_ipv4: '172.20.20.2/24', mgmt_ipv6: '2001:db8::2/64', state: RUNNING_STATE
      }
    };
    eventsModule.injectTestEventLine(JSON.stringify(event));

    const settings = eventsModule.getGroupedContainers()[TEST_LAB][0].NetworkSettings;
    expect(settings.IPv4addr).to.equal('172.20.20.2');
    expect(settings.IPv4pLen).to.equal(24);
    expect(settings.IPv6addr).to.equal('2001:db8::2');
    expect(settings.IPv6pLen).to.equal(64);
  });

  it('preserves labels from events', () => {
    const event = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: {
        containerlab: TEST_LAB, 'clab-topo-file': '/path/to/topo.yml',
        'clab-node-name': 'srl1', 'clab-node-kind': 'nokia_srlinux',
        'clab-owner': 'admin', name: 'clab-mylab-srl1', state: RUNNING_STATE
      }
    };
    eventsModule.injectTestEventLine(JSON.stringify(event));

    const labels = eventsModule.getGroupedContainers()[TEST_LAB][0].Labels;
    expect(labels['clab-node-name']).to.equal('srl1');
    expect(labels['clab-node-kind']).to.equal('nokia_srlinux');
    expect(labels['clab-owner']).to.equal('admin');
    expect(labels.containerlab).to.equal(TEST_LAB);
  });

  it('includes topo-file in grouped containers', () => {
    const event = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: {
        containerlab: TEST_LAB, 'clab-topo-file': '/home/user/labs/mylab.clab.yml',
        name: TEST_NODE_NAME, state: RUNNING_STATE
      }
    };
    eventsModule.injectTestEventLine(JSON.stringify(event));

    const containers = eventsModule.getGroupedContainers();
    expect((containers[TEST_LAB] as any)['topo-file']).to.equal('/home/user/labs/mylab.clab.yml');
  });
});

// =============================================================================
// containerlabEvents - Interface Events
// =============================================================================

describe('containerlabEvents - interfaces', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let eventsModule: any;

  before(() => {
    clearModuleCache();
    setupModuleInterception(originalResolve);
    require('../../helpers/vscode-stub');
    eventsModule = require('../../../src/services/containerlabEvents');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    eventsModule.resetForTests();
  });

  it('tracks interface data for containers', () => {
    const containerEvent = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_CLAB_NODE_NAME, state: RUNNING_STATE }
    };
    const interfaceEvent = {
      type: 'interface', action: 'update', actor_id: 'abc123',
      attributes: { ifname: 'eth0', type: 'veth', state: 'up', mac: '00:11:22:33:44:55', mtu: 1500, index: 2 }
    };

    eventsModule.injectTestEventLine(JSON.stringify(containerEvent));
    eventsModule.injectTestEventLine(JSON.stringify(interfaceEvent));

    const snapshot = eventsModule.getInterfaceSnapshot('abc123', TEST_CLAB_NODE_NAME);
    expect(snapshot).to.have.length(1);
    expect(snapshot[0].interfaces).to.have.length(1);
    expect(snapshot[0].interfaces[0].name).to.equal('eth0');
    expect(snapshot[0].interfaces[0].mac).to.equal('00:11:22:33:44:55');
    expect(snapshot[0].interfaces[0].mtu).to.equal(1500);
  });

  it('removes interface on delete action', () => {
    const containerEvent = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: RUNNING_STATE }
    };
    const addInterface = {
      type: 'interface', action: 'update', actor_id: 'abc123',
      attributes: { ifname: 'eth0', state: 'up' }
    };
    const deleteInterface = {
      type: 'interface', action: 'delete', actor_id: 'abc123',
      attributes: { ifname: 'eth0' }
    };

    eventsModule.injectTestEventLine(JSON.stringify(containerEvent));
    eventsModule.injectTestEventLine(JSON.stringify(addInterface));
    expect(eventsModule.getInterfaceSnapshot('abc123', TEST_NODE_NAME)[0].interfaces).to.have.length(1);

    eventsModule.injectTestEventLine(JSON.stringify(deleteInterface));
    expect(eventsModule.getInterfaceSnapshot('abc123', TEST_NODE_NAME)).to.have.length(0);
  });

  it('ignores clab- prefixed interfaces', () => {
    const containerEvent = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: RUNNING_STATE }
    };
    const clabInterface = {
      type: 'interface', action: 'update', actor_id: 'abc123',
      attributes: { ifname: 'clab-mylab-eth0', state: 'up' }
    };

    eventsModule.injectTestEventLine(JSON.stringify(containerEvent));
    eventsModule.injectTestEventLine(JSON.stringify(clabInterface));

    expect(eventsModule.getInterfaceSnapshot('abc123', TEST_NODE_NAME)).to.have.length(0);
  });

  it('tracks interface statistics', () => {
    const containerEvent = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: RUNNING_STATE }
    };
    const interfaceEvent = {
      type: 'interface', action: 'update', actor_id: 'abc123',
      attributes: { ifname: 'eth0', state: 'up', rx_bps: 1000, tx_bps: 2000, rx_packets: 100, tx_packets: 200 }
    };

    eventsModule.injectTestEventLine(JSON.stringify(containerEvent));
    eventsModule.injectTestEventLine(JSON.stringify(interfaceEvent));

    const snapshot = eventsModule.getInterfaceSnapshot('abc123', TEST_NODE_NAME);
    const iface = snapshot[0].interfaces[0];
    expect(iface.rxBps).to.equal(1000);
    expect(iface.txBps).to.equal(2000);
    expect(iface.rxPackets).to.equal(100);
    expect(iface.txPackets).to.equal(200);
  });
});

// =============================================================================
// containerlabEvents - Interface Version Tracking
// =============================================================================

describe('containerlabEvents - interface version', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let eventsModule: any;

  before(() => {
    clearModuleCache();
    setupModuleInterception(originalResolve);
    require('../../helpers/vscode-stub');
    eventsModule = require('../../../src/services/containerlabEvents');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    eventsModule.resetForTests();
  });

  it('returns 0 for unknown containers', () => {
    expect(eventsModule.getInterfaceVersion('unknown')).to.equal(0);
  });

  it('increments version on interface changes', () => {
    const containerEvent = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: RUNNING_STATE }
    };
    const interfaceEvent1 = {
      type: 'interface', action: 'update', actor_id: 'abc123',
      attributes: { ifname: 'eth0', state: 'up' }
    };
    const interfaceEvent2 = {
      type: 'interface', action: 'update', actor_id: 'abc123',
      attributes: { ifname: 'eth0', state: 'down' }
    };

    eventsModule.injectTestEventLine(JSON.stringify(containerEvent));
    const v0 = eventsModule.getInterfaceVersion('abc123');

    eventsModule.injectTestEventLine(JSON.stringify(interfaceEvent1));
    const v1 = eventsModule.getInterfaceVersion('abc123');

    eventsModule.injectTestEventLine(JSON.stringify(interfaceEvent2));
    const v2 = eventsModule.getInterfaceVersion('abc123');

    expect(v1).to.be.greaterThan(v0);
    expect(v2).to.be.greaterThan(v1);
  });
});

// =============================================================================
// containerlabEvents - Listeners and Reset
// =============================================================================

describe('containerlabEvents - listeners', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let eventsModule: any;

  before(() => {
    clearModuleCache();
    setupModuleInterception(originalResolve);
    require('../../helpers/vscode-stub');
    eventsModule = require('../../../src/services/containerlabEvents');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    eventsModule.resetForTests();
  });

  it('onDataChanged returns a dispose function', () => {
    const dispose = eventsModule.onDataChanged(() => {});
    expect(typeof dispose).to.equal('function');
    dispose();
  });

  it('onDataChanged notifies listeners on data changes', (done) => {
    let called = false;
    const dispose = eventsModule.onDataChanged(() => { called = true; });

    const event = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: RUNNING_STATE }
    };
    eventsModule.injectTestEventLine(JSON.stringify(event));

    setTimeout(() => {
      expect(called).to.be.true;
      dispose();
      done();
    }, 100);
  });

  it('onContainerStateChanged returns a dispose function', () => {
    const dispose = eventsModule.onContainerStateChanged(() => {});
    expect(typeof dispose).to.equal('function');
    dispose();
  });

  it('onContainerStateChanged notifies on state changes', (done) => {
    let stateChange: { id: string; state: string } | null = null;
    const dispose = eventsModule.onContainerStateChanged((id: string, state: string) => {
      stateChange = { id, state };
    });

    const startEvent = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: RUNNING_STATE }
    };
    const stopEvent = {
      type: 'container', action: 'stop', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: EXITED_STATE }
    };

    eventsModule.injectTestEventLine(JSON.stringify(startEvent));
    eventsModule.injectTestEventLine(JSON.stringify(stopEvent));

    setTimeout(() => {
      expect(stateChange).to.not.be.null;
      expect(stateChange!.id).to.equal('abc123');
      expect(stateChange!.state).to.equal(EXITED_STATE);
      dispose();
      done();
    }, 50);
  });

  it('resetForTests clears all state', () => {
    const event = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: RUNNING_STATE }
    };
    eventsModule.injectTestEventLine(JSON.stringify(event));
    expect(Object.keys(eventsModule.getGroupedContainers())).to.have.length.greaterThan(0);

    eventsModule.resetForTests();
    expect(eventsModule.getGroupedContainers()).to.deep.equal({});
  });
});

// =============================================================================
// containerlabEvents - Error Handling
// =============================================================================

describe('containerlabEvents - error handling', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let eventsModule: any;

  before(() => {
    clearModuleCache();
    setupModuleInterception(originalResolve);
    require('../../helpers/vscode-stub');
    eventsModule = require('../../../src/services/containerlabEvents');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    eventsModule.resetForTests();
  });

  it('handles invalid JSON gracefully', () => {
    expect(() => eventsModule.injectTestEventLine('not valid json')).to.not.throw();
  });

  it('handles empty lines gracefully', () => {
    expect(() => eventsModule.injectTestEventLine('')).to.not.throw();
    expect(() => eventsModule.injectTestEventLine('   ')).to.not.throw();
  });

  it('handles events without actor_id gracefully', () => {
    const event = { type: 'interface', action: 'update', attributes: { ifname: 'eth0', state: 'up' } };
    expect(() => eventsModule.injectTestEventLine(JSON.stringify(event))).to.not.throw();
  });

  it('handles events without attributes gracefully', () => {
    const event = { type: 'container', action: 'start', actor_id: 'abc123' };
    expect(() => eventsModule.injectTestEventLine(JSON.stringify(event))).to.not.throw();
  });
});

// =============================================================================
// containerlabEvents - Additional Container Events
// =============================================================================

describe('containerlabEvents - container lifecycle', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let eventsModule: any;

  before(() => {
    clearModuleCache();
    setupModuleInterception(originalResolve);
    require('../../helpers/vscode-stub');
    eventsModule = require('../../../src/services/containerlabEvents');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    eventsModule.resetForTests();
  });

  it('handles create action', () => {
    const event = {
      type: 'container', action: 'create', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: 'created' }
    };
    eventsModule.injectTestEventLine(JSON.stringify(event));
    expect(eventsModule.getGroupedContainers()[TEST_LAB][0].State).to.equal('created');
  });

  it('handles stop action', () => {
    const startEvent = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: RUNNING_STATE }
    };
    const stopEvent = {
      type: 'container', action: 'stop', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: EXITED_STATE }
    };
    eventsModule.injectTestEventLine(JSON.stringify(startEvent));
    eventsModule.injectTestEventLine(JSON.stringify(stopEvent));
    expect(eventsModule.getGroupedContainers()[TEST_LAB][0].State).to.equal(EXITED_STATE);
  });

  it('handles kill action', () => {
    const startEvent = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: RUNNING_STATE }
    };
    const killEvent = {
      type: 'container', action: 'kill', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME }
    };
    eventsModule.injectTestEventLine(JSON.stringify(startEvent));
    eventsModule.injectTestEventLine(JSON.stringify(killEvent));
    expect(eventsModule.getGroupedContainers()[TEST_LAB][0].State).to.equal(EXITED_STATE);
  });

  it('handles restart action', () => {
    const startEvent = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: RUNNING_STATE }
    };
    const restartEvent = {
      type: 'container', action: 'restart', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME }
    };
    eventsModule.injectTestEventLine(JSON.stringify(startEvent));
    eventsModule.injectTestEventLine(JSON.stringify(restartEvent));
    expect(eventsModule.getGroupedContainers()[TEST_LAB][0].State).to.equal(RUNNING_STATE);
  });
});

// =============================================================================
// containerlabEvents - Interface Statistics
// =============================================================================

describe('containerlabEvents - interface stats', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let eventsModule: any;

  before(() => {
    clearModuleCache();
    setupModuleInterception(originalResolve);
    require('../../helpers/vscode-stub');
    eventsModule = require('../../../src/services/containerlabEvents');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    eventsModule.resetForTests();
  });

  it('tracks all interface statistics fields', () => {
    const containerEvent = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: RUNNING_STATE }
    };
    const interfaceEvent = {
      type: 'interface', action: 'update', actor_id: 'abc123',
      attributes: {
        ifname: 'eth0', state: 'up', type: 'veth',
        rx_bps: 1000, tx_bps: 2000,
        rx_pps: 10, tx_pps: 20,
        rx_bytes: 10000, tx_bytes: 20000,
        rx_packets: 100, tx_packets: 200,
        interval_seconds: 5
      }
    };

    eventsModule.injectTestEventLine(JSON.stringify(containerEvent));
    eventsModule.injectTestEventLine(JSON.stringify(interfaceEvent));

    const snapshot = eventsModule.getInterfaceSnapshot('abc123', TEST_NODE_NAME);
    const iface = snapshot[0].interfaces[0];
    expect(iface.rxBps).to.equal(1000);
    expect(iface.txBps).to.equal(2000);
    expect(iface.rxPps).to.equal(10);
    expect(iface.txPps).to.equal(20);
    expect(iface.rxBytes).to.equal(10000);
    expect(iface.txBytes).to.equal(20000);
    expect(iface.rxPackets).to.equal(100);
    expect(iface.txPackets).to.equal(200);
    expect(iface.statsIntervalSeconds).to.equal(5);
  });

  it('updates interface state correctly', () => {
    const containerEvent = {
      type: 'container', action: 'start', actor_id: 'abc123',
      attributes: { containerlab: TEST_LAB, name: TEST_NODE_NAME, state: RUNNING_STATE }
    };
    const ifUpEvent = {
      type: 'interface', action: 'update', actor_id: 'abc123',
      attributes: { ifname: 'eth0', state: 'up' }
    };
    const ifDownEvent = {
      type: 'interface', action: 'update', actor_id: 'abc123',
      attributes: { ifname: 'eth0', state: 'down' }
    };

    eventsModule.injectTestEventLine(JSON.stringify(containerEvent));
    eventsModule.injectTestEventLine(JSON.stringify(ifUpEvent));
    let snapshot = eventsModule.getInterfaceSnapshot('abc123', TEST_NODE_NAME);
    expect(snapshot[0].interfaces[0].state).to.equal('up');

    eventsModule.injectTestEventLine(JSON.stringify(ifDownEvent));
    snapshot = eventsModule.getInterfaceSnapshot('abc123', TEST_NODE_NAME);
    expect(snapshot[0].interfaces[0].state).to.equal('down');
  });
});
