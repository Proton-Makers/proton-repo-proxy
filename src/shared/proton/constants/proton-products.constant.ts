/**
 * Proton products enum
 */
export enum ProtonProduct {
  MAIL = 'mail',
  PASS = 'pass',
}

/**
 * Array of all Proton products
 */
export const PROTON_PRODUCTS: readonly ProtonProduct[] = Object.values(ProtonProduct);
