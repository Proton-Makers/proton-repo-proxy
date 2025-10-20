import { PROTON_APIS, type ProtonProduct } from '../constants';
import type { ProtonApiResponse } from './proton-api.model';
import { ProtonApiResponseSchema } from './proton-api.schema';

// -- API fetcher --------------------------------------------------------------

/**
 * 
 * Fetch Proton product API response
 * Not validating the response here.
 * No response body parsing.
 * No error handling.
 * @param product 
 * @returns 
 */
export async function fetchProtonProductAPIResponse(product: ProtonProduct): Promise<Response> {
  // Product
  const url = PROTON_APIS[product];

  // Download
  console.log(`📥 Downloading ${product} API response from ${url}`);
  const response = await fetch(url);

  return response;
}

/**
 * Fetch releases for a specific product
 */
export async function fetchProtonProductAPI(product: ProtonProduct): Promise<ProtonApiResponse> {
  const response = await fetchProtonProductAPIResponse(product);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${product} releases: ${response.status}`);
  }

  const data = await response.json();
  return validateProtonApiResponse(data);
}


// -- Model validation ---------------------------------------------------------

/**
 * Validate Proton API response
 */
export function validateProtonApiResponse(data: unknown): ProtonApiResponse {
  return ProtonApiResponseSchema.parse(data);
}
