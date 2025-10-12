import { z } from 'zod';

/**
 * Proton version.json schema
 * Note: Property names match Proton API response format
 */
export const ProtonVersionSchema = z.object({
  // biome-ignore lint/style/useNamingConvention: External API property
  Releases: z.array(
    z.object({
      // biome-ignore lint/style/useNamingConvention: External API property
      Version: z.string(),
      // biome-ignore lint/style/useNamingConvention: External API property
      File: z.array(
        z.object({
          // biome-ignore lint/style/useNamingConvention: External API property
          Url: z.string(),
          // biome-ignore lint/style/useNamingConvention: External API property
          Sha512CheckSum: z.string(),
          // biome-ignore lint/style/useNamingConvention: External API property
          Args: z.string().optional(),
        })
      ),
      // biome-ignore lint/style/useNamingConvention: External API property
      RolloutProportion: z.number().optional(),
    })
  ),
  // biome-ignore lint/style/useNamingConvention: External API property
  Dependencies: z.array(z.string()).optional(),
});

// Alias pour compatibilité
export const ProtonAppDataSchema = ProtonVersionSchema;

export type ProtonAppData = z.infer<typeof ProtonVersionSchema>;

/**
 * Package information
 */
export interface PackageInfo {
  name: string;
  version: string;
  filename: string;
  url: string;
  size: number;
  sha256?: string;
  sha512?: string;
  architecture: string;
  description: string;
  maintainer: string;
  section?: string;
  priority?: string;
}

/**
 * APT repository metadata
 */
export interface AptMetadata {
  packages: string;
  packagesGz: Uint8Array;
  release: string;
  inRelease?: string;
}

/**
 * RPM repository metadata
 */
export interface RpmMetadata {
  repomd: string;
  primary: string;
  filelists: string;
  other: string;
  primaryGz: Uint8Array;
  filelistsGz: Uint8Array;
  otherGz: Uint8Array;
}

/**
 * Cloudflare Workers environment bindings
 * Note: Property names match Cloudflare Workers conventions
 */
export interface Env {
  // biome-ignore lint/style/useNamingConvention: Cloudflare Workers binding
  REPO_CACHE?: KVNamespace;
  // biome-ignore lint/style/useNamingConvention: Environment variable
  BASE_URL: string;
  // biome-ignore lint/style/useNamingConvention: Environment variable
  GPG_PRIVATE_KEY?: string;
  // biome-ignore lint/style/useNamingConvention: Environment variable
  GPG_PASSPHRASE?: string;
}
