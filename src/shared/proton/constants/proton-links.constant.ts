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

/**
 * Ignored file URLs.
 * These files are excluded from hash calculations and cache checks.
 * They seems to be placeholder or beta files without stable content.
 */
export const PROTON_IGNORE_FILE_URLS: Readonly<string[]> = [
  'https://proton.me/download/mail/linux/ProtonMail-desktop-beta.deb',
  'https://proton.me/download/mail/linux/ProtonMail-desktop-beta.rpm',
];
