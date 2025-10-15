#!/usr/bin/env tsx
/**
 * Update version cache in Cloudflare KV
 * Usage: npx tsx src/github/update-version-cache.ts --mail=1.9.1 --pass=1.32.10
 */

import { KVCacheKey, type VersionCache } from '../shared';
import { getKVConfig, setValue } from './upload-to-kv.js';

async function updateVersionCache(mailVersion: string, passVersion: string): Promise<void> {
  console.log('🔄 Updating version cache...');
  console.log(`📦 Proton Mail: ${mailVersion}`);
  console.log(`📦 Proton Pass: ${passVersion}`);

  const { namespaceId } = getKVConfig();

  const versionCache: VersionCache = {
    mail: mailVersion,
    pass: passVersion,
    lastCheck: new Date().toISOString(),
  };

  await setValue(namespaceId, KVCacheKey.LATEST_VERSIONS, JSON.stringify(versionCache));

  console.log('✅ Version cache updated successfully');
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let mailVersion = '';
  let passVersion = '';

  for (const arg of args) {
    if (arg.startsWith('--mail=')) {
      mailVersion = arg.split('=')[1] || '';
    } else if (arg.startsWith('--pass=')) {
      passVersion = arg.split('=')[1] || '';
    }
  }

  if (!mailVersion || !passVersion) {
    console.error('❌ Missing required arguments');
    console.error('Usage: npx tsx src/github/update-version-cache.ts --mail=1.9.1 --pass=1.32.10');
    process.exit(1);
  }

  await updateVersionCache(mailVersion, passVersion);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Failed to update version cache:', error);
    process.exit(1);
  });
}

export { updateVersionCache };
