import { KVCacheKey } from '../cache';
import type { KVConfig } from '../config';
import { getKvValue, setKvValue } from '../transfer/kv-transfer.helper';
import type { HashCache } from './cache-hash.model';

/**
 * Download hash cache from Cloudflare KV
 */
export async function downloadHashCache(
  namespaceId: KVConfig['namespaceId']
): Promise<HashCache | null> {
  console.log('📥 Downloading hash cache from KV...');

  try {
    const cached = await getKvValue(namespaceId, KVCacheKey.PACKAGE_HASHES);

    if (cached) {
      const parsed = JSON.parse(cached) as HashCache;
      const count = Object.keys(parsed).length;
      console.log(`  ✅ Found ${count} cached hash(es)`);
      return parsed;
    }

    console.log('  ℹ️  No existing cache found');
    return null;
  } catch (error) {
    console.warn('  ⚠️  Could not read hash cache:', error);
    return null;
  }
}

/**
 * Upload hash cache to Cloudflare KV
 */
export async function uploadHashCache(
  namespaceId: KVConfig['namespaceId'],
  cache: HashCache
): Promise<void> {
  console.log('📤 Uploading hash cache to KV...');

  try {
    await setKvValue(namespaceId, KVCacheKey.PACKAGE_HASHES, JSON.stringify(cache, null, 2));
    const count = Object.keys(cache).length;
    console.log(`  ✅ Uploaded ${count} hash(es) to KV`);
  } catch (error) {
    console.error('  ❌ Failed to upload hash cache:', error);
    throw error;
  }
}
