/**
 * Cloudflare Worker specific types
 */

// Cloudflare Workers global types
declare global {
  interface KVNamespace {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
    list(): Promise<{ keys: { name: string }[] }>;
  }
}

export interface Env {
  // KV namespace for repository cache
  // biome-ignore lint/style/useNamingConvention: Cloudflare Worker binding
  REPO_CACHE?: KVNamespace;

  // Environment variables
  // biome-ignore lint/style/useNamingConvention: Environment variable
  BASE_URL: string;

  // Optional secrets
  // biome-ignore lint/style/useNamingConvention: Environment variable
  GPG_PRIVATE_KEY?: string;
  // biome-ignore lint/style/useNamingConvention: Environment variable
  GPG_PASSPHRASE?: string;
}
