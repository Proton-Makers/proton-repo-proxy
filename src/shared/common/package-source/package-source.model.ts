import type z from 'zod';
import type { PackageSourceFileSchema, PackageSourceProductSchema } from './package-source.schema';

export type PackageSourceProduct = z.infer<typeof PackageSourceProductSchema>;

export type PackageSourceFile = z.infer<typeof PackageSourceFileSchema>;
