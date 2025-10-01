import { type PackageInfo, type ProtonAppData, ProtonAppDataSchema } from '../types.js';

/**
 * Proton API endpoints for different applications
 */
const PROTON_ENDPOINTS = {
  mail: 'https://proton.me/download/mail/linux/version.json',
  pass: 'https://proton.me/download/pass/linux/version.json',
} as const;

/**
 * Fetch and validate Proton application data
 */
export async function fetchProtonData(app: keyof typeof PROTON_ENDPOINTS): Promise<ProtonAppData> {
  const url = PROTON_ENDPOINTS[app];

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'proton-repo-proxy/1.0.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${app} data: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Validate with Zod schema
  return ProtonAppDataSchema.parse(data);
}

/**
 * Extract package information from Proton data
 */
export function extractPackageInfo(appData: ProtonAppData, appName: string): PackageInfo[] {
  const packages: PackageInfo[] = [];

  for (const release of appData.Releases) {
    for (const file of release.File) {
      const url = file.Url;
      const filename = extractFilenameFromUrl(url);

      if (!filename) continue;

      const isDebian = filename.endsWith('.deb');
      const isRpm = filename.endsWith('.rpm');

      if (!isDebian && !isRpm) continue;

      // Extract architecture from filename
      const arch = extractArchitecture(filename);
      if (!arch) continue;

      // For size, we'll need to fetch it or estimate
      // For now, we'll use 0 and calculate it later in the metadata generation
      const packageInfo: PackageInfo = {
        name: `proton-${appName}`,
        version: release.Version,
        architecture: arch,
        filename,
        url,
        size: 0, // Will be fetched during metadata generation
        sha256: '', // Will be calculated if needed
        sha512: file.Sha512CheckSum,
        maintainer: 'Proton AG <opensource@proton.me>',
        description: `Proton ${appName.charAt(0).toUpperCase() + appName.slice(1)} - Secure and private email/password manager`,
        section: 'utils',
        priority: 'optional',
      };

      packages.push(packageInfo);
    }
  }

  return packages;
}

/**
 * Extract filename from URL
 */
function extractFilenameFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    const filename = pathname.split('/').pop();
    return filename || null;
  } catch {
    return null;
  }
}

/**
 * Extract architecture from filename
 */
function extractArchitecture(filename: string): string | null {
  // Match common architecture patterns
  const archPatterns = [/_(amd64|x86_64)[._]/, /_(arm64|aarch64)[._]/, /_(i386|i686)[._]/];

  for (const pattern of archPatterns) {
    const match = filename.match(pattern);
    if (match && match[1]) {
      const arch = match[1];
      // Normalize to Debian naming
      if (arch === 'x86_64') return 'amd64';
      if (arch === 'aarch64') return 'arm64';
      if (arch === 'i686') return 'i386';
      return arch;
    }
  }

  return null;
}

/**
 * Get file size from HTTP HEAD request
 */
export async function getFileSize(url: string): Promise<number> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentLength = response.headers.get('content-length');
    return contentLength ? Number.parseInt(contentLength, 10) : 0;
  } catch {
    return 0;
  }
}
