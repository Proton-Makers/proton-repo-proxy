/**
 * Proton API types
 */

/** biome-ignore-all lint/style/useNamingConvention: Proton API properties */

import type z from 'zod';
import type {
  ProtonApiResponseSchema,
  ProtonCategorySchema,
  ProtonFileSchema,
  ProtonReleaseSchema,
} from './proton-api.schema';

// -- API Types ----------------------------------------------------------------

export type ProtonApiResponse = z.infer<typeof ProtonApiResponseSchema>;

export type ProtonRelease = z.infer<typeof ProtonReleaseSchema>;

export type ProtonCategoryEnum = z.infer<typeof ProtonCategorySchema>;

export type ProtonFile = z.infer<typeof ProtonFileSchema>;
