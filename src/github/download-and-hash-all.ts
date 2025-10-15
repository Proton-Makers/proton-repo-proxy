#!/usr/bin/env tsx
/**
 * Enhanced download and hash calculator for all Proton products
 * Usage: npx tsx src/github/download-and-hash-all.ts
 */

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import https from 'node:https';
import {
  type HashCache,
  KVCacheKey,
  type PackageHash,
  PROTON_APIS,
  type ProtonProduct,
  validateProtonApiResponse,
} from '../shared';
import { getKVConfig, getValue, setValue } from './upload-to-kv.js';

/**
 * Fetch all releases for a product
 */
async function fetchAllReleases(product: ProtonProduct) {
  console.log(`🔍 Fetching ${product} releases...`);

  try {
    const response = await fetch(PROTON_APIS[product]);

    if (!response.ok) {
      throw new Error(`API request failed for ${product}: ${response.status}`);
    }

    const data = (await response.json()) as unknown;
    const validatedData = validateProtonApiResponse(data);

    if (!validatedData.Releases || validatedData.Releases.length === 0) {
      throw new Error(`No releases found for ${product}`);
    }

    return validatedData.Releases;
  } catch (error) {
    console.error(`❌ Failed to fetch ${product} releases:`, error);
    throw error;
  }
}

/**
 * Get hash cache from KV
 */
async function getHashCache(): Promise<HashCache> {
  try {
    const { namespaceId } = getKVConfig();
    const cached = await getValue(namespaceId, KVCacheKey.PACKAGE_HASHES);

    if (cached) {
      return JSON.parse(cached) as HashCache;
    }
  } catch (error) {
    console.warn('⚠️  Could not read hash cache:', error);
  }

  return {};
}

/**
 * Save hash cache to KV
 */
async function saveHashCache(cache: HashCache): Promise<void> {
  try {
    const { namespaceId } = getKVConfig();
    await setValue(namespaceId, KVCacheKey.PACKAGE_HASHES, JSON.stringify(cache, null, 2));
    console.log('💾 Hash cache updated');
  } catch (error) {
    console.error('❌ Failed to save hash cache:', error);
  }
}

/**
 * Calculate hash without downloading (from URL headers)
 */
async function calculateHashFromUrl(
  url: string
): Promise<{ sha256: string; sha512: string; size: number }> {
  console.log(`🔍 Calculating hash for ${url.split('/').pop()}`);

  return new Promise((resolve, reject) => {
    const sha256Hash = createHash('sha256');
    const sha512Hash = createHash('sha512');

    https
      .get(url, (response) => {
        let totalSize = 0;
        const fileSize = Number.parseInt(response.headers['content-length'] || '0', 10);

        response.on('data', (chunk: Buffer) => {
          totalSize += chunk.length;
          const progress = ((totalSize / fileSize) * 100).toFixed(1);
          process.stdout.write(`\r  Progress: ${progress}%`);

          sha256Hash.update(chunk);
          sha512Hash.update(chunk);
        });

        response.on('end', () => {
          const sha256 = sha256Hash.digest('hex');
          const sha512 = sha512Hash.digest('hex');
          console.log(`\n  ✅ Calculated hashes for ${url.split('/').pop()}`);
          resolve({ sha256, sha512, size: totalSize });
        });

        response.on('error', reject);
      })
      .on('error', reject);
  });
}

/**
 * Process all products and versions
 */
async function processAllProducts(): Promise<PackageHash[]> {
  console.log('📦 Processing all Proton products...');

  const hashCache = await getHashCache();
  const results: PackageHash[] = [];
  let cacheUpdated = false;

  for (const [product, _] of Object.entries(PROTON_APIS)) {
    const productKey = product as keyof typeof PROTON_APIS;

    try {
      const releases = await fetchAllReleases(productKey);

      // Process all releases for this product
      for (const release of releases) {
        console.log(`📦 Processing ${product} version ${release.Version}`);

        // Find .deb file for this release
        const debFile = release.File.find((f) => f.Url.endsWith('.deb'));
        if (!debFile) {
          console.warn(`  ⚠️  No .deb file found for ${product} ${release.Version}`);
          continue;
        }

        const url = debFile.Url;
        const filename = url.split('/').pop() || 'unknown-file';

        // Check cache first
        let hashInfo = hashCache[url];

        if (hashInfo) {
          console.log(`  💾 Using cached hash for ${filename}`);
        } else {
          // Calculate new hash
          console.log(`  🔄 Calculating new hash for ${filename}`);
          const calculated = await calculateHashFromUrl(url);

          hashInfo = {
            sha256: calculated.sha256,
            sha512: calculated.sha512,
            size: calculated.size,
            lastVerified: new Date().toISOString(),
          };

          // Update cache
          hashCache[url] = hashInfo;
          cacheUpdated = true;
        }

        // Add to results
        results.push({
          filename,
          sha256: hashInfo.sha256,
          sha512: hashInfo.sha512,
          size: hashInfo.size,
          version: release.Version,
          url,
          product: productKey,
        });
      }
    } catch (error) {
      console.error(`❌ Failed to process ${product}:`, error);
      // Continue with other products
    }
  }

  // Save updated cache
  if (cacheUpdated) {
    await saveHashCache(hashCache);
  }

  return results;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    const results = await processAllProducts();

    if (results.length === 0) {
      throw new Error('No packages processed successfully');
    }

    // Save results
    writeFileSync('package-hashes.json', JSON.stringify(results, null, 2));

    console.log('');
    console.log('✅ Processing completed successfully');
    console.log(`📦 Total packages: ${results.length}`);

    // Summary by product
    const summary = results.reduce(
      (acc, pkg) => {
        acc[pkg.product] = (acc[pkg.product] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    for (const [product, count] of Object.entries(summary)) {
      console.log(`  - ${product}: ${count} version(s)`);
    }

    console.log('💾 Results saved to package-hashes.json');
  } catch (error) {
    console.error('❌ Processing failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { processAllProducts, calculateHashFromUrl, getHashCache };
