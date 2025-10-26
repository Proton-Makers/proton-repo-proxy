#!/usr/bin/env tsx

/**
 * Extract latest versions from validated Proton API responses
 * Usage: PROTON_CACHE_DIR=/path npx tsx src/github/check-proton-versions/extract-latest-versions.ts
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { PROTON_PRODUCTS, type ProtonApiResponse, type ProtonProduct } from '../../shared';

function extractLatestVersion(product: ProtonProduct, cacheDir: string): string {
  // Product
  const filename = `${cacheDir}/${product}.json`;

  // Read file
  // Files are assumed to be already validated by validate-proton-api.ts
  console.log(`📊 Extracting latest version from ${filename}`);
  const rawData = readFileSync(filename, 'utf-8');
  const productData = <ProtonApiResponse>JSON.parse(rawData);

  // Find latest version
  const latestVersion = productData.Releases?.[0]?.Version;
  if (!latestVersion) {
    throw new Error(`No releases found in ${product} API response`);
  }

  console.log(`  ✅ Latest ${product} version: ${latestVersion}`);
  return latestVersion;
}

async function main() {
  const cacheDir = process.env.PROTON_CACHE_DIR;
  if (!cacheDir) {
    console.error('❌ PROTON_CACHE_DIR environment variable is required');
    process.exit(1);
  }

  console.log('📊 Extracting latest versions...\n');

  try {
    console.log('\n📦 Latest versions:');
    const output: string[] = [];

    PROTON_PRODUCTS.forEach((product) => {
      const version = extractLatestVersion(product, cacheDir);
      console.log(`  ${product}: ${version}`);
      output.push(`${product.toUpperCase()}_VERSION=${version}`);
    });

    // GitHub Actions output
    if (process.env.GITHUB_OUTPUT && existsSync(process.env.GITHUB_OUTPUT)) {
      writeFileSync(process.env.GITHUB_OUTPUT, `${output.join('\n')}\n`, { flag: 'a' });
      console.log('\n✅ GitHub Actions outputs set');
    }
  } catch (error) {
    console.error('❌ Extraction failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
