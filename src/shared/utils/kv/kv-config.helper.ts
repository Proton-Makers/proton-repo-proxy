import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { KVConfig } from '../../types';
import { getProjectRoot } from '../project';

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
