#!/usr/bin/env node

import { createHash } from 'crypto';
import { createWriteStream } from 'fs';
import { writeFile } from 'fs/promises';
import https from 'https';

async function downloadAndHash(url, filename) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading ${filename} from ${url}`);
    const file = createWriteStream(filename);
    const hash = createHash('sha256');

    https
      .get(url, (response) => {
        let totalSize = 0;
        const fileSize = Number.parseInt(response.headers['content-length'] || '0');

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

async function main() {
  console.log('🔍 Fetching Proton Mail versions...');

  // Fetch Proton data
  const response = await fetch('https://proton.me/download/mail/linux/version.json');
  const data = await response.json();

  const results = [];

  // Traiter seulement la version la plus récente
  const latestRelease = data.Releases[0];
  console.log(`📦 Processing version ${latestRelease.Version}`);

  for (const file of latestRelease.File) {
    if (file.Url.endsWith('.deb')) {
      const filename = file.Url.split('/').pop();
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
