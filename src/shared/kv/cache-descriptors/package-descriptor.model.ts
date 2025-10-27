import type z from 'zod';
import type { PackageDescriptorSchema, PackageDescriptorsSchema } from './package-descriptor.schema';

/**
 * Package descriptors
 * Mapping of package URL to its descriptor.
 */
export type PackageDescriptors = z.infer<typeof PackageDescriptorsSchema>;

/**
 * Package descriptor
 * Contains metadata and hash information for a single Debian package.
 */
export type PackageDescriptor = z.infer<typeof PackageDescriptorSchema>;
