/**
 * KV cache types
 */

/**
 * Cloudflare KV cache keys enumeration
 * Exhaustive list of all cache keys used in the application
 */
export enum KVCacheKey {
  /** Package descriptors cache for all downloaded packages */
  PACKAGE_DESCRIPTORS = 'package-descriptors',
  /** APT Release metadata */
  APT_RELEASE = 'apt-release',
  /** APT Packages list */
  APT_PACKAGES = 'apt-packages',
  /** APT architecture-specific Release metadata */
  APT_ARCH_RELEASE = 'apt-arch-release',
  /** APT InRelease (signed Release file, inline signature) */
  APT_INRELEASE = 'apt-inrelease',
  /** APT Release.gpg (detached signature) */
  APT_RELEASE_GPG = 'apt-release-gpg',
  /** Public GPG key for repository verification */
  APT_PUBLIC_KEY = 'apt-public-key',
}
