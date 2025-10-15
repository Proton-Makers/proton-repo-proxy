#!/usr/bin/env tsx

/**
 * Download Proton API responses and save them to disk
 * Usage: PROTON_CACHE_DIR=/path npx tsx src/github/check-proton-versions/download-proton-api.ts
 */

import { createWriteStream } from 'node:fs';
import { pipeline, Readable } from 'node:stream';
import { promisify } from 'node:util';
import { PROTON_APIS, PROTON_PRODUCTS, type ProtonProduct } from '../../shared';

// Promisify pipeline for easier use
const streamPipeline = promisify(pipeline);

async function downloadProtonAPI(product: ProtonProduct, cacheDir: string): Promise<void> {
  // Product
  const url = PROTON_APIS[product];
  const filename = `${cacheDir}/${product}.json`;

  // Download
  console.log(`📥 Downloading ${product} API response from ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${product} API: ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error(`No response body for ${product}`);
  }

  // Save file
  const fileStream = createWriteStream(filename);
  // biome-ignore lint/suspicious/noExplicitAny: strange typing from node:stream Readable
  await streamPipeline(Readable.fromWeb(response.body as any), fileStream);
  console.log(`✅ Saved ${product} API response to ${filename}`);
}

async function main() {
  const cacheDir = process.env.PROTON_CACHE_DIR;
  if (!cacheDir) {
    console.error('❌ PROTON_CACHE_DIR environment variable is required');
    process.exit(1);
  }

  console.log('📥 Downloading Proton API responses...\n');

  try {
    await Promise.all(PROTON_PRODUCTS.map((product) => downloadProtonAPI(product, cacheDir)));
    console.log('\n✅ All API responses downloaded successfully');
  } catch (error) {
    console.error('❌ Download failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
