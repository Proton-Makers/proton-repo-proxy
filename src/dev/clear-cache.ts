#!/usr/bin/env tsx
/**
 * Development script to clear all caches from Cloudflare KV
 */

import { getKVConfig, getValue, setValue } from '../github';
import { KVCacheKey } from '../shared';

async function clearAllCaches(): Promise<void> {
  console.log('🧹 Clearing all caches from Cloudflare KV...');

  try {
    const { namespaceId } = getKVConfig();

    // Clear hash cache
    console.log('🗑️  Clearing hash cache...');
    try {
      const existing = await getValue(namespaceId, KVCacheKey.PACKAGE_HASHES);
      if (existing) {
        await setValue(namespaceId, KVCacheKey.PACKAGE_HASHES, JSON.stringify({}));
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
        const existing = await getValue(namespaceId, key);
        if (existing) {
          await setValue(namespaceId, key, '');
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
