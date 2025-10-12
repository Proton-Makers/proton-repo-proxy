#!/usr/bin/env node

import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

function generatePackagesFile(packageData) {
  let content = '';

  for (const pkg of packageData) {
    content += `Package: proton-mail
Version: ${pkg.version}
Architecture: amd64
Maintainer: Proton AG <opensource@proton.me>
Filename: ${pkg.url}
Size: ${pkg.size}
SHA256: ${pkg.sha256}
Section: utils
Priority: optional
Homepage: https://proton.me/
Description: Proton Mail - Secure and private email/password manager

`;
  }

  return content.trim();
}

function generateReleaseFile(packagesContent) {
  const packagesHash = createHash('sha256').update(packagesContent).digest('hex');
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

function main() {
  console.log('📦 Generating APT repository metadata...');

  // Read hash data
  const packageData = JSON.parse(readFileSync('package-hashes.json'));

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
