import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import type { PackageInfo, RpmMetadata } from '../types.js';

const gzipAsync = promisify(gzip);

/**
 * Generate RPM repository metadata
 */
export async function generateRpmMetadata(
  packages: PackageInfo[],
  baseUrl: string
): Promise<RpmMetadata> {
  // Filter only .rpm packages
  const rpmPackages = packages.filter((pkg) => pkg.filename.endsWith('.rpm'));

  // Generate metadata files
  const primary = generatePrimaryXml(rpmPackages, baseUrl);
  const filelists = generateFilelistsXml(rpmPackages);
  const other = generateOtherXml(rpmPackages);

  // Compress metadata files
  const primaryGz = await gzipAsync(Buffer.from(primary, 'utf-8'));
  const filelistsGz = await gzipAsync(Buffer.from(filelists, 'utf-8'));
  const otherGz = await gzipAsync(Buffer.from(other, 'utf-8'));

  // Generate repomd.xml
  const repomd = generateRepomdXml(primaryGz, filelistsGz, otherGz);

  return {
    repomd,
    primary,
    filelists,
    other,
    primaryGz,
    filelistsGz,
    otherGz,
  };
}

/**
 * Generate primary.xml content
 */
function generatePrimaryXml(packages: PackageInfo[], _baseUrl: string): string {
  const now = Math.floor(Date.now() / 1000);

  const packageEntries = packages
    .map((pkg) => {
      const checksum = pkg.sha256 || calculateSha256(pkg.url);

      return `
  <package type="rpm">
    <name>${pkg.name}</name>
    <arch>${pkg.architecture}</arch>
    <version epoch="0" ver="${pkg.version}" rel="1"/>
    <checksum type="sha256" pkgid="YES">${checksum}</checksum>
    <summary>${pkg.description}</summary>
    <description>${pkg.description}</description>
    <packager>${pkg.maintainer}</packager>
    <url>https://proton.me/</url>
    <time file="${now}" build="${now}"/>
    <size package="${pkg.size}" installed="0" archive="0"/>
    <location href="rpms/${pkg.filename}"/>
    <format>
      <rpm:license>Proprietary</rpm:license>
      <rpm:vendor>Proton AG</rpm:vendor>
      <rpm:group>Applications/Internet</rpm:group>
      <rpm:buildhost>proton.me</rpm:buildhost>
      <rpm:sourcerpm>${pkg.name}-${pkg.version}-1.src.rpm</rpm:sourcerpm>
      <rpm:header-range start="0" end="0"/>
      <rpm:provides>
        <rpm:entry name="${pkg.name}" flags="EQ" epoch="0" ver="${pkg.version}" rel="1"/>
      </rpm:provides>
    </format>
  </package>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<metadata xmlns="http://linux.duke.edu/metadata/common" xmlns:rpm="http://linux.duke.edu/metadata/rpm" packages="${packages.length}">
${packageEntries}
</metadata>`;
}

/**
 * Generate filelists.xml content
 */
function generateFilelistsXml(packages: PackageInfo[]): string {
  const packageEntries = packages
    .map((pkg) => {
      const checksum = pkg.sha256 || calculateSha256(pkg.url);

      return `
  <package pkgid="${checksum}" name="${pkg.name}" arch="${pkg.architecture}">
    <version epoch="0" ver="${pkg.version}" rel="1"/>
    <file>/usr/bin/${pkg.name}</file>
    <file>/usr/share/applications/${pkg.name}.desktop</file>
  </package>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<filelists xmlns="http://linux.duke.edu/metadata/filelists" packages="${packages.length}">
${packageEntries}
</filelists>`;
}

/**
 * Generate other.xml content
 */
function generateOtherXml(packages: PackageInfo[]): string {
  const packageEntries = packages
    .map((pkg) => {
      const checksum = pkg.sha256 || calculateSha256(pkg.url);

      return `
  <package pkgid="${checksum}" name="${pkg.name}" arch="${pkg.architecture}">
    <version epoch="0" ver="${pkg.version}" rel="1"/>
  </package>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<otherdata xmlns="http://linux.duke.edu/metadata/other" packages="${packages.length}">
${packageEntries}
</otherdata>`;
}

/**
 * Generate repomd.xml content
 */
function generateRepomdXml(
  primaryGz: Uint8Array,
  filelistsGz: Uint8Array,
  otherGz: Uint8Array
): string {
  const now = Math.floor(Date.now() / 1000);

  const primaryChecksum = createHash('sha256').update(primaryGz).digest('hex');
  const filelistsChecksum = createHash('sha256').update(filelistsGz).digest('hex');
  const otherChecksum = createHash('sha256').update(otherGz).digest('hex');

  return `<?xml version="1.0" encoding="UTF-8"?>
<repomd xmlns="http://linux.duke.edu/metadata/repo" xmlns:rpm="http://linux.duke.edu/metadata/rpm">
  <revision>${now}</revision>
  <data type="primary">
    <checksum type="sha256">${primaryChecksum}</checksum>
    <size>${primaryGz.length}</size>
    <location href="repodata/primary.xml.gz"/>
    <timestamp>${now}</timestamp>
  </data>
  <data type="filelists">
    <checksum type="sha256">${filelistsChecksum}</checksum>
    <size>${filelistsGz.length}</size>
    <location href="repodata/filelists.xml.gz"/>
    <timestamp>${now}</timestamp>
  </data>
  <data type="other">
    <checksum type="sha256">${otherChecksum}</checksum>
    <size>${otherGz.length}</size>
    <location href="repodata/other.xml.gz"/>
    <timestamp>${now}</timestamp>
  </data>
</repomd>`;
}

/**
 * Calculate SHA256 hash (placeholder - will be improved)
 */
function calculateSha256(url: string): string {
  // For now, return a placeholder based on URL
  // In practice, this should fetch the file and calculate the hash
  return createHash('sha256').update(url).digest('hex');
}

/**
 * Validate RPM metadata structure
 */
export function validateRpmMetadata(metadata: RpmMetadata): boolean {
  try {
    // Basic validation
    if (!metadata.repomd || !metadata.primary || !metadata.filelists || !metadata.other) {
      return false;
    }

    // Check if repomd contains required data elements
    const hasRepomdStructure =
      metadata.repomd.includes('<data type="primary">') &&
      metadata.repomd.includes('<data type="filelists">') &&
      metadata.repomd.includes('<data type="other">');

    // Check if primary contains package entries
    const hasPrimaryPackages = metadata.primary.includes('<package type="rpm">');

    return hasRepomdStructure && hasPrimaryPackages;
  } catch {
    return false;
  }
}
