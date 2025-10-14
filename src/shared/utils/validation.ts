/**
 * Validation utilities using Zod schemas
 */

import { type ProtonApiResponse, ProtonApiResponseSchema } from '../types';

/**
 * Validate Proton API response
 */
export function validateProtonApiResponse(data: unknown): ProtonApiResponse {
  return ProtonApiResponseSchema.parse(data);
}
