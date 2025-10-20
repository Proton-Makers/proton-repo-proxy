#!/usr/bin/env tsx
/**
 * Check Cloudflare KV cache status and cached versions
 * Extracts versions directly from APT Packages cache
 * Usage: npx tsx src/github/check-caches.ts
 * Outputs: mail_version_kv, pass_version_kv, apt_needs_update, hashes_need_update
 */

import { existsSync } from 'node:fs';
import { downloadHashCache, getKVConfig, KVCacheKey } from '../../shared';
import { getKvValue } from '../../shared/kv/transfer/kv-transfer.helper.js';

/**
 * Parse APT Packages file to extract versions
 * Format:
 *   Package: proton-mail
 *   Version: 1.9.1
 *   ...
 */
function parseAptPackagesVersions(packagesContent: string): {
  mail: string | null;
  pass: string | null;
} {
  const lines = packagesContent.split('\n');
  let currentPackage: string | null = null;
  let mailVersion: string | null = null;
  let passVersion: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect package name
    if (trimmed.startsWith('Package: ')) {
      currentPackage = trimmed.substring('Package: '.length);
    }

    // Extract version for current package
    if (trimmed.startsWith('Version: ') && currentPackage) {
      const version = trimmed.substring('Version: '.length);

      if (currentPackage === 'proton-mail') {
        mailVersion = version;
      } else if (currentPackage === 'proton-pass') {
        passVersion = version;
      }

      currentPackage = null; // Reset after finding version
    }
  }

  return { mail: mailVersion, pass: passVersion };
}

async function checkCaches(): Promise<{
  aptMailVersion: string | null;
  aptPassVersion: string | null;
  hashesMissing: boolean;
  reasons: string[];
}> {
  console.log('🔍 Checking all KV caches...');
  console.log('📦 This script reads ALL KV caches (hashes, APT metadata)');
  console.log('📋 Versions are extracted from APT Packages cache');

  //
  // Common KV
  //
  const reasons: string[] = [];
  const { namespaceId } = getKVConfig();

  //
  // APT
  //

  // Check APT Packages cache and extract versions
  let aptMailVersion: string | null = null;
  let aptPassVersion: string | null = null;
  console.log('\n📦 Checking APT Packages cache...');
  try {
    const aptPackages = await getKvValue(namespaceId, KVCacheKey.APT_PACKAGES);
    if (aptPackages) {
      console.log('  ✅ APT Packages cache exists');

      // Extract versions from APT Packages content
      const versions = parseAptPackagesVersions(aptPackages);
      aptMailVersion = versions.mail;
      aptPassVersion = versions.pass;

      console.log(`     Mail version: ${aptMailVersion || 'not found'}`);
      console.log(`     Pass version: ${aptPassVersion || 'not found'}`);

      if (!aptMailVersion || !aptPassVersion) {
        reasons.push('APT Packages exists but versions not found');
      }
    } else {
      console.log('  ❌ APT Packages cache not found');
      reasons.push('Missing APT Packages cache');
      aptMailVersion = null;
      aptPassVersion = null;
    }
  } catch (error) {
    console.log(`  ❌ Error reading APT Packages: ${error}`);
    reasons.push('Error reading APT Packages');
    aptMailVersion = null;
    aptPassVersion = null;
  }

  const otherAptCaches = [
    { key: KVCacheKey.APT_RELEASE, name: 'APT Release' },
    { key: KVCacheKey.APT_ARCH_RELEASE, name: 'APT Arch Release' },
  ];

  for (const cache of otherAptCaches) {
    try {
      // Skip if already missing APT Packages
      if (!aptMailVersion && !aptPassVersion) {
        console.log(`  ⚠️  Skipping ${cache.name} check as APT Packages is missing`);
        continue;
      }

      const value = await getKvValue(namespaceId, cache.key);
      if (value) {
        console.log(`  ✅ ${cache.name} exists`);
      } else {
        console.log(`  ❌ ${cache.name} not found`);
        reasons.push(`Missing ${cache.name}`);
        aptMailVersion = null;
        aptPassVersion = null;
      }
    } catch (error) {
      console.log(`  ❌ Error reading ${cache.name}: ${error}`);
      reasons.push(`Error reading ${cache.name}`);
      aptMailVersion = null;
      aptPassVersion = null;
    }
  }

  //
  // Hashes
  //

  // Check package hashes cache
  let hashesMissing = false;
  console.log('\n🔢 Checking package hashes cache...');
  try {
    const hashCache = await downloadHashCache(namespaceId);
    if (hashCache) {
      const count = Object.keys(hashCache).length;
      console.log(`  ✅ Package hashes cache exists (${count} packages)`);
    } else {
      console.log('  ❌ Package hashes cache not found');
      reasons.push('Missing package hashes cache');
      hashesMissing = true;
    }
  } catch (error) {
    console.log(`  ❌ Error reading package hashes: ${error}`);
    reasons.push('Error reading package hashes');
    hashesMissing = true;
  }

  // Check other APT caches
  console.log('\n📦 Checking other APT caches...');

  // Summary
  console.log('\n📊 Cache Check Summary:');
  console.log(`  Hashes missing: ${hashesMissing}`);
  console.log(`  APT mail version: ${aptMailVersion || 'not found'}`);
  console.log(`  APT pass version: ${aptPassVersion || 'not found'}`);
  console.log(`  APT needs update: ${aptMailVersion === null || aptPassVersion === null}`);
  if (reasons.length > 0) {
    console.log(`  Reasons: ${reasons.join(', ')}`);
  }

  return {
    aptMailVersion,
    aptPassVersion,
    hashesMissing,
    reasons,
  };
}

async function main() {
  const result = await checkCaches();

  // Set GitHub Actions outputs
  if (process.env.GITHUB_OUTPUT && existsSync(process.env.GITHUB_OUTPUT)) {
    const { writeFileSync } = await import('node:fs');
    const outputs = [
      `apt_mail_version=${result.aptMailVersion || ''}`,
      `pass_version=${result.aptPassVersion || ''}`,
      `hashes_missing=${result.hashesMissing}`,
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
