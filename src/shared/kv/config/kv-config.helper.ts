import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { KVConfig } from './kv-config.model';

/**
 * Read KV configuration from wrangler.toml
 */
export function getKVConfig(): KVConfig {
  const projectRoot = getProjectRoot();
  const wranglerPath = join(projectRoot, 'wrangler.toml');

  if (!existsSync(wranglerPath)) {
    throw new Error(`wrangler.toml not found at ${wranglerPath}`);
  }

  const content = readFileSync(wranglerPath, 'utf-8');

  // Simple TOML parsing for KV namespace
  const namespaceMatch = content.match(
    /\[\[kv_namespaces\]\]\s*binding\s*=\s*"REPO_CACHE"\s*id\s*=\s*"([^"]+)"/s
  );

  if (!namespaceMatch) {
    throw new Error('REPO_CACHE namespace not found in wrangler.toml');
  }

  const namespaceId = namespaceMatch[1];
  if (!namespaceId) {
    throw new Error('Invalid namespace ID in wrangler.toml');
  }

  return {
    namespaceId,
    binding: 'REPO_CACHE',
  };
}

// -- Internal Helpers ---------------------------------------------------------

/**
 * Find the project root directory (where wrangler.toml is located)
 */
function getProjectRoot(): string {
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
