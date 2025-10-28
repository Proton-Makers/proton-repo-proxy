#!/usr/bin/env tsx

/**
 * Development script to manually calculate and validate package descriptors
 * Usage: pnpm run dev:calculate-hashes [product] [--no-upload] [--use-cache]
 *
 * Features:
 * - Downloads packages and calculates complete descriptors (hashes + metadata)
 * - Validates SHA512 against Proton API checksums
 * - Uploads to Cloudflare KV cache by default
 * - Detects file corruption or download errors
 * - Recalculates all descriptors by default (use --use-cache to skip cached files)
 *
 * Examples:
 *   pnpm run dev:calculate-hashes mail              # Only Proton Mail + upload to KV
 *   pnpm run dev:calculate-hashes pass              # Only Proton Pass + upload to KV
 *   pnpm run dev:calculate-hashes                   # Both products + upload to KV
 *   pnpm run dev:calculate-hashes --no-upload       # Calculate descriptors without uploading
 *   pnpm run dev:calculate-hashes mail --no-upload  # Only Mail without uploading
 *   pnpm run dev:calculate-hashes --use-cache       # Skip already cached files
 *   pnpm run dev:calculate-hashes --use-cache --no-upload  # Use cache, no upload
 */

import { writeFileSync } from 'node:fs';
import {
  DescriptorFromFile,
  type DescriptorResult,
  downloadDescriptorsCache,
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
  uploadDescriptorsCache,
} from '../shared';

/**
 * Process a single package file
 */
async function calculatePackageDescriptor(
  file: ProtonFile,
  product: ProtonProduct,
  version: string
): Promise<DescriptorResult> {
  console.log(`📦 Processing ${product} ${version}...`);

  // Use the new DescriptorFromFile function
  return await DescriptorFromFile(file);
}


/**
 * Process all releases for a product
 */
async function processProduct(
  product: ProtonProduct,
  identifierPrefixes: ProtonIdentifierPrefixEnum[],
  existingDescriptors: PackageDescriptors,
  failedFiles: DescriptorResult[]
): Promise<PackageDescriptors> {
  // Prepare result container
  const resultDescriptors: PackageDescriptors = {};

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
      const cachedDescriptor = existingDescriptors[file.Url];
      if (cachedDescriptor) {
        console.log('    💾 Using cached descriptor (skip download)');
        resultDescriptors[file.Url] = cachedDescriptor;
        continue;
      }

      // Download and calculate descriptor
      const result = await calculatePackageDescriptor(file, product, release.Version);

      if (result.success) {
        resultDescriptors[result.descriptor.url] = result.descriptor;
      } else {
        failedFiles.push(result);
      }
    }
  }

  return resultDescriptors;
}

/**
 * Upload packages to KV cache
 */
async function uploadToCache(packages: PackageDescriptors): Promise<void> {
  console.log('\n☁️  Uploading hashes to Cloudflare KV cache...');

  const { namespaceId } = getKVConfig();

  // Upload updated cache
  await uploadDescriptorsCache(namespaceId, packages);

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
      ? ((await downloadDescriptorsCache(namespaceId)) ?? {})
      : {};

    if (!useCache) {
      console.log('🔄 Skipping cache download (recalculating all descriptors)\n');
    }

    // Track failed files across all products
    const failedFiles: DescriptorResult[] = [];

    // Process each product
    const allDescriptors: PackageDescriptors[] = await Promise.all(
      targetProducts.map((product) =>
        processProduct(product, identifierPrefixes, existingHashes, failedFiles)
      )
    );

    // Combine all descriptors without spread operator in reduce
    const combinedDescriptors: PackageDescriptors = {};
    for (const descriptorCache of allDescriptors) {
      for (const [url, descriptor] of Object.entries(descriptorCache)) {
        combinedDescriptors[url] = descriptor;
      }
    }

    // Save results locally
    writeFileSync('dev-package-descriptors.json', JSON.stringify(combinedDescriptors, null, 2));
    console.log('\n💾 Results saved to dev-package-descriptors.json');

    // Upload to cache by default (unless --no-upload)
    if (shouldUpload) {
      await uploadToCache(combinedDescriptors);
    }

    console.log('\n✅ Descriptor calculation completed');
    console.log(`📦 Total packages: ${Object.keys(combinedDescriptors).length}`);

    // Display failed files if any
    if (failedFiles.length > 0) {
      console.log('\n⚠️  Failed files (not uploaded):');
      for (const failed of failedFiles) {
        if (!failed.success) {
          const filename = failed.file.Url.split('/').pop() || 'unknown';
          console.log(`\n  ❌ ${filename}`);
          console.log(`     URL: ${failed.file.Url}`);
          console.log(`     Error: ${failed.error}`);
        }
      }
      console.log(`\n⚠️  Total failed: ${failedFiles.length} files`);
    }

    if (!shouldUpload) {
      console.log('');
      console.log('💡 Tip: Remove --no-upload flag to upload descriptors to Cloudflare KV cache.');
    }

    if (!useCache) {
      console.log('');
      console.log('💡 Tip: Use --use-cache flag to skip already cached descriptors and save bandwidth.');
    }
  } catch (error) {
    console.error('❌ Descriptor calculation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
