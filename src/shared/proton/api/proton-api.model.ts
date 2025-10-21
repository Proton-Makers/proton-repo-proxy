/**
 * Proton API types
 */

/** biome-ignore-all lint/style/useNamingConvention: Proton API properties */

import type z from 'zod';
import type {
  PROTON_IDENTIFIER_PREFIX,
  ProtonApiResponseSchema,
  ProtonCategorySchema,
  ProtonFileSchema,
  ProtonReleaseSchema,
} from './proton-api.schema';

// -- API Types ----------------------------------------------------------------

export type ProtonApiResponse = z.infer<typeof ProtonApiResponseSchema>;

export type ProtonRelease = z.infer<typeof ProtonReleaseSchema>;

export type ProtonCategoryEnum = z.infer<typeof ProtonCategorySchema>;

/**
 * Proton identifier prefix enum
 * Sample values: '.deb', '.rpm'
 */
export type ProtonIdentifierPrefixEnum =
  (typeof PROTON_IDENTIFIER_PREFIX)[keyof typeof PROTON_IDENTIFIER_PREFIX];

export type ProtonFile = z.infer<typeof ProtonFileSchema>;
