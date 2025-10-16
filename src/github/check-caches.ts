#!/usr/bin/env tsx
/**
 * Check Cloudflare KV cache status and cached versions
 * Usage: npx tsx src/github/check-caches.ts
 * Outputs: mail_version_kv, pass_version_kv, apt_needs_update, hashes_need_update
 */

import { existsSync } from 'node:fs';
import { downloadHashCache, KVCacheKey } from '../shared';
import { getKVConfig } from '../shared/utils/kv/kv-config.helper.js';
import { getKvValue } from '../shared/utils/kv/kv-transfert.helper.js';

interface CacheCheckResult {
  kvMailVersion: string | null;
  kvPassVersion: string | null;
  aptNeedsUpdate: boolean;
  hashesNeedUpdate: boolean;
  versionsNeedUpdate: boolean;
  reasons: string[];
}

/**
 * Parse APT Packages format to extract versions
 * Format: "Package: proton-mail\nVersion: 1.2.3\n\nPackage: proton-pass\nVersion: 2.3.4"
 */
function parseAptPackagesVersions(aptPackages: string): {
  mail: string | null;
  pass: string | null;
} {
  const mailMatch = aptPackages.match(/Package:\s*proton-mail[\s\S]*?Version:\s*([^\s\n]+)/);
  const passMatch = aptPackages.match(/Package:\s*proton-pass[\s\S]*?Version:\s*([^\s\n]+)/);

  return {
    mail: mailMatch?.[1] ?? null,
    pass: passMatch?.[1] ?? null,
  };
}

async function checkCaches(
  protonMailVersion?: string,
  protonPassVersion?: string
): Promise<CacheCheckResult> {
  console.log('🔍 Checking all KV caches...');
  console.log('📦 This script reads ALL KV caches (versions, hashes, APT metadata)');

  const { namespaceId } = getKVConfig();
  const reasons: string[] = [];
  let aptNeedsUpdate = false;
  let hashesNeedUpdate = false;
  let versionsNeedUpdate = false;

  // Check APT packages cache for versions
  console.log('\n📋 Checking APT packages cache for versions...');
  let kvMailVersion: string | null = null;
  let kvPassVersion: string | null = null;

  try {
    const aptPackages = await getKvValue(namespaceId, KVCacheKey.APT_PACKAGES);
    if (aptPackages) {
      const versions = parseAptPackagesVersions(aptPackages);
      kvMailVersion = versions.mail;
      kvPassVersion = versions.pass;
      console.log('  ✅ APT packages cache exists');
      console.log(`     Mail: ${kvMailVersion || 'none'}`);
      console.log(`     Pass: ${kvPassVersion || 'none'}`);

      // Compare with provided Proton versions if available
      if (protonMailVersion && kvMailVersion !== protonMailVersion) {
        reasons.push(`Mail version outdated: ${kvMailVersion} → ${protonMailVersion}`);
        versionsNeedUpdate = true;
      }
      if (protonPassVersion && kvPassVersion !== protonPassVersion) {
        reasons.push(`Pass version outdated: ${kvPassVersion} → ${protonPassVersion}`);
        versionsNeedUpdate = true;
      }
    } else {
      console.log('  ❌ Version cache not found');
      reasons.push('Missing version cache');
      versionsNeedUpdate = true;
    }
  } catch (error) {
    console.log(`  ❌ Error reading version cache: ${error}`);
    reasons.push('Error reading version cache');
    versionsNeedUpdate = true;
  }

  // Check package hashes cache
  console.log('\n🔢 Checking package hashes cache...');
  try {
    const hashCache = await downloadHashCache(namespaceId);
    if (hashCache) {
      const count = Object.keys(hashCache).length;
      console.log(`  ✅ Package hashes cache exists (${count} packages)`);
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
  ];

  for (const cache of aptCaches) {
    try {
      const value = await getKvValue(namespaceId, cache.key);
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
  console.log(`  Versions need update: ${versionsNeedUpdate}`);
  console.log(`  Hashes need update: ${hashesNeedUpdate}`);
  console.log(`  APT needs update: ${aptNeedsUpdate}`);
  if (reasons.length > 0) {
    console.log(`  Reasons: ${reasons.join(', ')}`);
  }

  return {
    kvMailVersion,
    kvPassVersion,
    aptNeedsUpdate,
    hashesNeedUpdate,
    versionsNeedUpdate,
    reasons,
  };
}

async function main() {
  // Get Proton versions from environment (set by check-versions job)
  const protonMailVersion = process.env.MAIL_VERSION;
  const protonPassVersion = process.env.PASS_VERSION;

  if (protonMailVersion && protonPassVersion) {
    console.log('\n📡 Comparing with Proton API versions:');
    console.log(`   Mail: ${protonMailVersion}`);
    console.log(`   Pass: ${protonPassVersion}`);
  }

  const result = await checkCaches(protonMailVersion, protonPassVersion);

  // Set GitHub Actions outputs
  if (process.env.GITHUB_OUTPUT && existsSync(process.env.GITHUB_OUTPUT)) {
    const { writeFileSync } = await import('node:fs');
    const outputs = [
      `mail_version_kv=${result.kvMailVersion || ''}`,
      `pass_version_kv=${result.kvPassVersion || ''}`,
      `apt_needs_update=${result.aptNeedsUpdate}`,
      `hashes_need_update=${result.hashesNeedUpdate}`,
      `versions_need_update=${result.versionsNeedUpdate}`,
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
