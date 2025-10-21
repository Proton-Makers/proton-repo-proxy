#!/usr/bin/env tsx
/**
 * Upload metadata to Cloudflare KV
 * Usage: npx tsx src/github/upload-to-kv.ts <version> <packages-dir>
 */

import { existsSync } from 'node:fs';
import { execWrangler } from './kv-cmd.internal';

/**
 * Upload file to KV
 */
export async function uploadKvFile(
  namespaceId: string,
  key: string,
  filePath: string
): Promise<void> {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const args = [
    'kv',
    'key',
    'put',
    `--namespace-id="${namespaceId}"`,
    '--remote',
    `"${key}"`,
    `--path="${filePath}"`,
  ];

  execWrangler(args);
  console.log(`✅ Uploaded ${key} from ${filePath}`);
}

/**
 * Set KV value
 */
export async function setKvValue(namespaceId: string, key: string, value: string): Promise<void> {
  // Escape the value properly for shell
  const escapedValue = value.replace(/"/g, '\\"');

  const args = [
    'kv',
    'key',
    'put',
    `--namespace-id="${namespaceId}"`,
    '--remote',
    `"${key}"`,
    `"${escapedValue}"`,
  ];

  execWrangler(args);

  // Limit console output to avoid flooding with large values
  const displayValue =
    value.length > 100 ? `${value.slice(0, 100)}... (${value.length} chars)` : value;
  console.log(`✅ Set ${key} = ${displayValue}`);
}

/**
 * Get KV value
 */
export async function getKvValue(namespaceId: string, key: string): Promise<string | null> {
  try {
    const args = ['kv', 'key', 'get', `--namespace-id="${namespaceId}"`, '--remote', `"${key}"`];

    const result = execWrangler(args).trim();
    return result || null;
  } catch (error) {
    // Check if it's a 404 (key not found) vs other errors
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
      return null; // Key doesn't exist, this is expected
    }
    // For other errors, re-throw so the caller knows something went wrong
    throw error;
  }
}
