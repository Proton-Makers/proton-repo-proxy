#!/usr/bin/env tsx
/**
 * Download and hash all Proton packages
 * Usage: PROTON_CACHE_DIR=/path CLOUDFLARE_ACCOUNT_ID=xxx CLOUDFLARE_API_TOKEN=xxx tsx src/github/update-hashes/download-and-hash-all.ts
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  DescriptorFromFile,
  downloadDescriptorsCache,
  getKVConfig,
  type PackageDescriptors,
  PROTON_IDENTIFIER_PREFIX,
  PROTON_IGNORE_FILE_URLS,
  PROTON_PRODUCTS,
  type ProtonApiResponse,
  ProtonFile,
  uploadDescriptorsCache
} from '../../shared';

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
  const hashCache = await downloadDescriptorsCache(namespaceId);
  console.log('  ✅ Hash cache downloaded successfully');

  // 3. Collect all files to process
  console.log('📋 Reading Proton API responses from cache...\n');
  const allFiles: Array<{
    product: string;
    version: string;
    file: ProtonFile;
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
            file,
          });
        }
      }
    }
  }

  console.log(`  ✅ Found ${allFiles.length} file(s) to process\n`);

  // 4. Process each file
  console.log('🔢 Processing files...\n');
  const newHashCache: PackageDescriptors = {};
  let skipped = 0;
  let computed = 0;
  let errors = 0;

  for (const fileInfo of allFiles) {
    const filename = fileInfo.file.Url.split('/').pop() || 'unknown';
    console.log(`📦 ${fileInfo.product} ${fileInfo.version} - ${filename}`);

    // Check if already in cache
    const cachedHash = hashCache?.[fileInfo.file.Url];
    if (cachedHash) {
      console.log('  💾 Using cached hash (skip download)');
      newHashCache[fileInfo.file.Url] = cachedHash;
      skipped++;
      continue;
    }

    // Download and calculate hashes
    try {
      console.log('  🔄 Downloading and calculating hashes...');
      const descriptor = await DescriptorFromFile(fileInfo.file);

      newHashCache[fileInfo.file.Url] = descriptor;

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

  // 6. Generate package-descriptors.json for APT metadata generation
  console.log('📄 Generating package-descriptors.json...');
  writeFileSync('package-descriptors.json', JSON.stringify(newHashCache, null, 2));
  console.log(
    `  ✅ Saved ${Object.keys(newHashCache).length} package descriptor(s) to package-descriptors.json\n`
  );

  // 7. Upload updated cache to KV
  await uploadDescriptorsCache(namespaceId, newHashCache);

  console.log('\n✅ Package descriptor calculation completed successfully!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Hash calculation failed:', error);
    process.exit(1);
  });
}
