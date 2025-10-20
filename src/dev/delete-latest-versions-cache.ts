#!/usr/bin/env tsx
/**
 * Script to delete the LATEST_VERSIONS cache from Cloudflare KV
 * This is a one-time cleanup script
 * Usage: CLOUDFLARE_ACCOUNT_ID=xxx CLOUDFLARE_API_TOKEN=xxx tsx src/dev/delete-latest-versions-cache.ts
 */

import { getKVConfig } from '../shared/kv/config/kv-config.helper.js';

async function deleteLatestVersionsCache(): Promise<void> {
  console.log('🗑️  Deleting LATEST_VERSIONS cache from Cloudflare KV...');

  try {
    const { namespaceId } = getKVConfig();
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !apiToken) {
      console.error(
        '❌ Missing required environment variables: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN'
      );
      process.exit(1);
    }

    const key = 'latest-versions';
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${key}`;

    console.log(`🔗 Deleting key: ${key} from namespace: ${namespaceId}`);

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        // biome-ignore lint/style/useNamingConvention: Cloudflare API requires this exact header name
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (response.ok) {
      console.log('✅ LATEST_VERSIONS cache deleted successfully from Cloudflare KV');
    } else if (response.status === 404) {
      console.log("ℹ️  LATEST_VERSIONS cache was already deleted or doesn't exist");
    } else {
      const error = await response.text();
      console.error(`❌ Failed to delete cache: ${response.status} - ${error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Delete operation failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  deleteLatestVersionsCache();
}
