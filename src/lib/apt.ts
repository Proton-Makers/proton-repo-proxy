import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import type { PackageInfo, AptMetadata } from '../types.js';

const gzipAsync = promisify(gzip);

/**
 * Generate APT repository metadata
 */
export async function generateAptMetadata(
  packages: PackageInfo[],
  baseUrl: string
): Promise<AptMetadata> {
  // Filter only .deb packages
  const debPackages = packages.filter((pkg) => pkg.filename.endsWith('.deb'));

  // Generate Packages file
  const packagesContent = generatePackagesFile(debPackages, baseUrl);

  // Compress Packages file
  const packagesGz = await gzipAsync(Buffer.from(packagesContent, 'utf-8'));

  // Generate Release file
  const releaseContent = generateReleaseFile(packagesContent, packagesGz);

  return {
    packages: packagesContent,
    packagesGz,
    release: releaseContent,
    inRelease: '', // Will be generated during signing
  };
}

/**
 * Generate APT Packages file content
 */
function generatePackagesFile(packages: PackageInfo[], baseUrl: string): string {
  const entries: string[] = [];

  for (const pkg of packages) {
    const entry = [
      `Package: ${pkg.name}`,
      `Version: ${pkg.version}`,
      `Architecture: ${pkg.architecture}`,
      `Maintainer: ${pkg.maintainer}`,
      `Filename: pool/main/${pkg.name}/${pkg.filename}`,
      `Size: ${pkg.size}`,
      `SHA256: ${pkg.sha256 || calculateSha256(pkg.url)}`,
      `Section: ${pkg.section || 'utils'}`,
      `Priority: ${pkg.priority || 'optional'}`,
      `Homepage: https://proton.me/`,
      `Description: ${pkg.description}`,
      '',
    ].join('\n');

    entries.push(entry);
  }

  return entries.join('\n');
}

/**
 * Generate APT Release file content
 */
function generateReleaseFile(packagesContent: string, packagesGz: Uint8Array): string {
  const now = new Date();
  const date = now.toUTCString();

  // Calculate hashes and sizes
  const packagesSize = Buffer.byteLength(packagesContent, 'utf-8');
  const packagesGzSize = packagesGz.length;

  const packagesMd5 = createHash('md5').update(packagesContent).digest('hex');
  const packagesSha1 = createHash('sha1').update(packagesContent).digest('hex');
  const packagesSha256 = createHash('sha256').update(packagesContent).digest('hex');

  const packagesGzMd5 = createHash('md5').update(packagesGz).digest('hex');
  const packagesGzSha1 = createHash('sha1').update(packagesGz).digest('hex');
  const packagesGzSha256 = createHash('sha256').update(packagesGz).digest('hex');

  return [
    'Origin: Proton Repository Proxy',
    'Label: Proton Apps',
    'Suite: stable',
    'Codename: stable',
    'Components: main',
    'Architectures: amd64 arm64',
    `Date: ${date}`,
    'Description: Proxy repository for Proton applications',
    '',
    'MD5Sum:',
    ` ${packagesMd5} ${packagesSize.toString().padStart(16)} main/binary-amd64/Packages`,
    ` ${packagesGzMd5} ${packagesGzSize.toString().padStart(16)} main/binary-amd64/Packages.gz`,
    '',
    'SHA1:',
    ` ${packagesSha1} ${packagesSize.toString().padStart(16)} main/binary-amd64/Packages`,
    ` ${packagesGzSha1} ${packagesGzSize.toString().padStart(16)} main/binary-amd64/Packages.gz`,
    '',
    'SHA256:',
    ` ${packagesSha256} ${packagesSize.toString().padStart(16)} main/binary-amd64/Packages`,
    ` ${packagesGzSha256} ${packagesGzSize.toString().padStart(16)} main/binary-amd64/Packages.gz`,
    '',
  ].join('\n');
}

/**
 * Calculate SHA256 hash (placeholder - will be improved)
 */
function calculateSha256(url: string): string {
  // For now, return a placeholder
  // In practice, this should fetch the file and calculate the hash
  return createHash('sha256').update(url).digest('hex');
}

/**
 * Validate APT metadata structure
 */
export function validateAptMetadata(metadata: AptMetadata): boolean {
  try {
    // Basic validation
    if (!metadata.packages || !metadata.packagesGz || !metadata.release) {
      return false;
    }

    // Check if packages file contains valid entries
    const lines = metadata.packages.split('\n');
    const hasPackageEntries = lines.some((line) => line.startsWith('Package:'));

    // Check if release file contains required fields
    const releaseLines = metadata.release.split('\n');
    const hasOrigin = releaseLines.some((line) => line.startsWith('Origin:'));
    const hasSuite = releaseLines.some((line) => line.startsWith('Suite:'));
    const hasComponents = releaseLines.some((line) => line.startsWith('Components:'));

    return hasPackageEntries && hasOrigin && hasSuite && hasComponents;
  } catch {
    return false;
  }
}
