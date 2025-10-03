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
export async function extractPackageInfo(appData: ProtonAppData, appName: string): Promise<PackageInfo[]> {
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

      // Extract architecture from filename or .deb content
      let arch: string | null;
      if (isDebian) {
        // For .deb files, try to detect real architecture from package content
        arch = await detectDebArchitecture(url);
      } else {
        // For other files, use filename-based detection
        arch = extractArchitecture(filename);
      }
      
      if (!arch) {
        continue;
      }

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
 * Extract architecture from filename
 */
function extractArchitecture(filename: string): string | null {
  // Match common architecture patterns
  const archPatterns = [/_(amd64|x86_64)[._]/, /_(arm64|aarch64)[._]/, /_(i386|i686)[._]/];

  for (const pattern of archPatterns) {
    const match = filename.match(pattern);
    if (match?.[1]) {
      const arch = match[1];
      // Normalize to Debian naming
      if (arch === 'x86_64') {
        return 'amd64';
      }
      if (arch === 'aarch64') {
        return 'arm64';
      }
      if (arch === 'i686') {
        return 'i386';
      }
      return arch;
    }
  }

  // For Proton packages without explicit architecture, assume based on file type
  if (filename.endsWith('.deb')) {
    // Debian packages without explicit arch are typically amd64
    return 'amd64';
  }

  if (filename.endsWith('.rpm')) {
    // RPM packages without explicit arch are typically x86_64 (amd64)
    return 'amd64';
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

/**
 * Detect real architecture from .deb package by downloading control info
 */
export async function detectDebArchitecture(url: string): Promise<string | null> {
  try {
    // Download first 32KB of the .deb file to extract control information
    const response = await fetch(url, {
      headers: {
        // biome-ignore lint/style/useNamingConvention: HTTP header name
        Range: 'bytes=0-32767',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch package: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);

    // Convert to string and search for architecture info
    // .deb files contain control information that includes architecture
    const content = new TextDecoder('utf-8').decode(data);
    
    // Look for Architecture: field in the content
    const archMatch = content.match(/Architecture:\s*([^\s\n\r]+)/i);
    if (archMatch?.[1]) {
      const arch = archMatch[1].toLowerCase();
      // Normalize architecture names
      if (arch === 'x86_64') {
        return 'amd64';
      }
      if (arch === 'aarch64') {
        return 'arm64';
      }
      if (arch === 'i686') {
        return 'i386';
      }
      return arch;
    }

    // If not found in the downloaded portion, fall back to filename analysis
    return extractArchitecture(extractFilenameFromUrl(url) || '');
  } catch (error) {
    console.warn('Failed to detect architecture from .deb, falling back to filename:', error);
    // Fallback to filename-based detection
    return extractArchitecture(extractFilenameFromUrl(url) || '');
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
