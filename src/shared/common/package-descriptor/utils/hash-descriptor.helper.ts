import { createHash } from "node:crypto";
import { PackageDescriptor } from "../package-descriptor.model";
import { ExtraFile } from "./extra-file.model";


/**
 * Hash descriptor fields
 */
export type HashDescriptor = Pick<PackageDescriptor,
  | 'md5'
  | 'sha256'
  | 'sha512'>;

// Hash algorithm constants
const HASH_MD5 = 'md5';
const HASH_SHA256 = 'sha256';
const HASH_SHA512 = 'sha512';

/**
 * Compute hash descriptor from file
 */
export async function computeHashDescriptor(file: ExtraFile, buffer: Buffer<ArrayBuffer>): Promise<HashDescriptor> {

  // Compute hashes
  console.log(`  🔢 Calculating hashes for ${file.filename}...`);
  const md5 = createHash(HASH_MD5).update(buffer).digest('hex');
  const sha256 = createHash(HASH_SHA256).update(buffer).digest('hex');
  const sha512 = createHash(HASH_SHA512).update(buffer).digest('hex');
  console.log(`  ✅ MD5: ${md5.slice(0, 16)}...`);
  console.log(`  ✅ SHA256: ${sha256.slice(0, 16)}...`);
  console.log(`  ✅ SHA512: ${sha512.slice(0, 16)}...`);

  // Validate SHA512 with Proton API
  const expectedSha512 = file.Sha512CheckSum.toLowerCase();
  if (sha512 !== expectedSha512) {
    console.warn(`  ⚠️  SHA512 MISMATCH for ${file.filename} - skipping file`);
    console.warn(`     Expected: ${expectedSha512}`);
    console.warn(`     Calculated: ${sha512}`);
    throw new Error(`SHA512 mismatch, expected: ${expectedSha512}, calculated: ${sha512}`);
  }

  console.log('  🔐 SHA512 validation: PASSED');

  return {
    md5,
    sha256,
    sha512,
  };
}
