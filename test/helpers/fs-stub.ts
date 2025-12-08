/**
 * File System stub for testing
 *
 * Provides mock implementations of Node.js fs module for testing
 * file I/O operations without touching the real filesystem.
 */

interface MockFile {
  content: string;
  exists: boolean;
}

interface MockDirectory {
  exists: boolean;
}

interface ErrnoException extends Error {
  code?: string;
  errno?: number;
  path?: string;
  syscall?: string;
}

// Internal state
const files: Map<string, MockFile> = new Map();
const directories: Map<string, MockDirectory> = new Map();
let accessError: Error | null = null;
let readError: Error | null = null;
let writeError: Error | null = null;

/**
 * Mock fs.promises API
 */
export const promises = {
  async access(filePath: string): Promise<void> {
    if (accessError) {
      throw accessError;
    }
    const file = files.get(filePath);
    if (!file?.exists) {
      const error = new Error(`ENOENT: no such file or directory, access '${filePath}'`) as ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
  },

  async readFile(filePath: string, _encoding?: string): Promise<string> {
    if (readError) {
      throw readError;
    }
    const file = files.get(filePath);
    if (!file?.exists) {
      const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`) as ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    return file.content;
  },

  async writeFile(filePath: string, content: string, _encoding?: string): Promise<void> {
    if (writeError) {
      throw writeError;
    }
    files.set(filePath, { content, exists: true });
  },

  async unlink(filePath: string): Promise<void> {
    const file = files.get(filePath);
    if (!file?.exists) {
      const error = new Error(`ENOENT: no such file or directory, unlink '${filePath}'`) as ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    files.delete(filePath);
  },

  async mkdir(dirPath: string, _options?: { recursive?: boolean }): Promise<string | undefined> {
    directories.set(dirPath, { exists: true });
    return dirPath;
  },

  async rmdir(dirPath: string): Promise<void> {
    directories.delete(dirPath);
  },

  async stat(filePath: string): Promise<{ isFile: () => boolean; isDirectory: () => boolean }> {
    const file = files.get(filePath);
    const dir = directories.get(filePath);

    if (file?.exists) {
      return {
        isFile: () => true,
        isDirectory: () => false
      };
    }

    if (dir?.exists) {
      return {
        isFile: () => false,
        isDirectory: () => true
      };
    }

    const error = new Error(`ENOENT: no such file or directory, stat '${filePath}'`) as ErrnoException;
    error.code = 'ENOENT';
    throw error;
  },

  async readdir(dirPath: string): Promise<string[]> {
    const dir = directories.get(dirPath);
    if (!dir?.exists) {
      const error = new Error(`ENOENT: no such file or directory, scandir '${dirPath}'`) as ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }

    // Return files that are in this directory
    const result: string[] = [];
    const prefix = dirPath.endsWith('/') ? dirPath : dirPath + '/';

    for (const [path] of files) {
      if (path.startsWith(prefix)) {
        const relativePath = path.slice(prefix.length);
        const firstSegment = relativePath.split('/')[0];
        if (!result.includes(firstSegment)) {
          result.push(firstSegment);
        }
      }
    }

    return result;
  },

  async copyFile(src: string, dest: string): Promise<void> {
    const file = files.get(src);
    if (!file?.exists) {
      const error = new Error(`ENOENT: no such file or directory, copyfile '${src}'`) as ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    files.set(dest, { content: file.content, exists: true });
  },

  async rename(oldPath: string, newPath: string): Promise<void> {
    const file = files.get(oldPath);
    if (!file?.exists) {
      const error = new Error(`ENOENT: no such file or directory, rename '${oldPath}'`) as ErrnoException;
      error.code = 'ENOENT';
      throw error;
    }
    files.set(newPath, { content: file.content, exists: true });
    files.delete(oldPath);
  }
};

// Synchronous API (for compatibility)
export function existsSync(filePath: string): boolean {
  return files.get(filePath)?.exists ?? directories.get(filePath)?.exists ?? false;
}

export function readFileSync(filePath: string, _encoding?: string): string {
  if (readError) {
    throw readError;
  }
  const file = files.get(filePath);
  if (!file?.exists) {
    const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`) as ErrnoException;
    error.code = 'ENOENT';
    throw error;
  }
  return file.content;
}

export function writeFileSync(filePath: string, content: string, _encoding?: string): void {
  if (writeError) {
    throw writeError;
  }
  files.set(filePath, { content, exists: true });
}

export function mkdirSync(dirPath: string, _options?: { recursive?: boolean }): string | undefined {
  directories.set(dirPath, { exists: true });
  return dirPath;
}

export function unlinkSync(filePath: string): void {
  const file = files.get(filePath);
  if (!file?.exists) {
    const error = new Error(`ENOENT: no such file or directory, unlink '${filePath}'`) as ErrnoException;
    error.code = 'ENOENT';
    throw error;
  }
  files.delete(filePath);
}

// Test helpers
export function setFile(filePath: string, content: string): void {
  files.set(filePath, { content, exists: true });
}

export function removeFile(filePath: string): void {
  files.delete(filePath);
}

export function setDirectory(dirPath: string): void {
  directories.set(dirPath, { exists: true });
}

export function removeDirectory(dirPath: string): void {
  directories.delete(dirPath);
}

export function getFile(filePath: string): string | undefined {
  const file = files.get(filePath);
  return file?.exists ? file.content : undefined;
}

export function fileExists(filePath: string): boolean {
  return files.get(filePath)?.exists ?? false;
}

export function directoryExists(dirPath: string): boolean {
  return directories.get(dirPath)?.exists ?? false;
}

export function getAllFiles(): Map<string, string> {
  const result = new Map<string, string>();
  for (const [path, file] of files) {
    if (file.exists) {
      result.set(path, file.content);
    }
  }
  return result;
}

export function setAccessError(error: Error | null): void {
  accessError = error;
}

export function setReadError(error: Error | null): void {
  readError = error;
}

export function setWriteError(error: Error | null): void {
  writeError = error;
}

export function clearFileSystem(): void {
  files.clear();
  directories.clear();
  accessError = null;
  readError = null;
  writeError = null;
}

export function resetFsStub(): void {
  clearFileSystem();
}
