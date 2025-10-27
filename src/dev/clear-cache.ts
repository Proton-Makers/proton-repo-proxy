#!/usr/bin/env tsx

/**
 * Development script to clear all caches from Cloudflare KV
 */

import { downloadPackageDescriptorsCache, KVCacheKey, uploadPackageDescriptorsCache } from '../shared';
import { getKVConfig } from '../shared/kv/config/kv-config.helper.js';
import { getKvValue, setKvValue } from '../shared/kv/transfer/kv-transfer.helper.js';

async function clearAllCaches(): Promise<void> {
  console.log('🧹 Clearing all caches from Cloudflare KV...');

  try {
    const { namespaceId } = getKVConfig();

    // Clear hash cache
    console.log('🗑️  Clearing hash cache...');
    try {
      const existing = await downloadPackageDescriptorsCache(namespaceId);
      if (existing) {
        await uploadPackageDescriptorsCache(namespaceId, {});
        console.log('  ✅ Hash cache cleared');
      }
    } catch (error) {
      console.log(`  ❌ Failed to clear hash cache: ${error}`);
    }

    // Clear APT caches
    console.log('🗑️  Clearing APT caches...');
    for (const key of [
      KVCacheKey.APT_PACKAGES,
      KVCacheKey.APT_RELEASE,
      KVCacheKey.APT_ARCH_RELEASE,
    ]) {
      try {
        const existing = await getKvValue(namespaceId, key);
        if (existing) {
          await setKvValue(namespaceId, key, '');
          console.log(`  ✅ Cleared ${key}`);
        }
      } catch (error) {
        console.log(`  ❌ Error clearing ${key}: ${error}`);
      }
    }

    console.log('\n✅ All caches cleared successfully');
  } catch (error) {
    console.error('❌ Cache clearing failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  clearAllCaches();
}
