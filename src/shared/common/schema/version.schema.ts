import z from 'zod';

// -- Version Schema -----------------------------------------------------------

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

// -- Release Category Schema --------------------------------------------------

export const RELEASE_CATEGORY_EARLY_ACCESS = 'EarlyAccess';
export const RELEASE_CATEGORY_ALPHA = 'Alpha';
export const RELEASE_CATEGORY_BETA = 'Beta';
export const RELEASE_CATEGORY_STABLE = 'Stable';

/**
 * Release category schema.
 */
export const ReleaseCategorySchema = z.enum([
  RELEASE_CATEGORY_EARLY_ACCESS,
  RELEASE_CATEGORY_ALPHA,
  RELEASE_CATEGORY_BETA,
  RELEASE_CATEGORY_STABLE,
]);
