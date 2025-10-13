#!/usr/bin/env tsx
/**
 * Development script to clear all caches from Cloudflare KV
 * Usage: npm run dev:clear-cache [cache-type]
 *
 * Examples:
 *   npm run dev:clear-cache versions    # Clear only version cache
 *   npm run dev:clear-cache hashes      # Clear only hash cache
 *   npm run dev:clear-cache             # Clear all caches
 */

import { getKVConfig, getValue, setValue } from '../github/upload-to-kv.js';

const CACHE_KEYS = {
  versions: 'latest-versions',
  hashes: 'package-hashes-cache',
} as const;

async function clearCache(cacheType?: keyof typeof CACHE_KEYS): Promise<void> {
  console.log('🧹 Clearing caches...');

  try {
    const { namespaceId } = getKVConfig();

    if (cacheType) {
      // Clear specific cache
      const key = CACHE_KEYS[cacheType];
      console.log(`🗑️  Clearing ${cacheType} cache (${key})...`);

      try {
        const existing = await getValue(namespaceId, key);
        if (existing) {
          // We can't actually delete from KV easily, so we'll set to empty
          if (cacheType === 'versions') {
            await setValue(
              namespaceId,
              key,
              JSON.stringify({
                mail: null,
                pass: null,
                lastCheck: new Date().toISOString(),
              })
            );
          } else {
            await setValue(namespaceId, key, JSON.stringify({}));
          }
          console.log(`  ✅ ${cacheType} cache cleared`);
        } else {
          console.log(`  ℹ️  ${cacheType} cache was already empty`);
        }
      } catch (error) {
        console.log(`  ❌ Failed to clear ${cacheType} cache: ${error}`);
      }
    } else {
      // Clear all caches
      console.log('🗑️  Clearing all caches...');

      for (const [type, key] of Object.entries(CACHE_KEYS)) {
        try {
          const existing = await getValue(namespaceId, key);
          if (existing) {
            if (type === 'versions') {
              await setValue(
                namespaceId,
                key,
                JSON.stringify({
                  mail: null,
                  pass: null,
                  lastCheck: new Date().toISOString(),
                })
              );
            } else {
              await setValue(namespaceId, key, JSON.stringify({}));
            }
            console.log(`  ✅ ${type} cache cleared`);
          } else {
            console.log(`  ℹ️  ${type} cache was already empty`);
          }
        } catch (error) {
          console.log(`  ❌ Failed to clear ${type} cache: ${error}`);
        }
      }
    }

    console.log('');
    console.log('✅ Cache clearing completed');
    console.log('💡 Run "npm run dev:verify-cache" to check current state');
  } catch (error) {
    console.error('❌ Cache clearing failed:', error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const cacheType = process.argv[2] as keyof typeof CACHE_KEYS | undefined;

  if (cacheType && !CACHE_KEYS[cacheType]) {
    console.error('❌ Invalid cache type. Use: versions, hashes, or leave empty for all');
    process.exit(1);
  }

  await clearCache(cacheType);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
