import type { Env } from './types/worker.js';

/**
 * Main Cloudflare Worker handler - simplified version using KV only
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

      // Root endpoint
      if (path === '/') {
        const lastUpdate = env.REPO_CACHE
          ? await env.REPO_CACHE.get('last-update-timestamp')
          : null;

        return new Response(
          JSON.stringify({
            status: 'ok',
            service: 'proton-repo-proxy',
            version: '3.0.0-kv',
            timestamp: new Date().toISOString(),
            kvAvailable: !!env.REPO_CACHE,
            lastUpdate: lastUpdate || 'Never',
            message: lastUpdate
              ? 'Repository data available from KV'
              : 'Waiting for CI to generate repository data',
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      // Test KV endpoint
      if (path === '/test-kv') {
        if (!env.REPO_CACHE) {
          return new Response('KV not available', { status: 500, headers: corsHeaders });
        }

        try {
          const testValue = await env.REPO_CACHE.get('test-direct');
          return new Response(
            JSON.stringify({
              kvStatus: 'working',
              testValue: testValue,
              timestamp: new Date().toISOString(),
            }),
            {
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
              },
            }
          );
        } catch (error) {
          return new Response(
            JSON.stringify({
              kvStatus: 'error',
              error: String(error),
            }),
            {
              status: 500,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders,
              },
            }
          );
        }
      }

      // APT repository routes
      if (path.match(/^\/apt\/dists\/([^/]+)\/([^/]+)\/binary-([^/]+)\/Packages$/)) {
        return handleAptPackagesFromKV(env, corsHeaders);
      }

      if (path.match(/^\/apt\/dists\/([^/]+)\/Release$/)) {
        return handleAptReleaseFromKV(env, corsHeaders);
      }

      // Arch-specific Release
      if (path.match(/^\/apt\/dists\/([^/]+)\/([^/]+)\/binary-([^/]+)\/Release$/)) {
        return handleAptArchReleaseFromKV(env, corsHeaders);
      }

      // APT pool - proxy .deb downloads
      if (path.match(/^\/apt\/pool\//)) {
        return handleAptPoolProxy(path, env, corsHeaders);
      }

      // 404 for all other routes
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

/**
 * Handle APT Packages request from KV
 */
async function handleAptPackagesFromKV(
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    if (!env.REPO_CACHE) {
      return new Response('KV storage not available. Please configure REPO_CACHE binding.', {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Read pre-generated Packages file from KV
    const packagesContent = await env.REPO_CACHE.get('apt-packages');

    if (!packagesContent) {
      return new Response(
        'Repository metadata not found. Please wait for GitHub CI to generate it.',
        {
          status: 404,
          headers: corsHeaders,
        }
      );
    }

    return new Response(packagesContent, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'max-age=3600',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Error serving Packages from KV:', error);
    return new Response('Error loading repository metadata', {
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * Handle APT Release request from KV
 */
async function handleAptReleaseFromKV(
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    if (!env.REPO_CACHE) {
      return new Response('KV storage not available. Please configure REPO_CACHE binding.', {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Read pre-generated Release file from KV
    const releaseContent = await env.REPO_CACHE.get('apt-release');

    if (!releaseContent) {
      return new Response(
        'Repository metadata not found. Please wait for GitHub CI to generate it.',
        {
          status: 404,
          headers: corsHeaders,
        }
      );
    }

    return new Response(releaseContent, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'max-age=3600',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Error serving Release from KV:', error);
    return new Response('Error loading repository metadata', {
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * Handle APT Architecture-specific Release request from KV
 */
async function handleAptArchReleaseFromKV(
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    if (!env.REPO_CACHE) {
      return new Response('KV storage not available. Please configure REPO_CACHE binding.', {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Read pre-generated Architecture Release file from KV
    const archReleaseContent = await env.REPO_CACHE.get('apt-arch-release');

    if (!archReleaseContent) {
      return new Response(
        'Repository metadata not found. Please wait for GitHub CI to generate it.',
        {
          status: 404,
          headers: corsHeaders,
        }
      );
    }

    return new Response(archReleaseContent, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'max-age=3600',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Error serving Arch Release from KV:', error);
    return new Response('Error loading repository metadata', {
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * Handle APT pool proxy - redirect to actual Proton download URLs
 */
async function handleAptPoolProxy(
  path: string,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    if (!env.REPO_CACHE) {
      return new Response('KV storage not available. Please configure REPO_CACHE binding.', {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Get URL mapping from KV
    const mappingJson = await env.REPO_CACHE.get('apt-url-mapping');
    if (!mappingJson) {
      return new Response('URL mapping not found. Please wait for GitHub CI to generate it.', {
        status: 404,
        headers: corsHeaders,
      });
    }

    const mapping: Record<string, string> = JSON.parse(mappingJson);

    // Extract pool path from URL (remove /apt/ prefix)
    const poolPath = path.replace(/^\/apt\//, '');

    // Look up actual download URL
    const downloadUrl = mapping[poolPath];
    if (!downloadUrl) {
      console.error(`Pool path not found in mapping: ${poolPath}`);
      return new Response('Package not found', {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Redirect to actual download URL
    console.log(`Proxying ${poolPath} -> ${downloadUrl}`);
    return Response.redirect(downloadUrl, 302);
  } catch (error) {
    console.error('Error handling pool proxy:', error);
    return new Response('Error proxying package download', {
      status: 500,
      headers: corsHeaders,
    });
  }
}
