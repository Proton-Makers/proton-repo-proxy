
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Find the project root directory (where wrangler.toml is located)
 */
export function getProjectRoot(): string {
  // Get the directory of this script file
  const currentFile = fileURLToPath(import.meta.url);
  let dir = dirname(currentFile);

  // Walk up the directory tree to find wrangler.toml
  while (dir !== dirname(dir)) {
    const wranglerPath = join(dir, 'wrangler.toml');
    if (existsSync(wranglerPath)) {
      return dir;
    }
    dir = dirname(dir);
  }

  throw new Error('wrangler.toml not found in project tree');
}
