import { ProtonProduct } from './proton-products.constant';

/**
 * Proton server used by the APT proxy.
 * Contains the trailing slash.
 */
export const PROTON_SERVER = 'https://proton.me/';

/**
 * Proton API endpoints.
 */
export const PROTON_APIS: Readonly<Record<ProtonProduct, string>> = <const>{
  [ProtonProduct.MAIL]: 'https://proton.me/download/mail/linux/version.json',
  [ProtonProduct.PASS]: 'https://proton.me/download/pass/linux/version.json',
};
