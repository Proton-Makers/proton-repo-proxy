import { ProtonProduct } from "../proton"

/**
 * Cache key where to store files.
 */
export const GITHUB_CACHE_KEY = {
  /**
   * Cache for origin files.
   */
  SOURCE: "SOURCE",
}

export const GITHUB_CACHE_FILE = {
  PROTON: <Record<ProtonProduct, string>>{
    [ProtonProduct.MAIL]: "proton-mail.json",
    [ProtonProduct.PASS]: "proton-pass.json",
  }
}
