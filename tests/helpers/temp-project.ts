import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export type TempProject = {
  root: string;
  path(relativePath: string): string;
  write(relativePath: string, content: string): Promise<void>;
  cleanup(): Promise<void>;
};

export async function createTempProject(): Promise<TempProject> {
  const root = await mkdtemp(join(tmpdir(), "adf-project-"));

  return {
    root,
    path: (relativePath) => join(root, relativePath),
    async write(relativePath, content) {
      const target = join(root, relativePath);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content);
    },
    async cleanup() {
      await rm(root, { recursive: true, force: true });
    },
  };
}
