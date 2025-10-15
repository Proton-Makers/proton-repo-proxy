#!/usr/bin/env tsx

/**
 * Enhanced version checker for Proton Mail and Pass
 * Usage: npx tsx src/github/check-all-versions.ts
 */

import {
  type HashCache,
  KVCacheKey,
  type VersionCache,
  validateProtonApiResponse,
} from '../shared';
import { getKVConfig, getValue } from './upload-to-kv.js';

const PROTON_APIS = {
  mail: 'https://proton.me/download/mail/linux/version.json',
  pass: 'https://proton.me/download/pass/linux/version.json',
} as const;

/**
 * Fetch latest version for a product
 */
async function fetchLatestVersion(product: keyof typeof PROTON_APIS): Promise<string> {
  try {
    const response = await fetch(PROTON_APIS[product]);

    if (!response.ok) {
      throw new Error(`API request failed for ${product}: ${response.status}`);
    }

    const data = (await response.json()) as unknown;
    const validatedData = validateProtonApiResponse(data);

    if (!validatedData.Releases?.[0]?.Version) {
      throw new Error(`Invalid API response format for ${product}`);
    }

    const version = validatedData.Releases[0].Version;

    // Validate that download URLs are from proton.me
    const files = validatedData.Releases[0].File || [];
    for (const file of files) {
      if (file.Url && !file.Url.startsWith('https://proton.me/')) {
        console.warn(
          `⚠️  Warning: Download URL for ${product} does not start with https://proton.me/: ${file.Url}`
        );
        throw new Error(
          `Invalid download URL for ${product}: expected https://proton.me/* but got ${file.Url}`
        );
      }
    }

    return version;
  } catch (error) {
    console.error(`❌ Failed to fetch ${product} version:`, error);
    throw error;
  }
}

/**
 * Get cached versions from KV
 */
async function getCachedVersions(namespaceId: string): Promise<VersionCache> {
  try {
    const cached = await getValue(namespaceId, KVCacheKey.LATEST_VERSIONS);
    if (cached) {
      return JSON.parse(cached) as VersionCache;
    }
  } catch (error) {
    console.warn('⚠️  Could not read version cache:', error);
  }

  return {
    mail: null,
    pass: null,
    lastCheck: new Date().toISOString(),
  };
}

/**
 * Check if APT metadata caches exist and are complete
 */
async function checkAptCaches(namespaceId: string): Promise<{
  releaseExists: boolean;
  packagesExists: boolean;
  archReleaseExists: boolean;
}> {
  try {
    const [release, packages, archRelease] = await Promise.all([
      getValue(namespaceId, KVCacheKey.APT_RELEASE),
      getValue(namespaceId, KVCacheKey.APT_PACKAGES),
      getValue(namespaceId, KVCacheKey.APT_ARCH_RELEASE),
    ]);

    return {
      releaseExists: !!release,
      packagesExists: !!packages,
      archReleaseExists: !!archRelease,
    };
  } catch (error) {
    console.warn('⚠️  Could not check APT caches:', error);
    return {
      releaseExists: false,
      packagesExists: false,
      archReleaseExists: false,
    };
  }
}

/**
 * Check if hash cache exists and is complete for current versions
 */
async function checkHashCache(
  namespaceId: string,
  mailVersion: string,
  passVersion: string
): Promise<{ exists: boolean; complete: boolean; packageCount: number }> {
  try {
    const hashCache = await getValue(namespaceId, KVCacheKey.PACKAGE_HASHES);
    if (!hashCache) {
      return { exists: false, complete: false, packageCount: 0 };
    }

    const parsed: HashCache = JSON.parse(hashCache);
    const entries = Object.keys(parsed);

    // Check if we have hashes for both products with current versions
    const hasMailHashes = entries.some((url) => url.includes('mail') && url.includes(mailVersion));
    const hasPassHashes = entries.some((url) => url.includes('pass') && url.includes(passVersion));

    const complete = hasMailHashes && hasPassHashes;

    return {
      exists: true,
      complete,
      packageCount: entries.length,
    };
  } catch (error) {
    console.warn('⚠️  Could not check hash cache:', error);
    return { exists: false, complete: false, packageCount: 0 };
  }
}

/**
 * Check all products for updates and cache completeness
 */
async function checkAllVersions(): Promise<{
  updateNeeded: boolean;
  reasons: string[];
  updates: { product: string; oldVersion: string | null; newVersion: string }[];
  latestVersions: VersionCache;
}> {
  console.log('🔍 Checking Proton Mail and Pass versions...');

  try {
    // Get KV config and cached versions
    const { namespaceId } = getKVConfig();
    const cached = await getCachedVersions(namespaceId);

    // Fetch latest versions
    const [mailVersion, passVersion] = await Promise.all([
      fetchLatestVersion('mail'),
      fetchLatestVersion('pass'),
    ]);

    console.log(`📦 Proton Mail: ${mailVersion} (cached: ${cached.mail || 'none'})`);
    console.log(`📦 Proton Pass: ${passVersion} (cached: ${cached.pass || 'none'})`);

    // Check for version updates
    const updates: { product: string; oldVersion: string | null; newVersion: string }[] = [];
    const reasons: string[] = [];

    if (mailVersion !== cached.mail) {
      updates.push({ product: 'mail', oldVersion: cached.mail, newVersion: mailVersion });
      reasons.push(`New Proton Mail version: ${cached.mail || 'none'} → ${mailVersion}`);
    }

    if (passVersion !== cached.pass) {
      updates.push({ product: 'pass', oldVersion: cached.pass, newVersion: passVersion });
      reasons.push(`New Proton Pass version: ${cached.pass || 'none'} → ${passVersion}`);
    }

    // Check APT caches
    console.log('🔍 Checking APT metadata caches...');
    const aptCaches = await checkAptCaches(namespaceId);
    console.log(
      `  Release: ${aptCaches.releaseExists ? '✅' : '❌'}, Packages: ${aptCaches.packagesExists ? '✅' : '❌'}, Arch Release: ${aptCaches.archReleaseExists ? '✅' : '❌'}`
    );

    if (!aptCaches.releaseExists || !aptCaches.packagesExists || !aptCaches.archReleaseExists) {
      reasons.push('APT metadata caches incomplete or missing');
    }

    // Check hash cache
    console.log('🔍 Checking hash cache...');
    const hashCache = await checkHashCache(namespaceId, mailVersion, passVersion);
    console.log(
      `  Exists: ${hashCache.exists ? '✅' : '❌'}, Complete: ${hashCache.complete ? '✅' : '❌'} (${hashCache.packageCount} packages)`
    );

    if (!hashCache.exists || !hashCache.complete) {
      reasons.push('Hash cache incomplete or missing for current versions');
    }

    const updateNeeded =
      updates.length > 0 ||
      !aptCaches.releaseExists ||
      !aptCaches.packagesExists ||
      !aptCaches.archReleaseExists ||
      !hashCache.exists ||
      !hashCache.complete;

    if (updateNeeded) {
      console.log('🆕 Update needed:');
      for (const reason of reasons) {
        console.log(`  - ${reason}`);
      }
    } else {
      console.log('✅ All products are up to date and all caches are complete');
    }

    // Create new version cache
    const latestVersions: VersionCache = {
      mail: mailVersion,
      pass: passVersion,
      lastCheck: new Date().toISOString(),
    };

    return { updateNeeded, reasons, updates, latestVersions };
  } catch (error) {
    console.error('❌ Version check failed:', error);
    throw error;
  }
}

/**
 * Main function for GitHub Actions
 */
async function main() {
  try {
    const result = await checkAllVersions();

    // GitHub Actions output
    if (process.env.GITHUB_OUTPUT) {
      const fs = await import('node:fs');
      const output = [
        `UPDATE_NEEDED=${result.updateNeeded}`,
        `UPDATES_COUNT=${result.updates.length}`,
        `MAIL_VERSION=${result.latestVersions.mail}`,
        `PASS_VERSION=${result.latestVersions.pass}`,
        `REASONS=${result.reasons.join('; ')}`,
      ].join('\n');

      fs.appendFileSync(process.env.GITHUB_OUTPUT, `${output}\n`);
    }

    // Always exit with success (0) - GitHub Actions will check UPDATE_NEEDED output
    process.exit(0);
  } catch (error) {
    console.error('❌ Check failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { checkAllVersions, fetchLatestVersion, getCachedVersions };
