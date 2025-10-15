#!/usr/bin/env tsx
/**
 * Download package-hashes from Cloudflare KV
 * Usage: npx tsx src/github/download-package-hashes.ts
 * Output: package-hashes.json in current directory
 */

import { writeFileSync } from 'node:fs';
import { KVCacheKey } from '../shared';
import { getKVConfig, getValue } from './upload-to-kv.js';

async function downloadPackageHashes(): Promise<void> {
  console.log('📥 Downloading package hashes from KV...');

  const { namespaceId } = getKVConfig();
  const hashesJson = await getValue(namespaceId, KVCacheKey.PACKAGE_HASHES);

  if (!hashesJson) {
    throw new Error('Package hashes not found in KV');
  }

  // Save to file
  writeFileSync('package-hashes.json', hashesJson);
  console.log('✅ Downloaded package-hashes.json');

  // Parse and display info
  const hashes = JSON.parse(hashesJson);
  const count = Object.keys(hashes).length;
  console.log(`📦 Found ${count} cached package hashes`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  downloadPackageHashes().catch((error) => {
    console.error('❌ Failed to download package hashes:', error);
    process.exit(1);
  });
}

export { downloadPackageHashes };
