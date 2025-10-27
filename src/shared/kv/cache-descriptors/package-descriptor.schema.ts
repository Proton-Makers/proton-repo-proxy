import z from 'zod';
import { VersionSchema } from '../../common';

/**
 * Complete package descriptor schema
 * Property names match Debian package descriptor format
 */
export const PackageDescriptorSchema = z.object({
  // Info
  package: z.string().min(1), // e.g., proton-mail, proton-pass
  description: z.string().optional(), // e.g., Proton official desktop application for Proton Mail and Proton Calendar
  version: VersionSchema,
  section: z.string().optional(), // e.g., utils

  // Maintainer
  maintainer: z.string().min(1), // e.g., Proton
  homepage: z.url().optional(), // e.g., https://proton.me

  // Package
  architecture: z.string().min(1), // e.g., amd64
  priority: z.string().optional(), // e.g., optional
  depends: z.string().optional(), // e.g., libgtk-3-0, libnotify4
  recommends: z.string().optional(), // e.g., pulseaudio | libasound2
  suggests: z.string().optional(), // e.g., gir1.2-gnomekeyring-1.0, libgnome-keyring0, lsb-release

  // File
  size: z.number().int().positive(),
  md5: z.hash('md5'),
  sha256: z.hash('sha256'),
  sha512: z.hash('sha512'),

  // Proxy
  url: z.url(),
  filename: z.string().min(1), // e.g., proxy/download/mail/linux/1.9.1/ProtonMail-desktop-beta.deb
  lastVerified: z.iso.datetime().optional(), // ISO date string when hash was last verified
});

/**
 * All package descriptors schema
 * Key format: URL (validated as proper URL format)
 */
export const PackageDescriptorsSchema = z.record(z.url(), PackageDescriptorSchema);
