/**
 * Proton API utilities shared between Worker and scripts
 */

import type { ProtonApiResponse } from '../types/common.js';

/**
 * Fetch Proton version data from API
 */
export async function fetchProtonVersions(): Promise<ProtonApiResponse> {
  const response = await fetch('https://proton.me/download/mail/linux/version.json');

  if (!response.ok) {
    throw new Error(`Failed to fetch Proton versions: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ProtonApiResponse;

  if (!data.Releases || data.Releases.length === 0) {
    throw new Error('No releases found in Proton API response');
  }

  return data;
}

/**
 * Get the latest Proton Mail release
 */
export async function getLatestProtonRelease() {
  const data = await fetchProtonVersions();
  return data.Releases[0];
}

/**
 * Get download URL for a specific file type
 */
export function getDownloadUrl(
  release: ProtonApiResponse['Releases'][0],
  fileType: '.deb'
): string | null {
  const file = release.File.find((f) => f.Url.endsWith(fileType));
  return file?.Url || null;
}

/**
 * Extract filename from URL
 */
export function extractFilename(url: string): string {
  return url.split('/').pop() || 'unknown-file';
}
