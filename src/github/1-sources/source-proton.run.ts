import * as cache from '@actions/cache';
import * as core from '@actions/core';
import { writeFile } from 'fs';
import {
  fetchProtonProductAPI,
  fromProtonToSource,
  GITHUB_CACHE_FILE,
  GITHUB_CACHE_KEY,
  PROTON_PRODUCTS,
  type ProtonApiError,
  type ProtonProduct,
} from '../../shared';

async function run() {
  // GitHub Action logic
  const protonProduct: ProtonProduct | undefined = PROTON_PRODUCTS.filter(
    (product) =>
      product === core.getInput('proton-product', { required: true, trimWhitespace: true })
  ).at(0);
  if (!protonProduct) {
    core.setFailed('Missing or invalid proton-product input');
    return;
  }
  const cacheKey = GITHUB_CACHE_KEY.SOURCE;
  const cacheFile = GITHUB_CACHE_FILE.PROTON[protonProduct];
  core.debug(`Using Proton product: ${protonProduct}`);
  core.debug(`Using cache key: ${cacheKey}`);
  core.debug(`Using cache file: ${cacheFile}`);

  // Download Proton data
  let apiResult;
  try {
    apiResult = await fetchProtonProductAPI(protonProduct);
  } catch (error: ProtonApiError) {
    core.setFailed(error.toString());
    return;
  }

  // Clean and convert data to Source
  const sourceProduct = fromProtonToSource(apiResult);
  if (sourceProduct.debFiles.length === 0 && sourceProduct.rpmFiles.length === 0) {
    core.setFailed('No valid files found in Proton API response');
    return;
  }

  // Save file
  writeFile(cacheFile, JSON.stringify(sourceProduct, null, 2), 'utf8');
  core.debug(`Saved Proton source data to ${cacheFile}`);

  // Save source
  cache.saveCache([cacheFile], cacheKey);
}

// -- GitHub Action ------------------------------------------------------------
run();
