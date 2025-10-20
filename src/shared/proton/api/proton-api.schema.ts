/** biome-ignore-all lint/style/useNamingConvention: Proton API properties */

import z from 'zod';
import { DateSchema, Sha512Schema, VersionSchema } from '../../common';

// -- API Helpers --------------------------------------------------------------

export const ProtonCategorySchema = z.enum(['EarlyAccess', 'Alpha', 'Beta', 'Stable']);

export const ProtonFileSchema = z.object({
  Identifier: z.string().min(1, 'Identifier cannot be empty'),
  Url: z.url('Invalid URL format'),
  Sha512CheckSum: Sha512Schema,
  Args: z.string().optional(),
});

export const ProtonReleaseSchema = z.object({
  CategoryName: ProtonCategorySchema,
  Version: VersionSchema,
  ReleaseDate: DateSchema,
  RolloutPercentage: z.number().min(0).max(1).optional(), // format: 0-1 (e.g., 0.5 = 50%)
  File: z.array(ProtonFileSchema),
  ReleaseNotes: z.array(z.string()).optional(),
  RolloutProportion: z.number().optional(),
});

// -- API Response Schema ------------------------------------------------------

/**
 * Proton API response schema
 * Note: Property names match Proton API response format
 */
export const ProtonApiResponseSchema = z.object({
  Releases: z.array(ProtonReleaseSchema).min(1, 'At least one release must be present'),
  Dependencies: z.array(z.string()).optional(),
});
