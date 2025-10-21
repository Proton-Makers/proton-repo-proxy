/** biome-ignore-all lint/style/useNamingConvention: Proton API properties */

import z from 'zod';
import { DateSchema, DateTimeSchema, Sha512Schema, VersionSchema } from '../../common';

// -- API Helpers --------------------------------------------------------------

export const ProtonCategorySchema = z.enum(['EarlyAccess', 'Alpha', 'Beta', 'Stable']);

export const PROTON_IDENTIFIER_PREFIX = <const>{
  DEB: '.deb',
  RPM: '.rpm',
};

// Flexible identifier schema: must start with .deb or .rpm
export const ProtonIdentifierSchema = z
  .string()
  .refine(
    (val) =>
      val.startsWith(PROTON_IDENTIFIER_PREFIX.DEB) || val.startsWith(PROTON_IDENTIFIER_PREFIX.RPM),
    {
      message: `Identifier must start with "${PROTON_IDENTIFIER_PREFIX.DEB}" or "${PROTON_IDENTIFIER_PREFIX.RPM}"`,
    }
  );

export const ProtonFileSchema = z.object({
  Identifier: ProtonIdentifierSchema,
  Url: z.url('Invalid URL format'),
  Sha512CheckSum: Sha512Schema,
  Args: z.string().optional(),
});

export const ProtonReleaseSchema = z.object({
  CategoryName: ProtonCategorySchema,
  Version: VersionSchema,
  ReleaseDate: z.union([DateSchema, DateTimeSchema]),
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
