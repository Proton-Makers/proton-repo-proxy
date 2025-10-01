import { z } from 'zod';

/**
 * Proton version.json schema
 */
export const ProtonVersionSchema = z.object({
  Releases: z.array(
    z.object({
      Version: z.string(),
      File: z.array(
        z.object({
          Url: z.string(),
          Sha512CheckSum: z.string(),
          Args: z.string().optional(),
        })
      ),
      RolloutProportion: z.number().optional(),
    })
  ),
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
 */
export interface Env {
  KV: KVNamespace;
  BASE_URL: string;
  GPG_PRIVATE_KEY?: string;
  GPG_PASSPHRASE?: string;
}
