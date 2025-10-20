import z from 'zod';
import { Sha256Schema, Sha512Schema } from '../../common';


/**
 * Complete hash cache schema
 * Key format: URL (validated as proper URL format)
 */
export const HashCacheSchema = z.record(
  z.url(),
  z.object({
    sha256: Sha256Schema,
    sha512: Sha512Schema,
    size: z.number().int().positive(),
    lastVerified: z.string().optional(), // ISO date string when hash was last verified
  })
);
