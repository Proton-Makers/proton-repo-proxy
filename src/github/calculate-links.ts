#!/usr/bin/env tsx
/**
 * Calculate URL mappings from pool paths to actual download URLs
 * Usage: npx tsx src/github/calculate-links.ts
 * Reads: package-hashes.json
 * Outputs: url-mapping.json
 */

import { readFileSync, writeFileSync } from 'node:fs';
import type { PackageHash } from '../shared';

/**
 * Generate a pool path for a package (standard Debian repository structure)
 * Example: pool/main/p/proton-mail/proton-mail_1.9.1_amd64.deb
 */
function generatePoolPath(packageName: string, version: string): string {
  const firstLetter = packageName.charAt(0);
  const filename = `${packageName}_${version}_amd64.deb`;
  return `pool/main/${firstLetter}/${packageName}/${filename}`;
}

/**
 * Generate URL mapping from pool paths to actual download URLs
 */
function generateUrlMapping(packageData: PackageHash[]): Record<string, string> {
  console.log('🔗 Generating URL mappings...');
  const mapping: Record<string, string> = {};

  for (const pkg of packageData) {
    const packageName = pkg.product === 'mail' ? 'proton-mail' : 'proton-pass';
    const poolPath = generatePoolPath(packageName, pkg.version);
    mapping[poolPath] = pkg.url;
    console.log(`  ${poolPath} → ${pkg.url}`);
  }

  console.log(`✅ Generated ${Object.keys(mapping).length} URL mappings`);
  return mapping;
}

async function main() {
  console.log('🔗 Calculating URL mappings...');

  // Read package hashes
  const packageData: PackageHash[] = JSON.parse(readFileSync('package-hashes.json', 'utf8'));
  console.log(`📦 Found ${packageData.length} packages`);

  // Generate URL mapping
  const urlMapping = generateUrlMapping(packageData);

  // Save to file
  writeFileSync('url-mapping.json', JSON.stringify(urlMapping, null, 2));
  console.log('💾 Saved url-mapping.json');

  console.log('✅ URL mapping calculation completed');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Failed to calculate URL mappings:', error);
    process.exit(1);
  });
}

export { generateUrlMapping };
