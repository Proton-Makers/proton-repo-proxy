#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import type { PackageHash } from '../shared';
import { calculateSHA256 } from './utils';

function generatePackagesFile(packageData: PackageHash[]): string {
  let content = '';

  for (const pkg of packageData) {
    // Map product to package name
    const packageName = pkg.product === 'mail' ? 'proton-mail' : 'proton-pass';
    const description =
      pkg.product === 'mail'
        ? 'Proton Mail - Secure and private email'
        : 'Proton Pass - Secure password manager';

    content += `Package: ${packageName}
Version: ${pkg.version}
Architecture: amd64
Maintainer: Proton AG <opensource@proton.me>
Filename: ${pkg.url}
Size: ${pkg.size}
SHA256: ${pkg.sha256}
Section: utils
Priority: optional
Homepage: https://proton.me/
Description: ${description}

`;
  }

  return content.trim();
}

function generateReleaseFile(packagesContent: string): string {
  const packagesHash = calculateSHA256(packagesContent);
  const packagesSize = Buffer.byteLength(packagesContent, 'utf8');

  return `Origin: Proton Repository Proxy
Label: Proton Apps
Suite: stable
Codename: stable
Components: main
Architectures: amd64
Date: ${new Date().toUTCString()}
Description: Proxy repository for Proton applications

SHA256:
 ${packagesHash} ${packagesSize} main/binary-amd64/Packages
`;
}

function main(): void {
  console.log('📦 Generating APT repository metadata...');

  // Read hash data
  const packageData: PackageHash[] = JSON.parse(readFileSync('package-hashes.json', 'utf8'));

  // Generate APT files
  const packagesContent = generatePackagesFile(packageData);
  const releaseContent = generateReleaseFile(packagesContent);

  // Sauvegarder
  writeFileSync('packages-content.txt', packagesContent);
  writeFileSync('release-content.txt', releaseContent);

  console.log('✅ APT metadata generated successfully');
  console.log(`📄 Packages file: ${packagesContent.length} bytes`);
  console.log(`📄 Release file: ${releaseContent.length} bytes`);
}

main();
