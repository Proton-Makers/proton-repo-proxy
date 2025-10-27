import z from 'zod';

/**
 * Complete hash cache schema
 * Key format: URL (validated as proper URL format)
 */
export const HashCacheSchema = z.record(
  z.url(),
  z.object({
    md5: z.hash('md5'),
    sha256: z.hash('sha256'),
    sha512: z.hash('sha512'),
    size: z.number().int().positive(),
    lastVerified: z.string().optional(), // ISO date string when hash was last verified
  })
);
