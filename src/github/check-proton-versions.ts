#!/usr/bin/env tsx

/**
 * Check latest Proton versions from official APIs
 * This script ONLY queries Proton APIs, does NOT read KV cache
 * Usage: npx tsx src/github/check-proton-versions.ts
 */

import { PROTON_APIS, PROTON_SERVER, ProtonProducts, validateProtonApiResponse } from '../shared';

/**
 * Fetch latest version for a product from Proton API
 */
async function fetchLatestVersion(product: ProtonProducts): Promise<string> {
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
      if (file.Url && !file.Url.startsWith(PROTON_SERVER)) {
        console.warn(
          `⚠️  Warning: Download URL for ${product} does not start with ${PROTON_SERVER}: ${file.Url}`
        );
        throw new Error(
          `Invalid download URL for ${product}: expected ${PROTON_SERVER}* but got ${file.Url}`
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
 * Check Proton APIs for latest versions
 */
async function checkAllVersions(): Promise<{
  mail: string;
  pass: string;
}> {
  console.log('🔍 Checking Proton Mail and Pass versions from APIs...');
  console.log('📡 This script queries Proton APIs only (no KV cache read)');

  try {
    // Fetch latest versions from Proton APIs
    const [mailVersion, passVersion] = await Promise.all([
      fetchLatestVersion(ProtonProducts.MAIL),
      fetchLatestVersion(ProtonProducts.PASS),
    ]);

    console.log(`📦 Proton Mail: ${mailVersion}`);
    console.log(`📦 Proton Pass: ${passVersion}`);

    return {
      mail: mailVersion,
      pass: passVersion,
    };
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
      const output = [`MAIL_VERSION=${result.mail}`, `PASS_VERSION=${result.pass}`].join('\n');

      fs.appendFileSync(process.env.GITHUB_OUTPUT, `${output}\n`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Check failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
