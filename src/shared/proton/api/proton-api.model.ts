/**
 * Proton API types
 */

/** biome-ignore-all lint/style/useNamingConvention: Proton API properties */

import type z from 'zod';
import {
  type ProtonApiResponseSchema,
  type ProtonCategorySchema,
  type ProtonFileSchema,
  ProtonIdentifierDeb,
  ProtonIdentifierRpm,
  type ProtonIdentifierSchema,
  type ProtonReleaseSchema,
} from './proton-api.schema';

// -- API Types ----------------------------------------------------------------

export type ProtonApiResponse = z.infer<typeof ProtonApiResponseSchema>;

export type ProtonRelease = z.infer<typeof ProtonReleaseSchema>;

export type ProtonCategoryEnum = z.infer<typeof ProtonCategorySchema>;

export type ProtonIdentifierEnum = z.infer<typeof ProtonIdentifierSchema>;

export type ProtonFile = z.infer<typeof ProtonFileSchema>;

// -- API Constant Exports -----------------------------------------------------

export const PROTON_IDENTIFIER_DEB = ProtonIdentifierDeb;
export const PROTON_IDENTIFIER_RPM = ProtonIdentifierRpm;
