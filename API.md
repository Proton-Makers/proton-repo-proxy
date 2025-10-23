# API Reference

## Endpoints

### Health Check

- **Method**: GET
- **URL**: `/`
- **Description**: Health check and service information

### APT Repository

#### GPG-Signed Release Metadata

🔐 **This repository is GPG-signed for security and authenticity verification.**

- **Method**: GET
- **URL**: `/apt/dists/stable/InRelease`
- **Description**: GPG-signed APT release metadata (clearsigned, recommended)
- **Content-Type**: `text/plain`

- **Method**: GET
- **URL**: `/apt/dists/stable/Release`
- **Description**: APT release metadata (unsigned)
- **Content-Type**: `text/plain`

- **Method**: GET
- **URL**: `/apt/dists/stable/Release.gpg`
- **Description**: Detached GPG signature for Release file
- **Content-Type**: `application/pgp-signature`

#### GPG Public Key

- **Method**: GET
- **URL**: `/apt/public.gpg.key`
- **Description**: Public GPG key for repository verification
- **Alias**: `/apt/KEY.gpg`
- **Content-Type**: `application/pgp-keys`

**Usage**:
```bash
curl -fsSL https://proton-repo-proxy.baxyz.workers.dev/apt/public.gpg.key | \
  sudo gpg --dearmor -o /usr/share/keyrings/proton-repo-proxy.gpg
```

#### Package Lists

- **Method**: GET
- **URL**: `/apt/dists/stable/main/binary-amd64/Packages`
- **Description**: APT packages for AMD64 architecture
- **Content-Type**: `text/plain`

#### Architecture Release

- **Method**: GET
- **URL**: `/apt/dists/stable/main/binary-amd64/Release`
- **Description**: APT release metadata for specific architecture
- **Content-Type**: `text/plain`

### Other Package Formats

This proxy currently supports **APT repositories** (Repository #1). Support for other package formats (RPM, Pacman, etc.) may be added in the future based on community needs.

To request support for additional package formats, please [open an issue on GitHub](https://github.com/Proton-Makers/proton-repo-proxy/issues).

## Response Formats

All endpoints return appropriate content types:

- APT metadata: `text/plain`
- GPG signatures: `application/pgp-signature`
- GPG keys: `application/pgp-keys`
- Health check: `application/json`

## Security

### GPG Signature Verification

All APT repository metadata is cryptographically signed with GPG:

1. **InRelease**: Clearsigned Release file (recommended by APT)
2. **Release.gpg**: Detached signature for legacy compatibility
3. **Public Key**: Distributed via `/apt/public.gpg.key`

**Benefits**:
- ✅ Authenticity verification
- ✅ Integrity protection
- ✅ MITM attack prevention
- ✅ APT native signature checking

**Setup**:
See [APT GPG Setup Guide](docs/APT_GPG_SETUP.md) for detailed instructions.

### Caching

All metadata is cached at the edge for optimal performance while maintaining security through GPG signatures.

## Notes

- Only AMD64 architecture is supported (Proton packages are amd64-only)
- All requests are cached for optimal performance
- The service acts as an intelligent proxy to official Proton repositories
- GPG signatures generated automatically via GitHub Actions CI/CD
