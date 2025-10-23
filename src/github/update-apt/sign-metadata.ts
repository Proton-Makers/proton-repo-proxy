#!/usr/bin/env tsx

/**
 * Sign APT repository metadata with GPG
 * Usage: GPG_PRIVATE_KEY="..." GPG_PASSPHRASE="..." APT_OUTPUT_DIR=/path tsx src/github/update-apt/sign-metadata.ts
 *
 * Features:
 * - Imports GPG private key from environment
 * - Signs Release file to create Release.gpg (detached signature)
 * - Creates InRelease file (clearsigned Release)
 * - Exports public GPG key
 * - Saves signed files to output directory
 */

import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('🔐 Signing APT repository metadata with GPG...\n');

  // 1. Check environment
  const outputDir = process.env.APT_OUTPUT_DIR;
  const gpgPrivateKey = process.env.GPG_PRIVATE_KEY;
  const gpgPassphrase = process.env.GPG_PASSPHRASE;

  if (!outputDir) {
    console.error('❌ APT_OUTPUT_DIR environment variable is required');
    process.exit(1);
  }

  if (!gpgPrivateKey) {
    console.error('❌ GPG_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  if (!gpgPassphrase) {
    console.error('❌ GPG_PASSPHRASE environment variable is required');
    process.exit(1);
  }

  // 2. Check Release file exists
  const releaseFile = join(outputDir, 'Release');
  if (!existsSync(releaseFile)) {
    console.error(`❌ Release file not found: ${releaseFile}`);
    process.exit(1);
  }

  console.log(`✅ Found Release file: ${releaseFile}`);

  // 3. Setup GPG
  const gnupgHome = join(tmpdir(), `gnupg-${Date.now()}`);
  process.env.GNUPGHOME = gnupgHome;

  console.log(`📁 Using temporary GPG home: ${gnupgHome}`);

  try {
    // Create GPG home directory
    execSync(`mkdir -p "${gnupgHome}" && chmod 700 "${gnupgHome}"`, {
      stdio: 'inherit',
    });

    // Configure GPG for non-interactive use
    writeFileSync(join(gnupgHome, 'gpg.conf'), 'use-agent\npinentry-mode loopback\n');
    writeFileSync(join(gnupgHome, 'gpg-agent.conf'), 'allow-loopback-pinentry\n');

    // Import private key
    console.log('\n🔑 Importing GPG private key...');
    const keyFile = join(gnupgHome, 'private.key');
    writeFileSync(keyFile, gpgPrivateKey);

    execSync(`gpg --batch --import "${keyFile}"`, {
      stdio: 'inherit',
      env: { ...process.env, GNUPGHOME: gnupgHome },
    });

    // Get key ID
    const keyIdOutput = execSync('gpg --list-secret-keys --with-colons | grep ^sec | cut -d: -f5', {
      encoding: 'utf8',
      env: { ...process.env, GNUPGHOME: gnupgHome },
    }).trim();

    if (!keyIdOutput) {
      console.error('❌ Failed to get GPG key ID');
      process.exit(1);
    }

    const keyId = keyIdOutput.split('\n')[0];
    console.log(`✅ Imported GPG key: ${keyId}`);

    // 4. Sign Release file (detached signature)
    console.log('\n✍️  Creating detached signature (Release.gpg)...');
    const releaseGpgFile = join(outputDir, 'Release.gpg');

    execSync(
      `gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --armor --detach-sign --output "${releaseGpgFile}" "${releaseFile}"`,
      {
        input: gpgPassphrase,
        stdio: ['pipe', 'inherit', 'inherit'],
        env: { ...process.env, GNUPGHOME: gnupgHome },
      }
    );

    console.log(`✅ Created: ${releaseGpgFile}`);

    // 5. Create InRelease file (clearsigned)
    console.log('\n✍️  Creating clearsigned InRelease file...');
    const inReleaseFile = join(outputDir, 'InRelease');

    execSync(
      `gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --armor --clearsign --output "${inReleaseFile}" "${releaseFile}"`,
      {
        input: gpgPassphrase,
        stdio: ['pipe', 'inherit', 'inherit'],
        env: { ...process.env, GNUPGHOME: gnupgHome },
      }
    );

    console.log(`✅ Created: ${inReleaseFile}`);

    // 6. Copy public key from repository
    console.log('\n🔓 Copying public GPG key from repository...');
    const publicKeyFile = join(outputDir, 'public.gpg.key');
    const publicKeySource = join(process.cwd(), 'public.key');

    if (!existsSync(publicKeySource)) {
      console.error(`❌ Public key not found at: ${publicKeySource}`);
      throw new Error('Public key file (public.key) not found in repository root');
    }

    execSync(`cp "${publicKeySource}" "${publicKeyFile}"`);
    console.log(`✅ Public key copied: ${publicKeyFile}`);

    // 7. Verify signatures
    console.log('\n🔍 Verifying signatures...');

    try {
      execSync(`gpg --batch --verify "${releaseGpgFile}" "${releaseFile}"`, {
        stdio: 'inherit',
        env: { ...process.env, GNUPGHOME: gnupgHome },
      });
      console.log('✅ Release.gpg signature verified');
    } catch (error) {
      console.error('❌ Failed to verify Release.gpg');
      throw error;
    }

    try {
      execSync(`gpg --batch --verify "${inReleaseFile}"`, {
        stdio: 'inherit',
        env: { ...process.env, GNUPGHOME: gnupgHome },
      });
      console.log('✅ InRelease signature verified');
    } catch (error) {
      console.error('❌ Failed to verify InRelease');
      throw error;
    }

    // 7. Summary
    console.log('\n✅ GPG signing completed successfully!');
    console.log('\nGenerated files:');
    console.log(`  - ${releaseGpgFile}`);
    console.log(`  - ${inReleaseFile}`);
    console.log(`  - ${publicKeyFile}`);

    // Cleanup
    execSync(`rm -rf "${gnupgHome}"`, { stdio: 'ignore' });
  } catch (error) {
    console.error('\n❌ GPG signing failed:', error);
    // Cleanup on error
    try {
      execSync(`rm -rf "${gnupgHome}"`, { stdio: 'ignore' });
    } catch {
      // Ignore cleanup errors
    }
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
