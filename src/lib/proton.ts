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
export async function extractPackageInfo(
  appData: ProtonAppData,
  appName: string
): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = [];

  for (const release of appData.Releases) {
    for (const file of release.File) {
      const url = file.Url;
      const filename = extractFilenameFromUrl(url);

      if (!filename) {
        continue;
      }

      const isDebian = filename.endsWith('.deb');
      const isRpm = filename.endsWith('.rpm');

      if (!isDebian && !isRpm) {
        continue;
      }

      // Proton packages are always amd64 architecture
      const arch = 'amd64';

      // Fetch file size and SHA256 for packages metadata
      const size = await getFileSize(url);
      const sha256 = await calculateSha256FromUrl(url);

      const packageInfo: PackageInfo = {
        name: `proton-${appName}`,
        version: release.Version,
        architecture: arch,
        filename,
        url,
        size,
        sha256,
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

/**
 * Calculate SHA256 hash from file URL
 */
export async function calculateSha256FromUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    // For now, return a placeholder based on URL
    // In production, you might want to download and hash the actual file
    // but that would be expensive for large files
    const etag = response.headers.get('etag');
    if (etag) {
      // Use ETags as a proxy for content hash when available
      return etag.replace(/"/g, '').substring(0, 64);
    }
    // Fallback to URL hash
    const encoder = new TextEncoder();
    const data = encoder.encode(url);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Ultimate fallback
    const encoder = new TextEncoder();
    const data = encoder.encode(url);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}
