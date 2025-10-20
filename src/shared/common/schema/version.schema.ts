import z from 'zod';

/**
 * Version schema for validating version strings.
 * Format: X.Y.Z or X.Y.Z-suffix
 */
export const VersionSchema = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/,
    'Invalid version format (expected X.Y.Z or X.Y.Z-suffix)'
  );
