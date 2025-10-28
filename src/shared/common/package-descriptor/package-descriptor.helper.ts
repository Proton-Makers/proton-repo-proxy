import { createHash } from "node:crypto";
import { ProtonFile } from "../../proton";
import { PackageDescriptor } from "./package-descriptor.model";
import { computeHashDescriptor, computeSizeDescriptor, computeDebDescriptor, ExtraFile } from "./utils";


/**
 * Hash calculation result with optional error
 */
export type DescriptorResult =
  | { success: true; descriptor: PackageDescriptor }
  | { success: false; file: ProtonFile; error: string };


export async function DescriptorFromFile(file: ProtonFile): Promise<DescriptorResult> {
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
    bufferPromise.then(buffer => computeHashDescriptor(extraFile, buffer)),
    // Compute deb
    bufferPromise.then(buffer => computeDebDescriptor(extraFile, buffer)),
  ]).then(([sizeDescriptor, hashDescriptor, debDescriptor]) => ({
    success: true,
    descriptor: {
      url,
      filename,
      ...sizeDescriptor,
      ...debDescriptor,
      ...hashDescriptor,
    }
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
