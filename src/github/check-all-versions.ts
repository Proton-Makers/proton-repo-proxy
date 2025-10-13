#!/usr/bin/env tsx

/**
 * Enhanced version checker for Proton Mail and Pass
 * Usage: npx tsx src/github/check-all-versions.ts
 */

import type { VersionCache } from '../shared/types/common.js';
import { validateProtonApiResponse } from '../shared/utils/validation.js';
import { getKVConfig, getValue, setValue } from './upload-to-kv.js';

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

    return validatedData.Releases[0].Version;
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
    const cached = await getValue(namespaceId, 'latest-versions');
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
 * Save versions to KV cache
 */
async function saveCachedVersions(namespaceId: string, versions: VersionCache): Promise<void> {
  await setValue(namespaceId, 'latest-versions', JSON.stringify(versions));
}

/**
 * Check all products for updates
 */
async function checkAllVersions(): Promise<{
  updateNeeded: boolean;
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

    // Check for updates
    const updates: { product: string; oldVersion: string | null; newVersion: string }[] = [];

    if (mailVersion !== cached.mail) {
      updates.push({ product: 'mail', oldVersion: cached.mail, newVersion: mailVersion });
    }

    if (passVersion !== cached.pass) {
      updates.push({ product: 'pass', oldVersion: cached.pass, newVersion: passVersion });
    }

    const updateNeeded = updates.length > 0;

    if (updateNeeded) {
      console.log(`🆕 ${updates.length} update(s) detected:`);
      for (const update of updates) {
        console.log(`  - ${update.product}: ${update.oldVersion || 'none'} → ${update.newVersion}`);
      }
    } else {
      console.log('✅ All products are up to date');
    }

    // Create new version cache
    const latestVersions: VersionCache = {
      mail: mailVersion,
      pass: passVersion,
      lastCheck: new Date().toISOString(),
    };

    return { updateNeeded, updates, latestVersions };
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
      ].join('\n');

      fs.appendFileSync(process.env.GITHUB_OUTPUT, `${output}\n`);
    }

    // Save to cache only if successful
    if (result.updateNeeded) {
      console.log('💾 Updating version cache...');
      const { namespaceId } = getKVConfig();
      await saveCachedVersions(namespaceId, result.latestVersions);
    }

    // Exit code for shell scripts
    process.exit(result.updateNeeded ? 0 : 1);
  } catch (error) {
    console.error('❌ Check failed:', error);
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { checkAllVersions, fetchLatestVersion, getCachedVersions };
