import { exec } from "node:child_process";
import { mkdtempSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { PackageDescriptor } from "../package-descriptor.model";
import { ExtraFile } from "./extra-file.model";

const execAsync = promisify(exec);

/**
 * Deb descriptor fields
 */
export type DebDescriptor = Pick<PackageDescriptor,
  | 'package'
  | 'description'
  | 'version'
  | 'section'
  | 'maintainer'
  | 'homepage'
  | 'architecture'
  | 'priority'
  | 'depends'
  | 'recommends'
  | 'suggests'>;


/**
 * Compute deb descriptor from .deb file
 */
export async function computeDebDescriptor(file: ExtraFile, buffer: Buffer<ArrayBuffer>): Promise<DebDescriptor> {
  console.log(`  📦 Extracting metadata from ${file.filename}...`);

  // Write buffer to temporary file
  const tmpDir = mkdtempSync(join(tmpdir(), 'proton-deb-'));
  const tmpFile = join(tmpDir, 'package.deb');
  writeFileSync(tmpFile, buffer);

  try {
    // Extract control info using dpkg-deb
    const { stdout } = await execAsync(`dpkg-deb -f "${tmpFile}"`);

    // Parse control fields
    const metadata: Record<string, string> = {};
    for (const line of stdout.split('\n')) {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match?.[1] && match?.[2]) {
        const key = match[1];
        const value = match[2];
        metadata[key.toLowerCase()] = value.trim();
      }
    }

    console.log(`  ✅ Package: ${metadata.package || 'unknown'}`);
    console.log(`  ✅ Version: ${metadata.version || 'unknown'}`);
    console.log(`  ✅ Architecture: ${metadata.architecture || 'unknown'}`);

    // Return required and optional fields
    return {
      package: metadata.package || '',
      version: metadata.version || '',
      architecture: metadata.architecture || '',
      maintainer: metadata.maintainer || '',
      ...(metadata.description && { description: metadata.description }),
      ...(metadata.section && { section: metadata.section }),
      ...(metadata.priority && { priority: metadata.priority }),
      ...(metadata.homepage && { homepage: metadata.homepage }),
      ...(metadata.depends && { depends: metadata.depends }),
      ...(metadata.recommends && { recommends: metadata.recommends }),
      ...(metadata.suggests && { suggests: metadata.suggests }),
    };
  } finally {
    // Cleanup temporary file
    try {
      unlinkSync(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}
