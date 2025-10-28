#!/usr/bin/env tsx

/**
 * Development script to verify cache consistency
 * Usage: npm run dev:verify-cache
 */

import { downloadDescriptorsCache, KVCacheKey } from '../shared';
import { getKVConfig } from '../shared/kv/config/kv-config.helper.js';
import { getKvValue } from '../shared/kv/transfer/kv-transfer.helper.js';

/**
 * Parse APT Packages file to extract versions
 */
function parseAptPackagesVersions(packagesContent: string): {
  mail: string | null;
  pass: string | null;
} {
  const lines = packagesContent.split('\n');
  let currentPackage: string | null = null;
  let mailVersion: string | null = null;
  let passVersion: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('Package: ')) {
      currentPackage = trimmed.substring('Package: '.length);
    }

    if (trimmed.startsWith('Version: ') && currentPackage) {
      const version = trimmed.substring('Version: '.length);

      if (currentPackage === 'proton-mail') {
        mailVersion = version;
      } else if (currentPackage === 'proton-pass') {
        passVersion = version;
      }

      currentPackage = null;
    }
  }

  return { mail: mailVersion, pass: passVersion };
}

async function verifyCache(): Promise<void> {
  console.log('🔍 Verifying cache consistency...');

  try {
    const { namespaceId } = getKVConfig();

    // Check APT Packages and extract versions
    console.log('\n� APT Packages (versions):');
    try {
      const aptPackages = await getKvValue(namespaceId, KVCacheKey.APT_PACKAGES);
      if (aptPackages) {
        const versions = parseAptPackagesVersions(aptPackages);
        console.log(`  ✅ Mail: ${versions.mail || 'none'}`);
        console.log(`  ✅ Pass: ${versions.pass || 'none'}`);
      } else {
        console.log('  ❌ No APT Packages cache found');
      }
    } catch (error) {
      console.log(`  ❌ Error reading APT Packages: ${error}`);
    }

    // Check hash cache
    console.log('\n🔢 Hash Cache:');
    try {
      const hashCache = await downloadDescriptorsCache(namespaceId);
      if (hashCache) {
        const entries = Object.keys(hashCache);
        console.log(`  ✅ Total cached packages: ${entries.length}`);

        // Show sample entries
        const sampleEntries = entries.slice(0, 3);
        for (const url of sampleEntries) {
          const entry = hashCache[url];
          if (entry) {
            console.log(`  📦 ${url.split('/').pop()}`);
            console.log(`    SHA256: ${entry.sha256.slice(0, 16)}...`);
            console.log(`    Size: ${(entry.size / 1024 / 1024).toFixed(1)} MB`);
            console.log(`    Last verified: ${entry.lastVerified}`);
          }
        }

        if (entries.length > 3) {
          console.log(`  ... and ${entries.length - 3} more packages`);
        }
      } else {
        console.log('  ❌ No hash cache found');
      }
    } catch (error) {
      console.log(`  ❌ Error reading hash cache: ${error}`);
    }

    // Check APT Release
    console.log('\n📄 APT Release:');
    try {
      const aptRelease = await getKvValue(namespaceId, KVCacheKey.APT_RELEASE);
      if (aptRelease) {
        const lines = aptRelease.split('\n').length;
        const size = (aptRelease.length / 1024).toFixed(2);
        console.log(`  ✅ Found (${lines} lines, ${size} KB)`);
        // Show first few lines
        const preview = aptRelease.split('\n').slice(0, 3).join('\n');
        console.log(`  Preview:\n    ${preview.replace(/\n/g, '\n    ')}`);
      } else {
        console.log('  ❌ No APT Release found');
      }
    } catch (error) {
      console.log(`  ❌ Error reading APT Release: ${error}`);
    }

    // Check APT Packages
    console.log('\n📦 APT Packages:');
    try {
      const aptPackages = await getKvValue(namespaceId, KVCacheKey.APT_PACKAGES);
      if (aptPackages) {
        const packageCount = (aptPackages.match(/Package:/g) || []).length;
        const size = (aptPackages.length / 1024).toFixed(2);
        console.log(`  ✅ Found ${packageCount} packages (${size} KB)`);

        // Extract package names and versions
        const packageRegex = /Package: ([^\n]+)\nVersion: ([^\n]+)/g;
        let match: RegExpExecArray | null;
        while (true) {
          match = packageRegex.exec(aptPackages);
          if (match === null) {
            break;
          }
          console.log(`    - ${match[1]} ${match[2]}`);
        }
      } else {
        console.log('  ❌ No APT Packages found');
      }
    } catch (error) {
      console.log(`  ❌ Error reading APT Packages: ${error}`);
    }

    // Check APT Arch Release
    console.log('\n🏗️  APT Architecture Release:');
    try {
      const aptArchRelease = await getKvValue(namespaceId, KVCacheKey.APT_ARCH_RELEASE);
      if (aptArchRelease) {
        const lines = aptArchRelease.split('\n').length;
        console.log(`  ✅ Found (${lines} lines)`);
        console.log(`  Content:\n    ${aptArchRelease.replace(/\n/g, '\n    ')}`);
      } else {
        console.log('  ❌ No APT Arch Release found');
      }
    } catch (error) {
      console.log(`  ❌ Error reading APT Arch Release: ${error}`);
    }

    // Check APT InRelease (GPG signed)
    console.log('\n🔐 APT InRelease (GPG):');
    try {
      const aptInRelease = await getKvValue(namespaceId, KVCacheKey.APT_INRELEASE);
      if (aptInRelease) {
        const size = (aptInRelease.length / 1024).toFixed(2);
        const hasSignature = aptInRelease.includes('-----BEGIN PGP SIGNED MESSAGE-----');
        console.log(`  ✅ Found (${size} KB)`);
        console.log(`  📝 Contains GPG signature: ${hasSignature ? '✅' : '❌'}`);
        // Show first line
        const firstLine = aptInRelease.split('\n')[0];
        console.log(`  Preview: ${firstLine}`);
      } else {
        console.log('  ⚠️  No APT InRelease found (GPG signing may not be configured)');
      }
    } catch (error) {
      console.log(`  ❌ Error reading APT InRelease: ${error}`);
    }

    // Check APT Release.gpg (detached signature)
    console.log('\n🔏 APT Release.gpg (detached signature):');
    try {
      const aptReleaseGpg = await getKvValue(namespaceId, KVCacheKey.APT_RELEASE_GPG);
      if (aptReleaseGpg) {
        const size = (aptReleaseGpg.length / 1024).toFixed(2);
        const hasSignature = aptReleaseGpg.includes('-----BEGIN PGP SIGNATURE-----');
        console.log(`  ✅ Found (${size} KB)`);
        console.log(`  📝 Valid GPG signature format: ${hasSignature ? '✅' : '❌'}`);
      } else {
        console.log('  ⚠️  No APT Release.gpg found (GPG signing may not be configured)');
      }
    } catch (error) {
      console.log(`  ❌ Error reading APT Release.gpg: ${error}`);
    }

    // Check APT Public Key
    console.log('\n🔓 APT Public Key:');
    try {
      const aptPublicKey = await getKvValue(namespaceId, KVCacheKey.APT_PUBLIC_KEY);
      if (aptPublicKey) {
        const size = (aptPublicKey.length / 1024).toFixed(2);
        const hasPublicKey = aptPublicKey.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----');
        console.log(`  ✅ Found (${size} KB)`);
        console.log(`  📝 Valid public key format: ${hasPublicKey ? '✅' : '❌'}`);

        // Extract key ID if possible
        if (hasPublicKey) {
          const lines = aptPublicKey.split('\n');
          const keyLine = lines.find(
            (l) => l.trim().length > 40 && !l.includes('BEGIN') && !l.includes('END')
          );
          if (keyLine) {
            console.log(`  🔑 Key preview: ${keyLine.trim().slice(0, 32)}...`);
          }
        }
      } else {
        console.log('  ⚠️  No APT Public Key found (GPG signing may not be configured)');
      }
    } catch (error) {
      console.log(`  ❌ Error reading APT Public Key: ${error}`);
    }

    // Check last update timestamp
    console.log('\n🕒 Last Update:');
    try {
      const lastUpdate = await getKvValue(namespaceId, 'last-update-timestamp');
      if (lastUpdate) {
        console.log(`  ✅ ${lastUpdate}`);
      } else {
        console.log('  ❌ No timestamp found');
      }
    } catch (error) {
      console.log(`  ❌ Error reading timestamp: ${error}`);
    }

    console.log('\n✅ Cache verification completed');
  } catch (error) {
    console.error('❌ Cache verification failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyCache();
}
