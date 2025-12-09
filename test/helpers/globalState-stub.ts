// Global state stub for testing VS Code extension persistence
const storage = new Map<string, any>();

export const globalState = {
  get<T>(key: string, defaultValue?: T): T | undefined {
    return storage.has(key) ? storage.get(key) : defaultValue;
  },

  async update(key: string, value: any): Promise<void> {
    storage.set(key, value);
  },

  keys(): readonly string[] {
    return Array.from(storage.keys());
  }
};

export function setGlobalState(key: string, value: any): void {
  storage.set(key, value);
}

export function clearGlobalState(): void {
  storage.clear();
}
