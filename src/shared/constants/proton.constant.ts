import { ProtonProducts } from '../types';

/**
 * Proton server used by the APT proxy.
 * Contains the trailing slash.
 */
export const PROTON_SERVER = 'https://proton.me/';

/**
 * Proton API endpoints.
 */
export const PROTON_APIS: Readonly<Record<ProtonProducts, string>> = <const>{
  [ProtonProducts.MAIL]: 'https://proton.me/download/mail/linux/version.json',
  [ProtonProducts.PASS]: 'https://proton.me/download/pass/linux/version.json',
};
