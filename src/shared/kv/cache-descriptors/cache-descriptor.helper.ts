import { PackageDescriptors } from '../../common';
import { KVCacheKey } from '../cache';
import type { KVConfig } from '../config';
import { getKvValue, setKvValue } from '../transfer/kv-transfer.helper';

/**
 * Download package descriptors cache from Cloudflare KV
 */
export async function downloadDescriptorsCache(
  namespaceId: KVConfig['namespaceId']
): Promise<PackageDescriptors | null> {
  console.log('📥 Downloading package descriptors cache from KV...');

  try {
    const cached = await getKvValue(namespaceId, KVCacheKey.PACKAGE_DESCRIPTORS);

    if (cached) {
      const parsed = JSON.parse(cached) as PackageDescriptors;
      const count = Object.keys(parsed).length;
      console.log(`  ✅ Found ${count} cached package descriptor(s)`);
      return parsed;
    }

    console.log('  ℹ️  No existing cache found');
    return null;
  } catch (error) {
    console.warn('  ⚠️  Could not read package descriptors cache:', error);
    return null;
  }
}

/**
 * Upload package descriptors cache to Cloudflare KV
 */
export async function uploadDescriptorsCache(
  namespaceId: KVConfig['namespaceId'],
  cache: PackageDescriptors
): Promise<void> {
  console.log('📤 Uploading package descriptors cache to KV...');

  try {
    await setKvValue(namespaceId, KVCacheKey.PACKAGE_DESCRIPTORS, JSON.stringify(cache, null, 2));
    const count = Object.keys(cache).length;
    console.log(`  ✅ Uploaded ${count} package descriptor(s) to KV`);
  } catch (error) {
    console.error('  ❌ Failed to upload package descriptors cache:', error);
    throw error;
  }
}
