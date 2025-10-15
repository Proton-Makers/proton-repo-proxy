#!/usr/bin/env tsx

/**
 * Validate Proton API responses (format + URLs)
 * Usage: PROTON_CACHE_DIR=/path npx tsx src/github/check-proton-versions/validate-proton-api.ts
 */

import { readFileSync } from 'node:fs';
import { PROTON_SERVER, ProtonProduct, validateProtonApiResponse } from '../../shared';

function validateAPIFile(product: ProtonProduct, cacheDir: string): void {
  const filename = `${cacheDir}/${product}.json`;
  console.log(`🔍 Validating ${product} API response from ${filename}`);

  // Read file
  const rawData = readFileSync(filename, 'utf-8');
  const jsonData = JSON.parse(rawData);

  // Validate with Zod
  const validatedData = validateProtonApiResponse(jsonData);

  if (!validatedData.Releases || validatedData.Releases.length === 0) {
    throw new Error(`No releases found in ${product} API response`);
  }

  console.log(`  ✅ Format valid (${validatedData.Releases.length} releases)`);

  // Validate all file URLs start with PROTON_SERVER
  const allFileUrlsValid = validatedData.Releases.flatMap((r) => r.File || [])
    .map((f) => f.Url || '')
    .filter((u) => u) // Ignore empty URLs
    .every((u) => u.startsWith(PROTON_SERVER));

  if (!allFileUrlsValid) {
    throw new Error(`Some file URLs in ${product} API response do not start with ${PROTON_SERVER}`);
  }

  console.log(`  ✅ All file URLs start with ${PROTON_SERVER}`);
}

async function main() {
  const cacheDir = process.env.PROTON_CACHE_DIR;
  if (!cacheDir) {
    console.error('❌ PROTON_CACHE_DIR environment variable is required');
    process.exit(1);
  }

  console.log('🔍 Validating Proton API responses...\n');

  try {
    validateAPIFile(ProtonProduct.MAIL, cacheDir);
    validateAPIFile(ProtonProduct.PASS, cacheDir);

    console.log('\n✅ All API responses validated successfully');
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
