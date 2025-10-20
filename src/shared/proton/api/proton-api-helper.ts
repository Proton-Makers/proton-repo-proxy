import type { ProtonApiResponse } from './proton-api.model';
import { ProtonApiResponseSchema } from './proton-api.schema';

/**
 * Validate Proton API response
 */
export function validateProtonApiResponse(data: unknown): ProtonApiResponse {
  return ProtonApiResponseSchema.parse(data);
}
