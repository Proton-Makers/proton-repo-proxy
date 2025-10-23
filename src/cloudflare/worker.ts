import { PROTON_SERVER } from '../shared';
import type { Env } from './types';

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
      if (path.match(/^\/apt\/dists\/([^/]+)\/InRelease$/)) {
        return handleAptInReleaseFromKV(env, corsHeaders);
      }

      if (path.match(/^\/apt\/dists\/([^/]+)\/Release\.gpg$/)) {
        return handleAptReleaseGpgFromKV(env, corsHeaders);
      }

      if (path.match(/^\/apt\/dists\/([^/]+)\/Release$/)) {
        return handleAptReleaseFromKV(env, corsHeaders);
      }

      if (path.match(/^\/apt\/dists\/([^/]+)\/([^/]+)\/binary-([^/]+)\/Packages$/)) {
        return handleAptPackagesFromKV(env, corsHeaders);
      }

      // Arch-specific Release
      if (path.match(/^\/apt\/dists\/([^/]+)\/([^/]+)\/binary-([^/]+)\/Release$/)) {
        return handleAptArchReleaseFromKV(env, corsHeaders);
      }

      // Public GPG key
      if (path === '/apt/public.gpg.key' || path === '/apt/KEY.gpg') {
        return handleAptPublicKeyFromKV(env, corsHeaders);
      }

      // APT proxy - redirect to Proton downloads
      if (path.startsWith('/apt/proxy/')) {
        return handleAptProxyRedirect(path);
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
 * Handle APT InRelease request from KV (signed Release with inline signature)
 */
async function handleAptInReleaseFromKV(
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

    // Read pre-generated InRelease file from KV
    const inReleaseContent = await env.REPO_CACHE.get('apt-inrelease');

    if (!inReleaseContent) {
      return new Response(
        'Repository metadata not found. Please wait for GitHub CI to generate it.',
        {
          status: 404,
          headers: corsHeaders,
        }
      );
    }

    return new Response(inReleaseContent, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'max-age=3600',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Error serving InRelease from KV:', error);
    return new Response('Error loading repository metadata', {
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * Handle APT Release.gpg request from KV (detached GPG signature)
 */
async function handleAptReleaseGpgFromKV(
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

    // Read pre-generated Release.gpg file from KV
    const releaseGpgContent = await env.REPO_CACHE.get('apt-release-gpg');

    if (!releaseGpgContent) {
      return new Response(
        'Repository signature not found. Please wait for GitHub CI to generate it.',
        {
          status: 404,
          headers: corsHeaders,
        }
      );
    }

    return new Response(releaseGpgContent, {
      headers: {
        'Content-Type': 'application/pgp-signature',
        'Cache-Control': 'max-age=3600',
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Error serving Release.gpg from KV:', error);
    return new Response('Error loading repository signature', {
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * Handle APT public GPG key request from KV
 */
async function handleAptPublicKeyFromKV(
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

    // Read public GPG key from KV
    const publicKeyContent = await env.REPO_CACHE.get('apt-public-key');

    if (!publicKeyContent) {
      return new Response(
        'Repository public key not found. Please wait for GitHub CI to generate it.',
        {
          status: 404,
          headers: corsHeaders,
        }
      );
    }

    return new Response(publicKeyContent, {
      headers: {
        'Content-Type': 'application/pgp-keys',
        'Cache-Control': 'max-age=86400', // Cache for 24 hours
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Error serving public GPG key from KV:', error);
    return new Response('Error loading repository public key', {
      status: 500,
      headers: corsHeaders,
    });
  }
}

/**
 * Handle APT proxy redirect - redirect /apt/proxy/* to https://proton.me/*
 * Example: /apt/proxy/download/mail/linux/1.9.1/file.deb -> https://proton.me/download/mail/linux/1.9.1/file.deb
 */
function handleAptProxyRedirect(path: string): Response {
  // Remove /apt/proxy/ prefix to get the path relative to proton.me
  const protonPath = path.replace(/^\/apt\/proxy\//, '');
  const protonUrl = PROTON_SERVER + protonPath;

  console.log(`Redirecting ${path} -> ${protonUrl}`);
  return Response.redirect(protonUrl, 302);
}
