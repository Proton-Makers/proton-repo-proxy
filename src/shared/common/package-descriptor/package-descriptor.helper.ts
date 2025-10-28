import type { ProtonFile } from '../../proton';
import type { PackageDescriptor } from './package-descriptor.model';
import {
  computeDebDescriptor,
  computeHashDescriptor,
  computeSizeDescriptor,
  type ExtraFile,
} from './utils';

/**
 * Generate package descriptor from Proton file
 *
 * @param file Proton file
 * @returns Returns package descriptor
 * @throws Error if something goes wrong
 */
export async function DescriptorFromFile(file: ProtonFile): Promise<PackageDescriptor> {
  console.log(`📦 Processing ${file.Identifier}...`);

  const url = file.Url;
  const filename = url.split('/').pop() || 'unknown';
  const extraFile: ExtraFile = { ...file, filename };

  // Fetch file buffer
  const bufferPromise = fetchFileBuffer(extraFile);

  return await Promise.all([
    // Compute size
    computeSizeDescriptor(extraFile),
    // Compute hashes
    bufferPromise.then((buffer) => computeHashDescriptor(extraFile, buffer)),
    // Compute deb
    bufferPromise.then((buffer) => computeDebDescriptor(extraFile, buffer)),
  ]).then(([sizeDescriptor, hashDescriptor, debDescriptor]) => ({
    url,
    filename,
    ...sizeDescriptor,
    ...debDescriptor,
    ...hashDescriptor,
  }));
}

// -- Internal Helpers ---------------------------------------------------------

/**
 *
 * @param file
 * @returns
 */
async function fetchFileBuffer(file: ExtraFile): Promise<Buffer<ArrayBuffer>> {
  console.log(`  📥 Fetching ${file.filename}...`);
  const downloadResponse = await fetch(file.Url);
  if (!downloadResponse.ok) {
    throw new Error(`Failed to download: ${downloadResponse.status}`);
  }
  const arrayBuffer = await downloadResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
