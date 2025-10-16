/**
 * Common types shared between Worker and scripts
 */

import z from 'zod';

/**
 * Package hash validation schema
 */
export const PackageHashSchema = z.object({
  filename: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, 'Invalid SHA256 hash'),
  size: z.number().min(0),
  version: z.string(),
  url: z.url(),
  sha512: z.string().regex(/^[a-f0-9]{128}$/i, 'Invalid SHA512 hash'),
  product: z.enum(['mail', 'pass']), // Multi-product support
});

/**
 * Package hash type
 */
export type PackageHash = z.infer<typeof PackageHashSchema>;
