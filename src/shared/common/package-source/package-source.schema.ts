import z from "zod";
import { ReleaseCategorySchema, VersionSchema } from "../schema";

// -- Global Constants ---------------------------------------------------------

/**
 * Current version of the package source schema.
 */
export const PACKAGE_SOURCE_VERSION = 1;

// -- Package Source File ------------------------------------------------------

/**
 * Package source file schema.
 */
export const PackageSourceFileSchema = z.object({
  // Version

  /**
   * Version of the package file.
   */
  version: VersionSchema,

  /**
   * Release category of the package file.
   */
  releaseCategory: ReleaseCategorySchema,

  /**
   * Release date of the package file.
   */
  releaseDate: z.date(),

  /**
   * Optional release notes for the package file.
   */
  releaseNotes: z.array(z.string()).optional(),

  /**
   * URL to download the package file.
   */
  url: z.url(),

  /**
   * MD5 checksum of the package file.
   */
  md5CheckSum: z.hash("md5").optional(),

  /**
   * SHA-256 checksum of the package file.
   */
  sha256CheckSum: z.hash("sha256").optional(),

  /**
   * SHA-512 checksum of the package file.
   */
  sha512CheckSum: z.hash("sha512").optional(),
});


// -- Package Source Product ---------------------------------------------------

/**
 * Package source product schema.
 */
export const PackageSourceProductSchema = z.object({
  /**
   * Version of the package source schema.
   * Ensures compatibility with future schema changes.
   */
  version: z.number().int().min(1).default(PACKAGE_SOURCE_VERSION),

  /**
   * Last updated timestamp for the product.
   */
  lastUpdated: z.date().optional(),

  /**
   * Sorted DEB files for the product.
   * The more recent files appear first.
   */
  debFiles: z.array(PackageSourceFileSchema),

  /**
   * Sorted RPM files for the product.
   * The more recent files appear first.
   */
  rpmFiles: z.array(PackageSourceFileSchema),
});
