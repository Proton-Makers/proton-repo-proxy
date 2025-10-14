/**
 * Proton API types
 */

/** biome-ignore-all lint/style/useNamingConvention: Proton API properties */

import z from 'zod';

/**
 * Proton API response schema
 * Note: Property names match Proton API response format
 */
export const ProtonApiResponseSchema = z.object({
  Releases: z.array(
    z.object({
      Version: z.string(),
      File: z.array(
        z.object({
          Identifier: z.string(),
          Url: z.string(),
          Sha512CheckSum: z.string(),
          Args: z.string().optional(),
        })
      ),
      RolloutProportion: z.number().optional(),
    })
  ),
  Dependencies: z.array(z.string()).optional(),
});

/**
 * Proton API response type
 */
export type ProtonApiResponse = z.infer<typeof ProtonApiResponseSchema>;

// Proton API types - using PascalCase as defined by external API
export interface ProtonFile {
  Identifier: string;
  Url: string;
  Sha512CheckSum: string;
}

export interface ProtonRelease {
  Version: string;
  File: ProtonFile[];
}
