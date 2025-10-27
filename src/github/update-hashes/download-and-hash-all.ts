#!/usr/bin/env tsx
/**
 * Download and hash all Proton packages
 * Usage: PROTON_CACHE_DIR=/path CLOUDFLARE_ACCOUNT_ID=xxx CLOUDFLARE_API_TOKEN=xxx tsx src/github/update-hashes/download-and-hash-all.ts
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import {
  downloadHashCache,
  getKVConfig,
  type HashCache,
  PROTON_IDENTIFIER_PREFIX,
  PROTON_IGNORE_FILE_URLS,
  PROTON_PRODUCTS,
  type ProtonApiResponse,
  uploadHashCache,
} from '../../shared';

/**
 * Calculate SHA256 and SHA512 hashes by downloading file
 */
async function calculateHashes(
  url: string
): Promise<{ md5: string; sha256: string; sha512: string; size: number }> {
  return new Promise((resolve, reject) => {
    const md5Hash = createHash('md5');
    const sha256Hash = createHash('sha256');
    const sha512Hash = createHash('sha512');
    let totalSize = 0;

    https
      .get(url, (response) => {
        const fileSize = Number.parseInt(response.headers['content-length'] || '0', 10);

        response.on('data', (chunk: Buffer) => {
          totalSize += chunk.length;
          const progress = ((totalSize / fileSize) * 100).toFixed(1);
          process.stdout.write(`\r    Progress: ${progress}%`);

          md5Hash.update(chunk);
          sha256Hash.update(chunk);
          sha512Hash.update(chunk);
        });

        response.on('end', () => {
          const md5 = md5Hash.digest('hex');
          const sha256 = sha256Hash.digest('hex');
          const sha512 = sha512Hash.digest('hex');
          process.stdout.write('\n');
          resolve({ md5, sha256, sha512, size: totalSize });
        });

        response.on('error', reject);
      })
      .on('error', reject);
  });
}

/**
 * Main processing function
 */
async function main(): Promise<void> {
  console.log('🔄 Starting hash calculation process...\n');

  // 1. Check environment
  const cacheDir = process.env.PROTON_CACHE_DIR;
  if (!cacheDir) {
    console.error('❌ PROTON_CACHE_DIR environment variable is required');
    process.exit(1);
  }

  // 1bis. Get KV config
  const { namespaceId } = getKVConfig();

  // 2. Download existing hash cache from KV
  const hashCache = await downloadHashCache(namespaceId);
  console.log('  ✅ Hash cache downloaded successfully');

  // 3. Collect all files to process
  console.log('📋 Reading Proton API responses from cache...\n');
  const allFiles: Array<{
    product: string;
    version: string;
    url: string;
    sha512Provided: string;
  }> = [];

  for (const product of PROTON_PRODUCTS) {
    const filename = `${cacheDir}/${product}.json`;

    if (!existsSync(filename)) {
      console.error(`❌ File not found: ${filename}`);
      process.exit(1);
    }

    console.log(`  📂 Reading ${product}.json...`);
    const rawData = readFileSync(filename, 'utf-8');
    const apiResponse = JSON.parse(rawData) as ProtonApiResponse;

    // Process each release
    for (const release of apiResponse.Releases || []) {
      // Process each file in the release
      for (const file of release.File || []) {
        const identifier = file.Identifier?.toLowerCase() || '';

        // Only process .deb files for now (.rpm will be activated later)
        if (
          identifier.startsWith(PROTON_IDENTIFIER_PREFIX.DEB) &&
          file.Url &&
          !PROTON_IGNORE_FILE_URLS.includes(file.Url)
        ) {
          allFiles.push({
            product,
            version: release.Version,
            url: file.Url,
            sha512Provided: file.Sha512CheckSum || '',
          });
        }
      }
    }
  }

  console.log(`  ✅ Found ${allFiles.length} file(s) to process\n`);

  // 4. Process each file
  console.log('🔢 Processing files...\n');
  const newHashCache: HashCache = {};
  let skipped = 0;
  let computed = 0;
  let errors = 0;

  for (const fileInfo of allFiles) {
    const filename = fileInfo.url.split('/').pop() || 'unknown';
    console.log(`📦 ${fileInfo.product} ${fileInfo.version} - ${filename}`);

    // Check if already in cache
    const cachedHash = hashCache?.[fileInfo.url];
    if (cachedHash) {
      console.log('  💾 Using cached hash (skip download)');
      newHashCache[fileInfo.url] = cachedHash;
      skipped++;
      continue;
    }

    // Download and calculate hashes
    try {
      console.log('  🔄 Downloading and calculating hashes...');
      const calculated = await calculateHashes(fileInfo.url);

      // Verify SHA512 matches
      if (calculated.sha512 !== fileInfo.sha512Provided) {
        console.error('  ❌ SHA512 MISMATCH!');
        console.error(`     Expected: ${fileInfo.sha512Provided}`);
        console.error(`     Computed: ${calculated.sha512}`);
        errors++;
        continue;
      }

      console.log('  ✅ SHA512 verified successfully');

      // Store in new cache
      newHashCache[fileInfo.url] = {
        md5: calculated.md5,
        sha256: calculated.sha256,
        sha512: calculated.sha512,
        size: calculated.size,
        lastVerified: new Date().toISOString(),
      };

      computed++;
    } catch (error) {
      console.error(`  ❌ Error processing file: ${error}`);
      errors++;
    }

    console.log();
  }

  // 5. Summary
  console.log('📊 Processing Summary:');
  console.log(`  Total files: ${allFiles.length}`);
  console.log(`  Cached (skipped): ${skipped}`);
  console.log(`  Newly computed: ${computed}`);
  console.log(`  Errors: ${errors}`);
  console.log();

  if (errors > 0) {
    console.error('❌ Some files had errors, aborting');
    process.exit(1);
  }

  // 6. Generate package-hashes.json for APT metadata generation
  console.log('📄 Generating package-hashes.json...');
  const packageHashes: HashCache = {};

  for (const fileInfo of allFiles) {
    const hashInfo = newHashCache[fileInfo.url];
    if (hashInfo) {
      packageHashes[fileInfo.url] = {
        md5: hashInfo.md5,
        sha256: hashInfo.sha256,
        sha512: hashInfo.sha512,
        size: hashInfo.size,
      };
    }
  }

  writeFileSync('package-hashes.json', JSON.stringify(packageHashes, null, 2));
  console.log(
    `  ✅ Saved ${Object.keys(packageHashes).length} package hash(es) to package-hashes.json\n`
  );

  // 7. Upload updated cache to KV
  await uploadHashCache(namespaceId, newHashCache);

  console.log('\n✅ Hash calculation completed successfully!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Hash calculation failed:', error);
    process.exit(1);
  });
}
