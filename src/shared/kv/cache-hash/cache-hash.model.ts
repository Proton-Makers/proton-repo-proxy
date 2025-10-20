import type z from 'zod';
import type { HashCacheSchema } from './cache-hash.schema';

/**
 * Hashes cache interface
 */
export type HashCache = z.infer<typeof HashCacheSchema>;

export type HashEntry = HashCache[keyof HashCache];
