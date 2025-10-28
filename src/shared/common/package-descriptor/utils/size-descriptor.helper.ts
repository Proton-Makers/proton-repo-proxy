import { PackageDescriptor } from "../package-descriptor.model";
import { ExtraFile } from "./extra-file.model";


/**
 * Size descriptor fields
 */
export type SizeDescriptor = Pick<PackageDescriptor, 'size'>;


/**
 * Compute size descriptor from file
 */
export async function computeSizeDescriptor(file: ExtraFile): Promise<SizeDescriptor> {
  console.log(`  📥 Fetching size for ${file.filename}...`);
  const response = await fetch(file.Url, { method: 'HEAD' });
  if (!response.ok) {
    throw new Error(`Failed to fetch HEAD: ${response.status}`);
  }
  const size = Number.parseInt(response.headers.get('content-length') || '0', 10);
  console.log(`  📏 Size: ${(size / 1024 / 1024).toFixed(1)} MB`);

  return { size };
}
