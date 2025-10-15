/**
 * KV cache types
 */

/**
 * Cloudflare KV cache keys enumeration
 * Exhaustive list of all cache keys used in the application
 */
export enum KVCacheKey {
  /** Version cache for latest Proton Mail and Pass versions */
  LATEST_VERSIONS = 'latest-versions',
  /** Package hashes cache for all downloaded packages */
  PACKAGE_HASHES = 'package-hashes-cache',
  /** APT Release metadata */
  APT_RELEASE = 'apt-release',
  /** APT Packages list */
  APT_PACKAGES = 'apt-packages',
  /** APT architecture-specific Release metadata */
  APT_ARCH_RELEASE = 'apt-arch-release',
}
