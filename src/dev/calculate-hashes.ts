#!/usr/bin/env tsx

/**
 * Development script to manually calculate and validate package hashes
 * Usage: pnpm run dev:calculate-hashes [product] [--no-upload]
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
 */

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { getKVConfig, getValue, setValue } from '../github';
import {
  type HashCache,
  KVCacheKey,
  type PackageHash,
  type ProtonFile,
  validateProtonApiResponse,
} from '../shared';

const PROTON_APIS = {
  mail: 'https://proton.me/download/mail/linux/version.json',
  pass: 'https://proton.me/download/pass/linux/version.json',
} as const;

/**
 * Fetch releases for a specific product
 */
async function fetchReleases(product: keyof typeof PROTON_APIS) {
  console.log(`🔍 Fetching ${product} releases...`);

  const response = await fetch(PROTON_APIS[product]);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${product} releases: ${response.status}`);
  }

  const data = await response.json();
  const validated = validateProtonApiResponse(data);
  return validated.Releases;
}

/**
 * Calculate hash for a package
 */
async function calculatePackageHash(
  url: string,
  version: string,
  product: keyof typeof PROTON_APIS,
  debFile: ProtonFile
): Promise<PackageHash> {
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
    filename,
    sha256,
    sha512,
    size,
    version,
    url,
    product,
  };
}

/**
 * Process all releases for a product
 */
async function processProduct(product: keyof typeof PROTON_APIS): Promise<PackageHash[]> {
  const releases = await fetchReleases(product);
  const packages: PackageHash[] = [];

  for (const release of releases) {
    // Find .deb file for this release (check URL, not Identifier)
    const debFile = release.File.find((f) => f.Url.endsWith('.deb'));
    if (debFile) {
      console.log(
        `  📦 Found .deb for ${product} ${release.Version}: ${debFile.Url.split('/').pop()}`
      );
      const packageHash = await calculatePackageHash(
        debFile.Url,
        release.Version,
        product,
        debFile
      );
      packages.push(packageHash);
    } else {
      console.log(`  ⚠️  No .deb file found for ${product} ${release.Version}`);
    }
  }

  return packages;
}

/**
 * Upload packages to KV cache
 */
async function uploadToCache(packages: PackageHash[]): Promise<void> {
  console.log('\n☁️  Uploading hashes to Cloudflare KV cache...');

  const { namespaceId } = getKVConfig();

  // Get existing cache or create new one
  let hashCache: HashCache = {};
  try {
    const existingCache = await getValue(namespaceId, KVCacheKey.PACKAGE_HASHES);
    if (existingCache) {
      hashCache = JSON.parse(existingCache);
      console.log(`  📥 Found existing cache with ${Object.keys(hashCache).length} entries`);
    }
  } catch {
    console.log('  📝 Creating new hash cache');
  }

  // Add new packages to cache
  let addedCount = 0;
  let updatedCount = 0;

  for (const pkg of packages) {
    const key = pkg.url;
    const existing = hashCache[key];

    if (existing) {
      // Update existing entry
      hashCache[key] = {
        sha256: pkg.sha256,
        sha512: pkg.sha512,
        size: pkg.size,
        lastVerified: new Date().toISOString(),
      };
      updatedCount++;
      console.log(`  🔄 Updated cache for ${pkg.filename}`);
    } else {
      // Add new entry
      hashCache[key] = {
        sha256: pkg.sha256,
        sha512: pkg.sha512,
        size: pkg.size,
        lastVerified: new Date().toISOString(),
      };
      addedCount++;
      console.log(`  ➕ Added to cache: ${pkg.filename}`);
    }
  }

  // Upload updated cache
  await setValue(namespaceId, KVCacheKey.PACKAGE_HASHES, JSON.stringify(hashCache));

  console.log(`  ✅ Cache updated: ${addedCount} added, ${updatedCount} updated`);
  console.log(`  💾 Total cache entries: ${Object.keys(hashCache).length}`);
}
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse arguments
  const productArg = args.find((arg) => !arg.startsWith('--'));
  const shouldUpload = !args.includes('--no-upload'); // Upload by default

  const targetProduct = productArg as keyof typeof PROTON_APIS | undefined;

  if (targetProduct && !PROTON_APIS[targetProduct]) {
    console.error('❌ Invalid product. Use: mail, pass, or leave empty for both');
    console.error('📝 Available flags: --no-upload');
    process.exit(1);
  }

  console.log('🔢 Calculating package hashes with real SHA256/SHA512...');
  if (shouldUpload) {
    console.log('☁️  Upload to KV cache: enabled (use --no-upload to disable)');
  } else {
    console.log('� Local save only: upload disabled');
  }
  console.log('');

  try {
    const allPackages: PackageHash[] = [];

    if (targetProduct) {
      // Single product
      console.log(`📦 Processing ${targetProduct} only`);
      const packages = await processProduct(targetProduct);
      allPackages.push(...packages);
    } else {
      // All products
      console.log('📦 Processing all products');
      for (const product of Object.keys(PROTON_APIS) as Array<keyof typeof PROTON_APIS>) {
        const packages = await processProduct(product);
        allPackages.push(...packages);
      }
    }

    // Save results locally
    writeFileSync('dev-package-hashes.json', JSON.stringify(allPackages, null, 2));
    console.log('\n💾 Results saved to dev-package-hashes.json');

    // Upload to cache by default (unless --no-upload)
    if (shouldUpload) {
      await uploadToCache(allPackages);
    }

    console.log('\n✅ Hash calculation completed');
    console.log(`📦 Total packages: ${allPackages.length}`);
    console.log('🔢 Real SHA256/SHA512 hashes calculated for all packages');

    if (!shouldUpload) {
      console.log('');
      console.log('💡 Tip: Remove --no-upload flag to upload hashes to Cloudflare KV cache.');
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
