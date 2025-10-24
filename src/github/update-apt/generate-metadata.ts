#!/usr/bin/env tsx

/**
 * Generate APT repository metadata from Proton API responses and hash cache
 * Usage: PROTON_CACHE_DIR=/path APT_OUTPUT_DIR=/path tsx src/github/update-apt/generate-metadata.ts
 *
 * Features:
 * - Loads validated Proton API responses from cache directory
 * - Loads hash cache from Cloudflare KV
 * - Filters .deb files (excluding problematic URLs)
 * - Generates APT metadata files (Packages, Release, arch Release)
 * - Saves to output directory for upload
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  downloadHashCache,
  getKVConfig,
  type HashCache,
  type HashEntry,
  PROTON_IDENTIFIER_PREFIX,
  PROTON_IGNORE_FILE_URLS,
  PROTON_PRODUCTS,
  PROTON_SERVER,
  type ProtonApiResponse,
} from '../../shared';
import { calculateMD5, calculateSHA1, calculateSHA256 } from '../utils';

/**
 * Extract proxy path from Proton download URL
 * Example: https://proton.me/download/mail/linux/1.9.1/ProtonMail-desktop-beta.deb
 *          -> proxy/download/mail/linux/1.9.1/ProtonMail-desktop-beta.deb
 */
function extractProxyPath(url: string): string {
  // Remove https://proton.me prefix
  const path = url.replace(PROTON_SERVER, '');
  // Ensure path starts with / before adding proxy prefix
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `proxy${normalizedPath}`;
}

/**
 * Extract product from URL
 */
function extractProductFromUrl(url: string): 'mail' | 'pass' {
  return url.includes('/mail/') ? 'mail' : 'pass';
}

/**
 * Compare two semantic versions
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;

    if (aVal > bVal) {
      return 1;
    }
    if (aVal < bVal) {
      return -1;
    }
  }

  return 0;
}

/**
 * Generate APT Packages file content
 */
function generatePackagesFile(hashCache: HashCache): string {
  // Group packages by name and keep only the latest version
  const packageMap = new Map<string, { version: string; url: string; hashEntry: HashEntry }>();

  // Iterate over hash cache entries to find the latest version of each package
  for (const [url, hashEntry] of Object.entries(hashCache)) {
    // Extract product from URL
    const product = extractProductFromUrl(url);

    // Extract version from filename instead of URL path
    // For URLs like: proxy/download/pass/linux/proton-pass_1.32.10_amd64.deb
    // or: proxy/download/mail/linux/1.9.1/ProtonMail-desktop-beta.deb
    let version = 'unknown';

    // Try to extract from filename first (for pass)
    const filenameVersionMatch = url.match(/proton-pass_([^_]+)_/);
    if (filenameVersionMatch?.[1]) {
      version = filenameVersionMatch[1];
    } else {
      // Fallback to path-based extraction (for mail)
      const pathVersionMatch = url.match(/\/([\d.]+(-[a-zA-Z0-9]+)?)\//);
      if (pathVersionMatch?.[1]) {
        version = pathVersionMatch[1];
      }
    }

    // Skip if version is unknown
    if (version === 'unknown') {
      console.warn(`⚠️  Skipping package with unknown version: ${url}`);
      continue;
    }

    // Map product to package name
    const packageName = product === 'mail' ? 'proton-mail' : 'proton-pass';

    // Keep only the latest version for each package
    const existing = packageMap.get(packageName);
    if (!existing || compareVersions(version, existing.version) > 0) {
      packageMap.set(packageName, { version, url, hashEntry });
    }
  }

  // Generate content for the latest packages only
  let content = '';
  for (const [packageName, { version, url, hashEntry }] of packageMap) {
    const product = packageName === 'proton-mail' ? 'mail' : 'pass';
    const description =
      product === 'mail'
        ? 'Proton Mail - Secure and private email'
        : 'Proton Pass - Secure password manager';

    // Use proxy path: remove https://proton.me and prefix with proxy/
    const proxyPath = extractProxyPath(url);

    content += `Package: ${packageName}
Version: ${version}
Architecture: amd64
Maintainer: Proton AG <opensource@proton.me>
Filename: ${proxyPath}
Size: ${hashEntry.size}
SHA256: ${hashEntry.sha256}
Section: utils
Priority: optional
Homepage: https://proton.me/
Description: ${description}

`;
  }

  console.log(`📦 Generated packages: ${packageMap.size} latest versions only`);
  for (const [packageName, { version }] of packageMap) {
    console.log(`  - ${packageName}: ${version}`);
  }

  return content.trim();
}

function generateReleaseFile(packagesContent: string): string {
  // Calculate hashes for Packages file
  const packagesSize = Buffer.byteLength(packagesContent, 'utf8');
  const packagesMD5 = calculateMD5(packagesContent);
  const packagesSHA1 = calculateSHA1(packagesContent);
  const packagesSHA256 = calculateSHA256(packagesContent);

  // Generate architecture-specific Release content
  const archReleaseContent = `Archive: stable
Component: main
Origin: Proton Repository Proxy
Label: Proton Apps
Architecture: amd64
`;

  const archReleaseSize = Buffer.byteLength(archReleaseContent, 'utf8');
  const archReleaseMD5 = calculateMD5(archReleaseContent);
  const archReleaseSHA1 = calculateSHA1(archReleaseContent);
  const archReleaseSHA256 = calculateSHA256(archReleaseContent);

  // Format date as RFC 2822 with +0000 timezone (APT doesn't accept GMT)
  const now = new Date();
  const dateStr = now.toUTCString().replace('GMT', '+0000');

  return `Origin: Proton Repository Proxy
Label: Proton Apps
Suite: stable
Codename: stable
Components: main
Architectures: amd64
Date: ${dateStr}
Description: Proxy repository for Proton applications
Acquire-By-Hash: no
MD5Sum:
 ${packagesMD5}  ${packagesSize} main/binary-amd64/Packages
 ${archReleaseMD5}  ${archReleaseSize} main/binary-amd64/Release
SHA1:
 ${packagesSHA1}  ${packagesSize} main/binary-amd64/Packages
 ${archReleaseSHA1}  ${archReleaseSize} main/binary-amd64/Release
SHA256:
 ${packagesSHA256}  ${packagesSize} main/binary-amd64/Packages
 ${archReleaseSHA256}  ${archReleaseSize} main/binary-amd64/Release
`;
}

function generateArchReleaseFile(): string {
  return `Archive: stable
Component: main
Origin: Proton Repository Proxy
Label: Proton Apps
Architecture: amd64
`;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('📦 Generating APT repository metadata...\n');

  // 1. Check environment
  const cacheDir = process.env.PROTON_CACHE_DIR;
  const outputDir = process.env.APT_OUTPUT_DIR;

  if (!cacheDir) {
    console.error('❌ PROTON_CACHE_DIR environment variable is required');
    process.exit(1);
  }

  if (!outputDir) {
    console.error('❌ APT_OUTPUT_DIR environment variable is required');
    process.exit(1);
  }

  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // 2. Load hash cache from KV
  console.log('📥 Loading hash cache from Cloudflare KV...');
  const { namespaceId } = getKVConfig();
  const hashCache = await downloadHashCache(namespaceId);

  if (!hashCache || Object.keys(hashCache).length === 0) {
    console.error('❌ No hash cache found in Cloudflare KV');
    process.exit(1);
  }
  console.log(`  ✅ Loaded ${Object.keys(hashCache).length} hash entries\n`);

  // 3. Load Proton API responses and filter .deb files
  console.log('📋 Loading Proton API responses...');
  const validUrls = new Set<string>();

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

        // Only process .deb files, excluding problematic URLs
        if (
          identifier.startsWith(PROTON_IDENTIFIER_PREFIX.DEB) &&
          file.Url &&
          !PROTON_IGNORE_FILE_URLS.includes(file.Url)
        ) {
          validUrls.add(file.Url);
        }
      }
    }
  }

  console.log(`  ✅ Found ${validUrls.size} valid .deb file(s)\n`);

  // 4. Filter hash cache to only include valid .deb files
  console.log('🔍 Filtering hash cache for valid .deb files...');
  const filteredHashCache: HashCache = {};
  let includedCount = 0;
  let excludedCount = 0;

  for (const [url, hashEntry] of Object.entries(hashCache)) {
    if (validUrls.has(url)) {
      filteredHashCache[url] = hashEntry;
      includedCount++;
    } else {
      excludedCount++;
    }
  }

  console.log(`  ✅ Included: ${includedCount} file(s)`);
  console.log(`  ⚠️  Excluded: ${excludedCount} file(s) (problematic or non-.deb)\n`);

  // 5. Generate APT metadata files
  console.log('🏗️  Generating APT metadata files...');
  const packagesContent = generatePackagesFile(filteredHashCache);
  const releaseContent = generateReleaseFile(packagesContent);
  const archReleaseContent = generateArchReleaseFile();

  // 6. Save files to output directory
  console.log('💾 Saving APT metadata files...');
  writeFileSync(`${outputDir}/Packages`, packagesContent);
  writeFileSync(`${outputDir}/Release`, releaseContent);
  writeFileSync(`${outputDir}/arch-Release`, archReleaseContent);

  console.log(`  ✅ Packages: ${packagesContent.length} bytes`);
  console.log(`  ✅ Release: ${releaseContent.length} bytes`);
  console.log(`  ✅ arch-Release: ${archReleaseContent.length} bytes\n`);

  console.log('✅ APT metadata generated successfully');
  console.log(`� Output directory: ${outputDir}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Failed to generate APT metadata:', error);
    process.exit(1);
  });
}
