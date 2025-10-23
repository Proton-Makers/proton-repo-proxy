/**
 * Common utility functions shared between Worker and scripts
 */

import { createHash } from 'node:crypto';

/**
 * Calculate SHA256 hash of a string
 */
export function calculateSHA256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Calculate SHA256 hash of a buffer
 */
export function calculateSHA256Buffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Calculate MD5 hash of a string
 */
export function calculateMD5(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

/**
 * Calculate SHA1 hash of a string
 */
export function calculateSHA1(content: string): string {
  return createHash('sha1').update(content).digest('hex');
}

/**
 * Validate if a string is a valid SHA256 hash
 */
export function isValidSHA256(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
