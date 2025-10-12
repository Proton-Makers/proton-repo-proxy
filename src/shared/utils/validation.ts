/**
 * Validation utilities using Zod schemas
 */

import { z } from 'zod';
import type { ProtonApiResponse } from '../types/common.js';

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
          Identifier: z.string(),
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

/**
 * Validate Proton API response
 */
export function validateProtonApiResponse(data: unknown): ProtonApiResponse {
  return ProtonVersionSchema.parse(data);
}

/**
 * Package hash validation schema
 */
export const PackageHashSchema = z.object({
  filename: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid SHA256 hash'),
  size: z.number().min(0),
  version: z.string(),
  url: z.string().url(),
  sha512: z.string().regex(/^[a-f0-9]{128}$/i, 'Invalid SHA512 hash'),
});

/**
 * Validate package hash data
 */
export function validatePackageHash(data: unknown) {
  return PackageHashSchema.parse(data);
}
