#!/usr/bin/env tsx

/**
 * Development script to manually calculate and validate package hashes
 * Usage: pnpm run dev:calculate-hashes [product] [--no-upload] [--no-cache]
 *
 * Features:
 * - Downloads and calculates real SHA256/SHA512 hashes
 * - Validates SHA512 against Proton API checksums
 * - Uploads to Cloudflare KV cache by default
 * - Detects file corruption or download errors
 *
 * Examples:
 *   pnpm run dev:calculate-hashes mail              # Only Proton Mail + upload to KV
 *   pnpm run dev:calculate-hashes pass              # Only Proton Pass + upload to KV
 *   pnpm run dev:calculate-hashes                   # Both products + upload to KV
 *   pnpm run dev:calculate-hashes --no-upload       # Calculate hashes without uploading
 *   pnpm run dev:calculate-hashes mail --no-upload  # Only Mail without uploading
 *   pnpm run dev:calculate-hashes --no-cache        # Ignore existing cache, recalculate all
 *   pnpm run dev:calculate-hashes --no-cache --no-upload  # Recalculate all, no upload
 */

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import {
  downloadHashCache,
  fetchProtonProductAPI,
  getKVConfig,
  type HashCache,
  type HashEntry,
  PROTON_IDENTIFIER_DEB,
  PROTON_PRODUCTS,
  type ProtonFile,
  type ProtonIdentifierEnum,
  type ProtonProduct,
  uploadHashCache,
} from '../shared';

/**
 * Calculate hash for a package
 */
async function calculatePackageHash(
  url: string,
  version: string,
  product: ProtonProduct,
  debFile: ProtonFile
): Promise<HashEntry> {
  console.log(`📦 Processing ${product} ${version}...`);

  const response = await fetch(url, { method: 'HEAD' });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const size = Number.parseInt(response.headers.get('content-length') || '0', 10);
  const filename = url.split('/').pop() || 'unknown';

  console.log(`  📏 Size: ${(size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  🔢 Calculating real hashes for ${filename}...`);

  // Download the file and calculate real hashes
  const downloadResponse = await fetch(url);
  if (!downloadResponse.ok) {
    throw new Error(`Failed to download ${url}: ${downloadResponse.status}`);
  }

  const arrayBuffer = await downloadResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const sha512 = createHash('sha512').update(buffer).digest('hex');

  console.log(`  ✅ SHA256: ${sha256.slice(0, 16)}...`);
  console.log(`  ✅ SHA512: ${sha512.slice(0, 16)}...`);

  // Validate SHA512 with Proton API
  const expectedSha512 = debFile.Sha512CheckSum.toLowerCase();
  if (sha512 !== expectedSha512) {
    console.error(`  ❌ SHA512 MISMATCH for ${filename}!`);
    console.error(`     Expected: ${expectedSha512}`);
    console.error(`     Calculated: ${sha512}`);
    throw new Error(
      `SHA512 validation failed for ${filename}: expected ${expectedSha512}, got ${sha512}`
    );
  }

  console.log('  🔐 SHA512 validation: PASSED');

  return {
    sha256,
    sha512,
    size,
  };
}

/**
 * Process all releases for a product
 */
async function processProduct(
  product: ProtonProduct,
  identifiers: ProtonIdentifierEnum[],
  existingHashes: HashCache
): Promise<HashCache> {
  // Prepare result container
  const resultHashed: HashCache = {};

  // Fetch Proton API releases
  const { Releases: releases } = await fetchProtonProductAPI(product);

  for (const release of releases) {
    // Filter files
    const files = release.File.filter((file) => identifiers.includes(file.Identifier));

    for (const file of files) {
      console.log(
        `  📦 Processing file ${file.Url.split('/').pop()} for ${product} ${release.Version}...`
      );

      // Skip if already in cache
      const cachedHash = existingHashes[file.Url];
      if (cachedHash) {
        console.log('    💾 Using cached hash (skip download)');
        resultHashed[file.Url] = cachedHash;
        continue;
      }

      // Download and calculate hash
      resultHashed[file.Url] = await calculatePackageHash(file.Url, release.Version, product, file);
    }
  }

  return resultHashed;
}

/**
 * Upload packages to KV cache
 */
async function uploadToCache(packages: HashCache): Promise<void> {
  console.log('\n☁️  Uploading hashes to Cloudflare KV cache...');

  const { namespaceId } = getKVConfig();

  // Upload updated cache
  await uploadHashCache(namespaceId, packages);

  console.log(`  💾 Total cache entries: ${Object.keys(packages).length}`);
}

// -- Main Entry Point ---------------------------------------------------------

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('🔢 Calculating package hashes with real SHA256/SHA512...');
  const args = process.argv.slice(2);

  // Parse arguments
  const argProducts: ProtonProduct[] = args
    .filter((arg) => PROTON_PRODUCTS.includes(arg as ProtonProduct))
    .map((arg) => arg as ProtonProduct);
  const shouldUpload = !args.includes('--no-upload'); // Upload by default
  const useCache = !args.includes('--no-cache'); // Use cache by default

  // Target: products
  const targetProducts: readonly ProtonProduct[] =
    argProducts.length > 0 ? argProducts : PROTON_PRODUCTS;
  console.log(`📦 Target products: ${targetProducts.join(', ')}`);

  // Target: upload
  if (shouldUpload) {
    console.log('☁️  Upload to KV cache: enabled (use --no-upload to disable)');
  } else {
    console.log('💾 Local save only: upload disabled');
  }

  // Target: cache
  if (useCache) {
    console.log('💾 Cache usage: enabled (use --no-cache to recalculate all)');
  } else {
    console.log('🔄 Cache usage: disabled (recalculating all hashes)');
  }
  console.log('');

  // Target: identifiers:
  const identifiers: ProtonIdentifierEnum[] = [PROTON_IDENTIFIER_DEB];

  try {
    // Get KV config
    const { namespaceId } = getKVConfig();

    // Get existing hashes (or empty object if --no-cache)
    const existingHashes: HashCache = useCache
      ? ((await downloadHashCache(namespaceId)) ?? {})
      : {};

    if (!useCache) {
      console.log('🔄 Skipping cache download (--no-cache flag set)\n');
    }

    // Process each product
    const allHashes: HashCache[] = await Promise.all(
      targetProducts.map((product) => processProduct(product, identifiers, existingHashes))
    );

    // Combine all hashes without spread operator in reduce
    const combinedHashes: HashCache = {};
    for (const hashCache of allHashes) {
      for (const [url, hash] of Object.entries(hashCache)) {
        combinedHashes[url] = hash;
      }
    }

    // Save results locally
    writeFileSync('dev-package-hashes.json', JSON.stringify(combinedHashes, null, 2));
    console.log('\n💾 Results saved to dev-package-hashes.json');

    // Upload to cache by default (unless --no-upload)
    if (shouldUpload) {
      await uploadToCache(combinedHashes);
    }

    console.log('\n✅ Hash calculation completed');
    console.log(`📦 Total packages: ${Object.keys(combinedHashes).length}`);
    console.log('🔢 Real SHA256/SHA512 hashes calculated for all packages');

    if (!shouldUpload) {
      console.log('');
      console.log('💡 Tip: Remove --no-upload flag to upload hashes to Cloudflare KV cache.');
    }

    if (!useCache) {
      console.log('');
      console.log('💡 Tip: Remove --no-cache flag to skip already cached hashes.');
    }
  } catch (error) {
    console.error('❌ Hash calculation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
