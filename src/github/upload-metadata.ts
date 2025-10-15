#!/usr/bin/env tsx
/**
 * Upload APT metadata files to Cloudflare KV
 * Usage: npx tsx src/github/upload-metadata.ts <packages-dir>
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KVCacheKey } from '../shared';
import { getKVConfig, setValue } from './upload-to-kv.js';

async function main() {
  const packagesDir = process.argv[2] || '/tmp/proton-packages';

  console.log('📤 Uploading APT metadata to Cloudflare KV...');
  console.log(`📂 Packages directory: ${packagesDir}`);

  const { namespaceId } = getKVConfig();

  // Read generated files
  const packagesFile = join(packagesDir, 'packages-content.txt');
  const releaseFile = join(packagesDir, 'release-content.txt');
  const archReleaseFile = join(packagesDir, 'arch-release-content.txt');
  const urlMappingFile = join(packagesDir, 'url-mapping.json');

  if (!existsSync(packagesFile)) {
    throw new Error(`Packages file not found: ${packagesFile}`);
  }
  if (!existsSync(releaseFile)) {
    throw new Error(`Release file not found: ${releaseFile}`);
  }
  if (!existsSync(archReleaseFile)) {
    throw new Error(`Arch Release file not found: ${archReleaseFile}`);
  }
  if (!existsSync(urlMappingFile)) {
    throw new Error(`URL mapping file not found: ${urlMappingFile}`);
  }

  const packagesContent = readFileSync(packagesFile, 'utf8');
  const releaseContent = readFileSync(releaseFile, 'utf8');
  const archReleaseContent = readFileSync(archReleaseFile, 'utf8');
  const urlMapping = readFileSync(urlMappingFile, 'utf8');

  // Upload to KV with proper keys
  console.log('📤 Uploading Packages file...');
  await setValue(namespaceId, KVCacheKey.APT_PACKAGES, packagesContent);

  console.log('📤 Uploading Release file...');
  await setValue(namespaceId, KVCacheKey.APT_RELEASE, releaseContent);

  console.log('📤 Uploading Architecture Release file...');
  await setValue(namespaceId, KVCacheKey.APT_ARCH_RELEASE, archReleaseContent);

  console.log('📤 Uploading URL mapping...');
  await setValue(namespaceId, KVCacheKey.APT_URL_MAPPING, urlMapping);

  // Update last update timestamp
  await setValue(namespaceId, 'last-update-timestamp', new Date().toISOString());

  console.log('✅ All metadata uploaded successfully!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Upload failed:', error);
    process.exit(1);
  });
}

export { main as uploadMetadata };
