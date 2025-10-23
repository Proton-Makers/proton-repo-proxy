#!/usr/bin/env tsx
/**
 * Upload APT metadata files to Cloudflare KV
 * Usage: APT_OUTPUT_DIR=/path tsx src/github/update-apt/upload-metadata.ts
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getKVConfig, KVCacheKey, setKvValue } from '../../shared';

async function main() {
  // Get output directory from environment or command line
  const outputDir = process.env.APT_OUTPUT_DIR || process.argv[2];

  if (!outputDir) {
    console.error('❌ APT_OUTPUT_DIR environment variable or directory argument is required');
    process.exit(1);
  }

  console.log('📤 Uploading APT metadata to Cloudflare KV...');
  console.log(`📂 Output directory: ${outputDir}\n`);

  const { namespaceId } = getKVConfig();

  // Read generated files (new naming convention)
  const packagesFile = join(outputDir, 'Packages');
  const releaseFile = join(outputDir, 'Release');
  const archReleaseFile = join(outputDir, 'arch-Release');

  if (!existsSync(packagesFile)) {
    throw new Error(`Packages file not found: ${packagesFile}`);
  }
  if (!existsSync(releaseFile)) {
    throw new Error(`Release file not found: ${releaseFile}`);
  }
  if (!existsSync(archReleaseFile)) {
    throw new Error(`Arch Release file not found: ${archReleaseFile}`);
  }

  const packagesContent = readFileSync(packagesFile, 'utf8');
  const releaseContent = readFileSync(releaseFile, 'utf8');
  const archReleaseContent = readFileSync(archReleaseFile, 'utf8');

  // Upload to KV with proper keys
  console.log('📤 Uploading Packages file...');
  await setKvValue(namespaceId, KVCacheKey.APT_PACKAGES, packagesContent);

  console.log('📤 Uploading Release file...');
  await setKvValue(namespaceId, KVCacheKey.APT_RELEASE, releaseContent);

  console.log('📤 Uploading Architecture Release file...');
  await setKvValue(namespaceId, KVCacheKey.APT_ARCH_RELEASE, archReleaseContent);

  // Upload GPG-signed files if they exist
  const inReleaseFile = join(outputDir, 'InRelease');
  const releaseGpgFile = join(outputDir, 'Release.gpg');
  const publicKeyFile = join(outputDir, 'public.gpg.key');

  if (existsSync(inReleaseFile)) {
    console.log('📤 Uploading InRelease file (signed)...');
    const inReleaseContent = readFileSync(inReleaseFile, 'utf8');
    await setKvValue(namespaceId, KVCacheKey.APT_INRELEASE, inReleaseContent);
  } else {
    console.log('⚠️  InRelease file not found (skipping GPG signature)');
  }

  if (existsSync(releaseGpgFile)) {
    console.log('📤 Uploading Release.gpg file (detached signature)...');
    const releaseGpgContent = readFileSync(releaseGpgFile, 'utf8');
    await setKvValue(namespaceId, KVCacheKey.APT_RELEASE_GPG, releaseGpgContent);
  } else {
    console.log('⚠️  Release.gpg file not found (skipping GPG signature)');
  }

  if (existsSync(publicKeyFile)) {
    console.log('📤 Uploading public GPG key...');
    const publicKeyContent = readFileSync(publicKeyFile, 'utf8');
    await setKvValue(namespaceId, KVCacheKey.APT_PUBLIC_KEY, publicKeyContent);
  } else {
    console.log('⚠️  Public GPG key not found (skipping)');
  }

  // Update last update timestamp
  await setKvValue(namespaceId, 'last-update-timestamp', new Date().toISOString());

  console.log('✅ All metadata uploaded successfully!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Upload failed:', error);
    process.exit(1);
  });
}

export { main as uploadMetadata };
