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

interface MockContainerState {
  running: boolean;
  paused: boolean;
  name: string;
}

// Internal state
const images: Map<string, MockImageState> = new Map();
const containers: Map<string, MockContainerState> = new Map();
let pullCallCount = 0;

// Test helpers
export function setImageExists(image: string, exists: boolean, pullShouldFail = false): void {
  images.set(image, { exists, pullShouldFail });
}

export function setContainer(id: string, state: MockContainerState): void {
  containers.set(id, state);
}

export function clearDockerMocks(): void {
  images.clear();
  containers.clear();
  pullCallCount = 0;
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
  }> {
    return {
      Id: this.id,
      Name: this.state.name,
      State: { Running: this.state.running, Paused: this.state.paused }
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
}

export default Docker;
