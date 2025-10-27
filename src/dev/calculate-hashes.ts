#!/usr/bin/env tsx

/**
 * Development script to manually calculate and validate package hashes
 * Usage: pnpm run dev:calculate-hashes [product] [--no-upload] [--use-cache]
 *
 * Features:
 * - Downloads and calculates real SHA256/SHA512 hashes
 * - Validates SHA512 against Proton API checksums
 * - Uploads to Cloudflare KV cache by default
 * - Detects file corruption or download errors
 * - Recalculates all hashes by default (use --use-cache to skip cached files)
 *
 * Examples:
 *   pnpm run dev:calculate-hashes mail              # Only Proton Mail + upload to KV
 *   pnpm run dev:calculate-hashes pass              # Only Proton Pass + upload to KV
 *   pnpm run dev:calculate-hashes                   # Both products + upload to KV
 *   pnpm run dev:calculate-hashes --no-upload       # Calculate hashes without uploading
 *   pnpm run dev:calculate-hashes mail --no-upload  # Only Mail without uploading
 *   pnpm run dev:calculate-hashes --use-cache       # Skip already cached files
 *   pnpm run dev:calculate-hashes --use-cache --no-upload  # Use cache, no upload
 */

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import {
  downloadPackageDescriptorsCache,
  fetchProtonProductAPI,
  getKVConfig,
  type PackageDescriptor,
  type PackageDescriptors,
  PROTON_IDENTIFIER_PREFIX,
  PROTON_IGNORE_FILE_URLS,
  PROTON_PRODUCTS,
  type ProtonFile,
  type ProtonIdentifierPrefixEnum,
  type ProtonProduct,
  uploadPackageDescriptorsCache,
} from '../shared';

/**
 * Hash calculation result with optional error
 */
type HashResult =
  | { success: true; url: string; hash: PackageDescriptor }
  | {
    success: false;
    url: string;
    filename: string;
    error: string;
    expectedSha512: string;
    calculatedSha512: string;
  };

/**
 * Calculate hash for a package
 */
async function calculatePackageHash(
  url: string,
  version: string,
  product: ProtonProduct,
  debFile: ProtonFile
): Promise<HashResult> {
  console.log(`📦 Processing ${product} ${version}...`);

  const response = await fetch(url, { method: 'HEAD' });
  if (!response.ok) {
    const filename = url.split('/').pop() || 'unknown';
    return {
      success: false,
      url,
      filename,
      error: `Failed to fetch HEAD: ${response.status}`,
      expectedSha512: debFile.Sha512CheckSum.toLowerCase(),
      calculatedSha512: 'N/A',
    };
  }

  const size = Number.parseInt(response.headers.get('content-length') || '0', 10);
  const filename = url.split('/').pop() || 'unknown';

  console.log(`  📏 Size: ${(size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  🔢 Calculating real hashes for ${filename}...`);

  // Download the file and calculate real hashes
  const downloadResponse = await fetch(url);
  if (!downloadResponse.ok) {
    return {
      success: false,
      url,
      filename,
      error: `Failed to download: ${downloadResponse.status}`,
      expectedSha512: debFile.Sha512CheckSum.toLowerCase(),
      calculatedSha512: 'N/A',
    };
  }

  const arrayBuffer = await downloadResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const md5 = createHash('md5').update(buffer).digest('hex');
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const sha512 = createHash('sha512').update(buffer).digest('hex');

  console.log(`  ✅ MD5: ${md5.slice(0, 16)}...`);
  console.log(`  ✅ SHA256: ${sha256.slice(0, 16)}...`);
  console.log(`  ✅ SHA512: ${sha512.slice(0, 16)}...`);

  // Validate SHA512 with Proton API
  const expectedSha512 = debFile.Sha512CheckSum.toLowerCase();
  if (sha512 !== expectedSha512) {
    console.warn(`  ⚠️  SHA512 MISMATCH for ${filename} - skipping file`);
    console.warn(`     Expected: ${expectedSha512}`);
    console.warn(`     Calculated: ${sha512}`);
    return {
      success: false,
      url,
      filename,
      error: 'SHA512 mismatch',
      expectedSha512,
      calculatedSha512: sha512,
    };
  }

  console.log('  🔐 SHA512 validation: PASSED');

  return {
    success: true,
    url,
    hash: {
      md5,
      sha256,
      sha512,
      size,
    },
  };
}

/**
 * Process all releases for a product
 */
async function processProduct(
  product: ProtonProduct,
  identifierPrefixes: ProtonIdentifierPrefixEnum[],
  existingHashes: PackageDescriptors,
  failedFiles: HashResult[]
): Promise<PackageDescriptors> {
  // Prepare result container
  const resultHashed: PackageDescriptors = {};

  // Fetch Proton API releases
  const { Releases: releases } = await fetchProtonProductAPI(product);

  for (const release of releases) {
    // Filter files by identifier prefix (e.g., files starting with '.deb')
    const files = release.File.filter((file) => !PROTON_IGNORE_FILE_URLS.includes(file.Url)).filter(
      (file) => identifierPrefixes.some((prefix) => file.Identifier.startsWith(prefix))
    );

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
      const result = await calculatePackageHash(file.Url, release.Version, product, file);

      if (result.success) {
        resultHashed[result.url] = result.hash;
      } else {
        failedFiles.push(result);
      }
    }
  }

  return resultHashed;
}

/**
 * Upload packages to KV cache
 */
async function uploadToCache(packages: PackageDescriptors): Promise<void> {
  console.log('\n☁️  Uploading hashes to Cloudflare KV cache...');

  const { namespaceId } = getKVConfig();

  // Upload updated cache
  await uploadPackageDescriptorsCache(namespaceId, packages);

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
  const useCache = args.includes('--use-cache'); // Don't use cache by default

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
    console.log('💾 Cache usage: enabled (skipping already cached files)');
  } else {
    console.log('🔄 Cache usage: disabled (recalculating all hashes, use --use-cache to enable)');
  }
  console.log('');

  // Target: identifiers:
  const identifierPrefixes: ProtonIdentifierPrefixEnum[] = [PROTON_IDENTIFIER_PREFIX.DEB];

  try {
    // Get KV config
    const { namespaceId } = getKVConfig();

    // Get existing hashes (or empty object if --no-cache)
    const existingHashes: PackageDescriptors = useCache
      ? ((await downloadPackageDescriptorsCache(namespaceId)) ?? {})
      : {};

    if (!useCache) {
      console.log('🔄 Skipping cache download (recalculating all hashes)\n');
    }

    // Track failed files across all products
    const failedFiles: HashResult[] = [];

    // Process each product
    const allHashes: PackageDescriptors[] = await Promise.all(
      targetProducts.map((product) =>
        processProduct(product, identifierPrefixes, existingHashes, failedFiles)
      )
    );

    // Combine all hashes without spread operator in reduce
    const combinedHashes: PackageDescriptors = {};
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

    // Display failed files if any
    if (failedFiles.length > 0) {
      console.log('\n⚠️  Failed files (not uploaded):');
      for (const failed of failedFiles) {
        if (!failed.success) {
          console.log(`\n  ❌ ${failed.filename}`);
          console.log(`     URL: ${failed.url}`);
          console.log(`     Error: ${failed.error}`);
          if (failed.calculatedSha512 !== 'N/A') {
            console.log(`     Expected SHA512:   ${failed.expectedSha512}`);
            console.log(`     Calculated SHA512: ${failed.calculatedSha512}`);
          }
        }
      }
      console.log(`\n⚠️  Total failed: ${failedFiles.length} files`);
    }

    if (!shouldUpload) {
      console.log('');
      console.log('💡 Tip: Remove --no-upload flag to upload hashes to Cloudflare KV cache.');
    }

    if (!useCache) {
      console.log('');
      console.log('💡 Tip: Use --use-cache flag to skip already cached hashes and save bandwidth.');
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
