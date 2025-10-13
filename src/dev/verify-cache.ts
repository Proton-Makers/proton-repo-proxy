#!/usr/bin/env tsx
/**
 * Development script to verify cache consistency
 * Usage: npm run dev:verify-cache
 */

import { getKVConfig, getValue } from '../github/upload-to-kv.js';
import type { HashCache, VersionCache } from '../shared/types/common.js';

async function verifyCache(): Promise<void> {
  console.log('🔍 Verifying cache consistency...');

  try {
    const { namespaceId } = getKVConfig();

    // Check version cache
    console.log('\n📋 Version Cache:');
    try {
      const versionCache = await getValue(namespaceId, 'latest-versions');
      if (versionCache) {
        const parsed: VersionCache = JSON.parse(versionCache);
        console.log(`  ✅ Mail: ${parsed.mail || 'none'}`);
        console.log(`  ✅ Pass: ${parsed.pass || 'none'}`);
        console.log(`  🕒 Last check: ${parsed.lastCheck}`);
      } else {
        console.log('  ❌ No version cache found');
      }
    } catch (error) {
      console.log(`  ❌ Error reading version cache: ${error}`);
    }

    // Check hash cache
    console.log('\n🔢 Hash Cache:');
    try {
      const hashCache = await getValue(namespaceId, 'package-hashes-cache');
      if (hashCache) {
        const parsed: HashCache = JSON.parse(hashCache);
        const entries = Object.keys(parsed);
        console.log(`  ✅ Total cached packages: ${entries.length}`);

        // Show sample entries
        const sampleEntries = entries.slice(0, 3);
        for (const url of sampleEntries) {
          const entry = parsed[url];
          if (entry) {
            console.log(`  📦 ${url.split('/').pop()}`);
            console.log(`    SHA256: ${entry.sha256.slice(0, 16)}...`);
            console.log(`    Size: ${(entry.size / 1024 / 1024).toFixed(1)} MB`);
            console.log(`    Last verified: ${entry.lastVerified}`);
          }
        }

        if (entries.length > 3) {
          console.log(`  ... and ${entries.length - 3} more packages`);
        }
      } else {
        console.log('  ❌ No hash cache found');
      }
    } catch (error) {
      console.log(`  ❌ Error reading hash cache: ${error}`);
    }
    console.log('\n✅ Cache verification completed');
  } catch (error) {
    console.error('❌ Cache verification failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyCache();
}
