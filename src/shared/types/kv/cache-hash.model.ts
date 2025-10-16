
/**
 * Hashes cache interface
 */
export interface HashCache {
  [url: string]: {
    sha256: string;
    sha512: string;
    size: number;
    lastVerified: string;
  };
}
