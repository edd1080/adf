import { access, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

export type FileKind = "file" | "directory" | "symlink" | "other";

export interface FileSystem {
  read(path: string): Promise<Buffer>;
  write(path: string, content: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileKind>;
  rename(from: string, to: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export class NodeFileSystem implements FileSystem {
  async read(path: string): Promise<Buffer> {
    return readFile(path);
  }

  async write(path: string, content: Uint8Array): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  async stat(path: string): Promise<FileKind> {
    const details = await lstat(path);
    if (details.isSymbolicLink()) return "symlink";
    if (details.isFile()) return "file";
    if (details.isDirectory()) return "directory";
    return "other";
  }

  async rename(from: string, to: string): Promise<void> {
    await mkdir(dirname(to), { recursive: true });
    await rename(from, to);
  }

  async mkdir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  async remove(path: string): Promise<void> {
    await rm(path, { force: true });
  }
}

export function resolveInsideRoot(root: string, relativePath: string): string {
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(resolvedRoot, relativePath);

  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error(`Resolved path is outside project root: ${relativePath}`);
  }

  return resolvedTarget;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
