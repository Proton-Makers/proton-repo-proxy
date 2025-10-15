#!/usr/bin/env tsx
/**
 * Check Cloudflare KV cache status
 * Usage: npx tsx src/github/check-caches.ts
 * Outputs: apt_needs_update, hashes_need_update (for GitHub Actions)
 */

import { existsSync } from 'node:fs';
import { KVCacheKey } from '../shared';
import { getKVConfig, getValue } from './upload-to-kv.js';

interface CacheCheckResult {
  aptNeedsUpdate: boolean;
  hashesNeedUpdate: boolean;
  reasons: string[];
}

async function checkCaches(): Promise<CacheCheckResult> {
  console.log('🔍 Checking KV cache status...');

  const { namespaceId } = getKVConfig();
  const reasons: string[] = [];
  let aptNeedsUpdate = false;
  let hashesNeedUpdate = false;

  // Check package hashes cache
  console.log('\n🔢 Checking package hashes cache...');
  try {
    const hashCache = await getValue(namespaceId, KVCacheKey.PACKAGE_HASHES);
    if (hashCache) {
      console.log('  ✅ Package hashes cache exists');
    } else {
      console.log('  ❌ Package hashes cache not found');
      reasons.push('Missing package hashes cache');
      hashesNeedUpdate = true;
    }
  } catch (error) {
    console.log(`  ❌ Error reading package hashes: ${error}`);
    reasons.push('Error reading package hashes');
    hashesNeedUpdate = true;
  }

  // Check APT caches
  console.log('\n📦 Checking APT caches...');

  const aptCaches = [
    { key: KVCacheKey.APT_PACKAGES, name: 'APT Packages' },
    { key: KVCacheKey.APT_RELEASE, name: 'APT Release' },
    { key: KVCacheKey.APT_ARCH_RELEASE, name: 'APT Arch Release' },
    { key: KVCacheKey.APT_URL_MAPPING, name: 'APT URL Mapping' },
  ];

  for (const cache of aptCaches) {
    try {
      const value = await getValue(namespaceId, cache.key);
      if (value) {
        console.log(`  ✅ ${cache.name} exists`);
      } else {
        console.log(`  ❌ ${cache.name} not found`);
        reasons.push(`Missing ${cache.name}`);
        aptNeedsUpdate = true;
      }
    } catch (error) {
      console.log(`  ❌ Error reading ${cache.name}: ${error}`);
      reasons.push(`Error reading ${cache.name}`);
      aptNeedsUpdate = true;
    }
  }

  // Summary
  console.log('\n📊 Cache Check Summary:');
  console.log(`  Hashes need update: ${hashesNeedUpdate}`);
  console.log(`  APT needs update: ${aptNeedsUpdate}`);
  if (reasons.length > 0) {
    console.log(`  Reasons: ${reasons.join(', ')}`);
  }

  return {
    aptNeedsUpdate,
    hashesNeedUpdate,
    reasons,
  };
}

async function main() {
  const result = await checkCaches();

  // Set GitHub Actions outputs
  if (process.env.GITHUB_OUTPUT && existsSync(process.env.GITHUB_OUTPUT)) {
    const { writeFileSync } = await import('node:fs');
    const outputs = [
      `apt_needs_update=${result.aptNeedsUpdate}`,
      `hashes_need_update=${result.hashesNeedUpdate}`,
      `reasons=${result.reasons.join(', ')}`,
    ].join('\n');

    writeFileSync(process.env.GITHUB_OUTPUT, `${outputs}\n`, { flag: 'a' });
    console.log('\n✅ GitHub Actions outputs set');
  }

  console.log('\n✅ Cache check completed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Cache check failed:', error);
    process.exit(1);
  });
}

export { checkCaches };
