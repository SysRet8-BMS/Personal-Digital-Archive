import { realpath, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export class ArchiveRootError extends Error {}

export async function getArchiveRoot(): Promise<string> {
  const home = await realpath(os.homedir());
  const requested = process.env.ARCHIVE_ROOT?.trim() || `${home}${path.sep}Downloads`;
  let root: string;
  try {
    root = await realpath(requested);
  } catch {
    throw new ArchiveRootError(`Selected archive root does not exist: ${requested}`);
  }
  const info = await stat(root);
  if (!info.isDirectory()) throw new ArchiveRootError("Selected archive root must be an existing directory.");
  if (!containsPath(home, root)) throw new ArchiveRootError("Selected archive root must be inside the current user profile.");
  return root;
}

export async function resolveFileInsideRoot(filePath: string): Promise<{ root: string; filePath: string }> {
  const root = await getArchiveRoot();
  const resolved = await realpath(filePath);
  if (!containsPath(root, resolved)) throw new ArchiveRootError("File is outside the selected archive root.");
  const info = await stat(resolved);
  if (!info.isFile()) throw new ArchiveRootError("Selected path is not a file.");
  return { root, filePath: resolved };
}

export function containsPath(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}
