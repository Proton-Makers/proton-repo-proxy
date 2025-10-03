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

      // Use data provided by Proton API (no additional HTTP calls needed)
      const packageInfo: PackageInfo = {
        name: `proton-${appName}`,
        version: release.Version,
        architecture: arch,
        filename,
        url,
        size: 0, // APT doesn't require size, will be fetched when needed
        sha256: '', // Use SHA512 from Proton, convert to SHA256 if needed by APT client
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
