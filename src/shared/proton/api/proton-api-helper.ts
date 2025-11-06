import { PROTON_APIS, type ProtonProduct } from '../constants';
import type { ProtonApiResponse } from './proton-api.model';
import { ProtonApiResponseSchema } from './proton-api.schema';

// -- API fetcher --------------------------------------------------------------

/**
 * Custom error class for Proton API operations
 */
export class ProtonApiError extends Error {
  constructor(
    message: string,
    public readonly product: ProtonProduct,
    public readonly status?: number,
    public readonly url?: string
  ) {
    super(message);
    this.name = 'ProtonApiError';
  }
  override toString() {
    return `[${this.product}]${this.status ? ` (Status: ${this.status})` : ''} ${this.message}`;
  }
}

/**
 * Fetch releases for a specific product
 *
 * @param product Proton product
 * @returns Proton API response
 * @throws ProtonApiError if the fetch fails
 */
export async function fetchProtonProductAPI(product: ProtonProduct): Promise<ProtonApiResponse> {
  // Product
  const url = PROTON_APIS[product];

  try {
    // Download
    console.log(`📥 Downloading ${product} API response from ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new ProtonApiError(
        `Failed to fetch ${product} releases: ${response.status}`,
        product,
        response.status,
        url
      );
    }

    // Get JSON version
    const data = await response.json();

    // Validate Proton API response
    return ProtonApiResponseSchema.parse(data);
  } catch (error) {
    if (error instanceof ProtonApiError) {
      throw error;
    }

    // Handle other errors (network, parsing, etc.)
    throw new ProtonApiError(
      `Failed to fetch ${product} releases: ${error instanceof Error ? error.message : 'Unknown error'}`,
      product,
      undefined,
      url
    );
  }
}
