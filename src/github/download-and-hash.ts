#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import * as https from 'node:https';
import type { DownloadResult, PackageHash } from '../shared/types/common.js';
import { extractFilename, fetchProtonVersions } from '../shared/utils/proton.js';

async function downloadAndHash(url: string, filename: string): Promise<DownloadResult> {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading ${filename} from ${url}`);
    const file = createWriteStream(filename);
    const hash = createHash('sha256');

    https
      .get(url, (response) => {
        let totalSize = 0;
        const fileSize = Number.parseInt(response.headers['content-length'] || '0', 10);

        response.on('data', (chunk) => {
          totalSize += chunk.length;
          const progress = ((totalSize / fileSize) * 100).toFixed(1);
          process.stdout.write(`\rProgress: ${progress}%`);

          file.write(chunk);
          hash.update(chunk);
        });

        response.on('end', () => {
          file.end();
          const sha256 = hash.digest('hex');
          console.log(`\n✅ SHA256 for ${filename}: ${sha256}`);
          resolve({ filename, sha256, size: totalSize });
        });
      })
      .on('error', reject);
  });
}

async function main(): Promise<void> {
  console.log('🔍 Fetching Proton Mail versions...');

  // Fetch Proton data using utility function
  const data = await fetchProtonVersions();
  const results: PackageHash[] = [];

  // Process only the latest version
  const latestRelease = data.Releases[0];
  if (!latestRelease) {
    throw new Error('No releases found in Proton API response');
  }

  console.log(`📦 Processing version ${latestRelease.Version}`);

  for (const file of latestRelease.File) {
    if (file.Url.endsWith('.deb')) {
      const filename = extractFilename(file.Url);

      const result = await downloadAndHash(file.Url, filename);
      results.push({
        ...result,
        version: latestRelease.Version,
        url: file.Url,
        sha512: file.Sha512CheckSum,
      });
    }
  }

  // Save results
  await writeFile('package-hashes.json', JSON.stringify(results, null, 2));
  console.log('💾 Results saved to package-hashes.json');
}

main().catch(console.error);
