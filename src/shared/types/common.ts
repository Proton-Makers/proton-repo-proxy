/**
 * Common types shared between Worker and scripts
 */

export interface PackageHash {
  filename: string;
  sha256: string;
  size: number;
  version: string;
  url: string;
  sha512: string;
}

// Proton API types - using PascalCase as defined by external API
export interface ProtonFile {
  // biome-ignore lint/style/useNamingConvention: External API property
  Identifier: string;
  // biome-ignore lint/style/useNamingConvention: External API property
  Url: string;
  // biome-ignore lint/style/useNamingConvention: External API property
  Sha512CheckSum: string;
}

export interface ProtonRelease {
  // biome-ignore lint/style/useNamingConvention: External API property
  Version: string;
  // biome-ignore lint/style/useNamingConvention: External API property
  File: ProtonFile[];
}

export interface ProtonApiResponse {
  // biome-ignore lint/style/useNamingConvention: External API property
  Releases: ProtonRelease[];
}

export interface DownloadResult {
  filename: string;
  sha256: string;
  size: number;
}
