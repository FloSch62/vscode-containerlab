/**
 * InMemoryFileSystemAdapter
 *
 * Browser-friendly FileSystemAdapter implementation backed by a Map.
 * Intended for standalone web builds where all I/O is in-memory.
 */

import type { FileSystemAdapter } from "./types";

function normalizePath(input: string): string {
  const normalized = input.replace(/\\/g, "/");
  const isAbsolute = normalized.startsWith("/");
  const parts = normalized.split("/").filter((part) => part.length > 0);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(part);
  }
  const result = (isAbsolute ? "/" : "") + stack.join("/");
  return result || (isAbsolute ? "/" : ".");
}

function splitDirBase(filePath: string): { dir: string; base: string } {
  const normalized = normalizePath(filePath);
  if (normalized === "/" || normalized === ".") {
    return { dir: ".", base: "" };
  }
  const idx = normalized.lastIndexOf("/");
  if (idx === -1) {
    return { dir: ".", base: normalized };
  }
  if (idx === 0) {
    return { dir: "/", base: normalized.slice(1) };
  }
  return { dir: normalized.slice(0, idx), base: normalized.slice(idx + 1) };
}

export class InMemoryFileSystemAdapter implements FileSystemAdapter {
  private files = new Map<string, string>();

  constructor(initialFiles?: Record<string, string>) {
    if (initialFiles) {
      for (const [path, content] of Object.entries(initialFiles)) {
        this.files.set(normalizePath(path), content);
      }
    }
  }

  async readFile(filePath: string): Promise<string> {
    const key = normalizePath(filePath);
    if (!this.files.has(key)) {
      throw new Error(`ENOENT: no such file ${filePath}`);
    }
    return this.files.get(key) ?? "";
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const key = normalizePath(filePath);
    this.files.set(key, content);
  }

  async unlink(filePath: string): Promise<void> {
    const key = normalizePath(filePath);
    this.files.delete(key);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const from = normalizePath(oldPath);
    const to = normalizePath(newPath);
    if (!this.files.has(from)) {
      throw new Error(`ENOENT: no such file ${oldPath}`);
    }
    const content = this.files.get(from) ?? "";
    this.files.set(to, content);
    this.files.delete(from);
  }

  async exists(filePath: string): Promise<boolean> {
    return this.files.has(normalizePath(filePath));
  }

  dirname(filePath: string): string {
    return splitDirBase(filePath).dir;
  }

  basename(filePath: string): string {
    return splitDirBase(filePath).base;
  }

  join(...segments: string[]): string {
    const parts = segments.filter((seg) => seg.length > 0);
    if (parts.length === 0) return ".";
    if (parts.length === 1) return normalizePath(parts[0]);
    const combined = parts.join("/");
    const normalized = normalizePath(combined);
    if (normalized === "." && parts[0] === "/") return "/";
    if (normalized.startsWith("./")) return normalized.slice(2);
    return normalized === "." ? "" : normalized;
  }
}
