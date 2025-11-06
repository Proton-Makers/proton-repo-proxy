import type { PackageSourceProduct } from '../../common';
import type { ProtonApiResponse } from '../api';

export function fromProtonToSource(proton: ProtonApiResponse): PackageSourceProduct {
  return {
    version: 1,
  };
}
