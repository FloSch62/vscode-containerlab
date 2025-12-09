/**
 * Dockerode stub for testing
 *
 * Provides mock implementations of Dockerode's Docker class for testing
 * container and image operations without requiring a real Docker daemon.
 */

interface MockImageState {
  exists: boolean;
  pullShouldFail?: boolean;
}

interface MockPortBinding {
  HostIp?: string;
  HostPort?: string;
}

interface MockContainerState {
  running: boolean;
  paused: boolean;
  name: string;
  labels?: Record<string, string>;
  networkId?: string;
  ports?: Record<string, MockPortBinding[] | undefined>;
}

interface MockNetworkState {
  name: string;
}

interface MockListContainer {
  Id: string;
  Names: string[];
  Image: string;
}

// Internal state
const images: Map<string, MockImageState> = new Map();
const containers: Map<string, MockContainerState> = new Map();
const networks: Map<string, MockNetworkState> = new Map();
const listedContainers: MockListContainer[] = [];
const createdContainers: { id: string; options: any }[] = [];
let pullCallCount = 0;
let createContainerShouldFail = false;
let createContainerError: Error | null = null;
let pingSuccess = true;

// Test helpers
export function setImageExists(image: string, exists: boolean, pullShouldFail = false): void {
  images.set(image, { exists, pullShouldFail });
}

export function setContainer(id: string, state: MockContainerState): void {
  containers.set(id, state);
}

export function setNetwork(id: string, state: MockNetworkState): void {
  networks.set(id, state);
}

export function addListContainer(container: MockListContainer): void {
  listedContainers.push(container);
}

export function setCreateContainerFail(shouldFail: boolean, error?: Error): void {
  createContainerShouldFail = shouldFail;
  createContainerError = error ?? null;
}

export function getCreatedContainers(): { id: string; options: any }[] {
  return [...createdContainers];
}

export function clearDockerMocks(): void {
  images.clear();
  containers.clear();
  networks.clear();
  listedContainers.length = 0;
  createdContainers.length = 0;
  pullCallCount = 0;
  createContainerShouldFail = false;
  createContainerError = null;
  pingSuccess = true;
}

export function setPingSuccess(success: boolean): void {
  pingSuccess = success;
}

export function resetDockerodeStub(): void {
  clearDockerMocks();
}

export function getPullCallCount(): number {
  return pullCallCount;
}

// Mock stream class for pull operations
class MockPullStream {
  private _shouldFail: boolean;

  constructor(shouldFail: boolean) {
    this._shouldFail = shouldFail;
  }

  get shouldFail(): boolean {
    return this._shouldFail;
  }
}

// Mock Container class
class MockContainer {
  id: string;
  private state: MockContainerState;

  constructor(id: string) {
    this.id = id;
    this.state = containers.get(id) ?? { running: false, paused: false, name: id };
  }

  async inspect(): Promise<{
    Id: string;
    Name: string;
    State: { Running: boolean; Paused: boolean };
    Config: { Labels: Record<string, string> };
    NetworkSettings: {
      Networks: Record<string, { NetworkID: string }>;
      Ports: Record<string, MockPortBinding[] | undefined>;
    };
  }> {
    const networkSettings: Record<string, { NetworkID: string }> = {};
    if (this.state.networkId) {
      networkSettings['bridge'] = { NetworkID: this.state.networkId };
    }
    return {
      Id: this.id,
      Name: this.state.name,
      State: { Running: this.state.running, Paused: this.state.paused },
      Config: { Labels: this.state.labels ?? {} },
      NetworkSettings: {
        Networks: networkSettings,
        Ports: this.state.ports ?? {}
      }
    };
  }

  async start(): Promise<void> {
    const s = containers.get(this.id);
    if (s) {
      s.running = true;
    }
  }

  async stop(): Promise<void> {
    const s = containers.get(this.id);
    if (s) {
      s.running = false;
    }
  }

  async pause(): Promise<void> {
    const s = containers.get(this.id);
    if (s) {
      s.paused = true;
    }
  }

  async unpause(): Promise<void> {
    const s = containers.get(this.id);
    if (s) {
      s.paused = false;
    }
  }

  async remove(_opts?: { force?: boolean }): Promise<void> {
    containers.delete(this.id);
  }
}

// Mock Image class
class MockImage {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  async inspect(): Promise<{ Id: string; RepoTags: string[] }> {
    const state = images.get(this.name);
    if (!state?.exists) {
      throw new Error(`Image ${this.name} not found`);
    }
    return { Id: this.name, RepoTags: [this.name] };
  }
}

// Mock Network class
class MockNetwork {
  private networkId: string;
  private state: MockNetworkState;

  constructor(networkId: string) {
    this.networkId = networkId;
    this.state = networks.get(networkId) ?? { name: 'bridge' };
  }

  async inspect(): Promise<{ Id: string; Name: string }> {
    return {
      Id: this.networkId,
      Name: this.state.name
    };
  }
}

// Main Docker mock class
class Docker {
  modem = {
    followProgress: (
      stream: MockPullStream,
      callback: (err?: Error) => void
    ): void => {
      // Simulate async progress completion
      const shouldFail = stream?.shouldFail;
      setTimeout(() => {
        callback(shouldFail ? new Error('Pull failed') : undefined);
      }, 0);
    }
  };

  async ping(): Promise<string> {
    if (!pingSuccess) {
      throw new Error('Cannot connect to Docker daemon');
    }
    return 'OK';
  }

  getImage(name: string): MockImage {
    return new MockImage(name);
  }

  async pull(image: string): Promise<MockPullStream> {
    pullCallCount++;
    const state = images.get(image);
    // Return a mock stream with metadata
    return new MockPullStream(state?.pullShouldFail ?? false);
  }

  getContainer(id: string): MockContainer {
    return new MockContainer(id);
  }

  getNetwork(id: string): MockNetwork {
    return new MockNetwork(id);
  }

  async listContainers(_opts?: { filters?: { name?: string[]; ancestor?: string[] } }): Promise<MockListContainer[]> {
    // Filter containers based on options if provided
    if (_opts?.filters) {
      return listedContainers.filter(c => {
        if (_opts.filters?.name) {
          const nameMatch = _opts.filters.name.some(n => c.Names.some(cn => cn.includes(n)));
          if (!nameMatch) return false;
        }
        if (_opts.filters?.ancestor) {
          const imageMatch = _opts.filters.ancestor.some(img => c.Image === img);
          if (!imageMatch) return false;
        }
        return true;
      });
    }
    return listedContainers;
  }

  async createContainer(opts: any): Promise<MockContainer> {
    if (createContainerShouldFail) {
      throw createContainerError ?? new Error('Container creation failed');
    }
    const id = `mock-container-${Date.now()}`;
    const state: MockContainerState = {
      running: false,
      paused: false,
      name: opts.name ?? id,
      labels: opts.Labels ?? {}
    };
    containers.set(id, state);
    createdContainers.push({ id, options: opts });
    return new MockContainer(id);
  }
}

export default Docker;
