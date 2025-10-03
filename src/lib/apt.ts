import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import type { AptMetadata, PackageInfo } from '../types.js';

const gzipAsync = promisify(gzip);

/**
 * Generate APT repository metadata
 */
export async function generateAptMetadata(
  packages: PackageInfo[],
  baseUrl: string,
  architecture?: string
): Promise<AptMetadata> {
  // Filter only .deb packages
  const debPackages = packages.filter((pkg) => pkg.filename.endsWith('.deb'));

  // Generate Packages file
  const packagesContent = generatePackagesFile(debPackages, baseUrl);

  // Compress Packages file
  const packagesGz = await gzipAsync(Buffer.from(packagesContent, 'utf-8'));

  // Generate Release file
  const releaseContent = generateReleaseFile(packagesContent, packagesGz, architecture);

  return {
    packages: packagesContent,
    packagesGz,
    release: releaseContent,
    inRelease: '', // Will be generated during signing
  };
}

/**
 * Generate APT Release file for amd64 architecture only
 */
export async function generateCompleteAptRelease(
  packages: PackageInfo[],
  baseUrl: string
): Promise<string> {
  const debPackages = packages.filter((pkg) => pkg.filename.endsWith('.deb'));

  // Generate metadata for amd64 only (Proton packages are amd64 only)
  const packagesContent = generatePackagesFile(debPackages, baseUrl);
  const packagesGz = await gzipAsync(Buffer.from(packagesContent, 'utf-8'));

  return generateSimpleReleaseFile(packagesContent, packagesGz);
}

/**
 * Generate APT Packages file content
 */
function generatePackagesFile(packages: PackageInfo[], _baseUrl: string): string {
  const entries: string[] = [];

  for (const pkg of packages) {
    // Use placeholder SHA256 since [trusted=yes] repositories don't strictly enforce it
    const sha256 = pkg.sha256 || 'a'.repeat(64);

    const entryLines = [
      `Package: ${pkg.name}`,
      `Version: ${pkg.version}`,
      `Architecture: ${pkg.architecture}`,
      `Maintainer: ${pkg.maintainer}`,
      `Filename: pool/main/${pkg.name}/${pkg.filename}`,
    ];

    // Only include Size if we have it (non-zero)
    if (pkg.size > 0) {
      entryLines.push(`Size: ${pkg.size}`);
    }

    entryLines.push(
      `SHA256: ${sha256}`,
      `Section: ${pkg.section || 'utils'}`,
      `Priority: ${pkg.priority || 'optional'}`,
      'Homepage: https://proton.me/',
      `Description: ${pkg.description}`,
      ''
    );

    entries.push(entryLines.join('\n'));
  }

  return entries.join('\n');
}

/**
 * Generate APT Release file content
 */
function generateReleaseFile(
  packagesContent: string,
  packagesGz: Uint8Array,
  architecture = 'amd64'
): string {
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
    'Architectures: amd64',
    `Date: ${date}`,
    'Description: Proxy repository for Proton applications',
    '',
    'MD5Sum:',
    ` ${packagesMd5}  ${packagesSize} main/binary-${architecture}/Packages`,
    ` ${packagesGzMd5}  ${packagesGzSize} main/binary-${architecture}/Packages.gz`,
    '',
    'SHA1:',
    ` ${packagesSha1}  ${packagesSize} main/binary-${architecture}/Packages`,
    ` ${packagesGzSha1}  ${packagesGzSize} main/binary-${architecture}/Packages.gz`,
    '',
    'SHA256:',
    ` ${packagesSha256}  ${packagesSize} main/binary-${architecture}/Packages`,
    ` ${packagesGzSha256}  ${packagesGzSize} main/binary-${architecture}/Packages.gz`,
    '',
  ].join('\n');
}

/**
 * Generate simple Release file for amd64 architecture only
 */
function generateSimpleReleaseFile(packages: string, packagesGz: Uint8Array): string {
  const now = new Date();
  const date = now.toUTCString();

  const packagesSize = Buffer.byteLength(packages, 'utf-8');
  const packagesGzSize = packagesGz.length;

  const packagesMd5 = createHash('md5').update(packages).digest('hex');
  const packagesSha1 = createHash('sha1').update(packages).digest('hex');
  const packagesSha256 = createHash('sha256').update(packages).digest('hex');

  const packagesGzMd5 = createHash('md5').update(packagesGz).digest('hex');
  const packagesGzSha1 = createHash('sha1').update(packagesGz).digest('hex');
  const packagesGzSha256 = createHash('sha256').update(packagesGz).digest('hex');

  return [
    'Origin: Proton Repository Proxy',
    'Label: Proton Apps',
    'Suite: stable',
    'Codename: stable',
    'Components: main',
    'Architectures: amd64',
    `Date: ${date}`,
    'Description: Proxy repository for Proton applications',
    '',
    'MD5Sum:',
    ` ${packagesMd5}  ${packagesSize} main/binary-amd64/Packages`,
    ` ${packagesGzMd5}  ${packagesGzSize} main/binary-amd64/Packages.gz`,
    '',
    'SHA1:',
    ` ${packagesSha1}  ${packagesSize} main/binary-amd64/Packages`,
    ` ${packagesGzSha1}  ${packagesGzSize} main/binary-amd64/Packages.gz`,
    '',
    'SHA256:',
    ` ${packagesSha256}  ${packagesSize} main/binary-amd64/Packages`,
    ` ${packagesGzSha256}  ${packagesGzSize} main/binary-amd64/Packages.gz`,
    '',
  ].join('\n');
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
