import { generateAptMetadata, generateCompleteAptRelease } from './lib/apt.js';
import { extractPackageInfo, fetchProtonData } from './lib/proton.js';
import { generateRpmMetadata } from './lib/rpm.js';
import type { Env, PackageInfo } from './types.js';

/**
 * Main Cloudflare Worker handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      // Route handling
      if (path === '/') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            service: 'proton-repo-proxy',
            version: '2.0.0',
            timestamp: new Date().toISOString(),
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      // APT repository routes
      if (path.match(/^\/apt\/dists\/([^/]+)\/([^/]+)\/binary-([^/]+)\/Packages$/)) {
        return handleAptPackages(request, env, corsHeaders);
      }

      if (path.match(/^\/apt\/dists\/([^/]+)\/Release$/)) {
        return handleAptRelease(request, env, corsHeaders);
      }

      if (path.match(/^\/apt\/dists\/([^/]+)\/InRelease$/)) {
        return handleAptRelease(request, env, corsHeaders); // Same as Release for now
      }

      // RPM repository routes
      if (path === '/rpm/repodata/repomd.xml') {
        return handleRpmRepomd(request, env, corsHeaders);
      }

      if (path.match(/^\/rpm\/repodata\/(.+)$/)) {
        return handleRpmMetadata(request, env, corsHeaders);
      }

      // Package downloads
      if (path.match(/^\/packages\/(.+)$/)) {
        return handlePackageDownload(request, env, corsHeaders);
      }

      // API routes
      if (path === '/api/packages') {
        return handleApiPackages(request, env, corsHeaders);
      }

      if (path === '/api/status') {
        return handleApiStatus(request, env, corsHeaders);
      }

      if (path === '/api/cache/clear' && request.method === 'POST') {
        return handleCacheClear(request, env, corsHeaders);
      }

      // Legacy redirects
      if (path.match(/^\/apt\/pool\/main\/(.+)$/)) {
        const filename = path.split('/').pop();
        return Response.redirect(`${url.origin}/packages/${filename}`, 302);
      }

      if (path.match(/^\/rpm\/rpms\/(.+)$/)) {
        const filename = path.split('/').pop();
        return Response.redirect(`${url.origin}/packages/${filename}`, 302);
      }

      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders,
      });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response('Internal Server Error', {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};

async function handleAptPackages(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const dist = pathParts[3];
  const component = pathParts[4];
  const archPart = pathParts[5] || '';
  const arch = archPart.replace('binary-', '');

  // Only support amd64 (Proton packages are amd64 only)
  if (arch !== 'amd64') {
    return new Response('', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'max-age=3600',
        ...corsHeaders,
      },
    });
  }

  const cacheKey = `apt-packages-${dist}-${component}-amd64`;

  // Check cache only if KV is available
  let cached: string | null = null;
  if (env.KV) {
    cached = await env.KV.get(cacheKey);
  }

  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'max-age=3600',
        ...corsHeaders,
      },
    });
  }

  // Get package data (all Proton packages are amd64)
  const appData = await fetchProtonData('mail');
  const allPackages = extractPackageInfo(appData, 'mail');
  const packages = allPackages.filter((pkg) => pkg.filename.endsWith('.deb'));

  const metadata = await generateAptMetadata(packages, env.BASE_URL, 'amd64');

  // Cache only if KV is available
  if (env.KV) {
    await env.KV.put(cacheKey, metadata.packages, { expirationTtl: 3600 });
  }

  return new Response(metadata.packages, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'max-age=3600',
      ...corsHeaders,
    },
  });
}

async function handleAptRelease(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const dist = url.pathname.split('/')[3];

  const cacheKey = `apt-release-${dist}`;

  // Check cache only if KV is available
  let cached: string | null = null;
  if (env.KV) {
    cached = await env.KV.get(cacheKey);
  }

  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'max-age=3600',
        ...corsHeaders,
      },
    });
  }

  const appData = await fetchProtonData('mail');
  const allPackages = extractPackageInfo(appData, 'mail');
  const packages = allPackages.filter((pkg) => pkg.filename.endsWith('.deb'));

  const releaseContent = await generateCompleteAptRelease(packages, env.BASE_URL);

  // Cache only if KV is available
  if (env.KV) {
    await env.KV.put(cacheKey, releaseContent, { expirationTtl: 3600 });
  }

  return new Response(releaseContent, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'max-age=3600',
      ...corsHeaders,
    },
  });
}

async function handleRpmRepomd(
  _request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const cacheKey = 'rpm-repomd';

  // Check cache only if KV is available
  let cached: string | null = null;
  if (env.KV) {
    cached = await env.KV.get(cacheKey);
  }

  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'max-age=3600',
        ...corsHeaders,
      },
    });
  }

  const appData = await fetchProtonData('mail');
  const allPackages = extractPackageInfo(appData, 'mail');
  const packages = allPackages.filter((pkg) => pkg.filename.endsWith('.rpm'));

  const metadata = await generateRpmMetadata(packages, env.BASE_URL);

  // Cache only if KV is available
  if (env.KV) {
    await env.KV.put(cacheKey, metadata.repomd, { expirationTtl: 3600 });
  }

  return new Response(metadata.repomd, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'max-age=3600',
      ...corsHeaders,
    },
  });
}

async function handleRpmMetadata(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const file = url.pathname.split('/').pop() || '';

  const cacheKey = `rpm-${file}`;

  // Check cache only if KV is available
  let cached: ArrayBuffer | null = null;
  if (env.KV) {
    cached = await env.KV.get(cacheKey, 'arrayBuffer');
  }

  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': file.endsWith('.gz') ? 'application/gzip' : 'application/xml',
        'Cache-Control': 'max-age=3600',
        ...corsHeaders,
      },
    });
  }

  const appData = await fetchProtonData('mail');
  const allPackages = extractPackageInfo(appData, 'mail');
  const packages = allPackages.filter((pkg) => pkg.filename.endsWith('.rpm'));

  const metadata = await generateRpmMetadata(packages, env.BASE_URL);

  let content: string | Uint8Array;
  let contentType: string;

  switch (file) {
    case 'primary.xml.gz':
      content = metadata.primaryGz;
      contentType = 'application/gzip';
      break;
    case 'filelists.xml.gz':
      content = metadata.filelistsGz;
      contentType = 'application/gzip';
      break;
    case 'other.xml.gz':
      content = metadata.otherGz;
      contentType = 'application/gzip';
      break;
    case 'primary.xml':
      content = metadata.primary;
      contentType = 'application/xml';
      break;
    case 'filelists.xml':
      content = metadata.filelists;
      contentType = 'application/xml';
      break;
    case 'other.xml':
      content = metadata.other;
      contentType = 'application/xml';
      break;
    default:
      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders,
      });
  }

  // Cache only if KV is available
  if (env.KV) {
    await env.KV.put(cacheKey, content, { expirationTtl: 3600 });
  }

  return new Response(content, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'max-age=3600',
      ...corsHeaders,
    },
  });
}

async function handlePackageDownload(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const filename = url.pathname.split('/').pop() || '';

  const cacheKey = 'proton-packages';

  // Check cache only if KV is available
  let cachedData: PackageInfo[] | null = null;
  if (env.KV) {
    const kvData = await env.KV.get(cacheKey, 'json');
    cachedData = kvData as PackageInfo[] | null;
  }

  if (!cachedData) {
    const appData = await fetchProtonData('mail');
    cachedData = extractPackageInfo(appData, 'mail');

    // Cache only if KV is available
    if (env.KV) {
      await env.KV.put(cacheKey, JSON.stringify(cachedData), { expirationTtl: 1800 });
    }
  }

  const pkg = cachedData.find((p) => p.filename === filename);

  if (!pkg) {
    return new Response('Package not found', {
      status: 404,
      headers: corsHeaders,
    });
  }

  return Response.redirect(pkg.url, 302);
}

async function handleApiPackages(
  _request: Request,
  _env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const appData = await fetchProtonData('mail');
  const packages = extractPackageInfo(appData, 'mail');

  return new Response(JSON.stringify(packages, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

async function handleApiStatus(
  _request: Request,
  _env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const appData = await fetchProtonData('mail');
  const packages = extractPackageInfo(appData, 'mail');

  const stats = {
    totalPackages: packages.length,
    debPackages: packages.filter((p) => p.filename.endsWith('.deb')).length,
    rpmPackages: packages.filter((p) => p.filename.endsWith('.rpm')).length,
    architectures: ['amd64'], // Proton packages are amd64 only
    lastUpdated: new Date().toISOString(),
  };

  return new Response(JSON.stringify(stats, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

async function handleCacheClear(
  _request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const keys = [
    'proton-packages',
    'apt-packages-stable-main-amd64',
    'apt-packages-stable-main-arm64',
    'apt-release-stable',
    'rpm-repomd',
    'rpm-primary.xml.gz',
    'rpm-filelists.xml.gz',
    'rpm-other.xml.gz',
  ];

  // Clear cache only if KV is available
  if (env.KV) {
    await Promise.all(keys.map((key) => env.KV?.delete(key)).filter(Boolean));
  }

  return new Response(JSON.stringify({ message: 'Cache cleared successfully' }), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}
