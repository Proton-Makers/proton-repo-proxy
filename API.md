# API Reference

## Endpoints

### Health Check

- **Method**: GET
- **URL**: `/`
- **Description**: Health check and service information

### APT Repository

#### Release Metadata

- **Method**: GET
- **URL**: `/apt/dists/stable/Release`
- **Description**: APT release metadata

**Note**: InRelease endpoint is intentionally not provided to avoid GPG signature complexities. APT will fall back to using Release + Release.gpg (Release.gpg returns 404, which is acceptable for `[trusted=yes]` repositories).

#### Package Lists

- **Method**: GET
- **URL**: `/apt/dists/stable/main/binary-amd64/Packages`
- **Description**: APT packages for AMD64 architecture

#### Architecture Release

- **Method**: GET
- **URL**: `/apt/dists/stable/main/binary-amd64/Release`
- **Description**: APT release metadata for specific architecture

### RPM Repository

#### Repository Metadata

- **Method**: GET
- **URL**: `/rpm/repodata/repomd.xml`
- **Description**: RPM repository metadata

## Response Formats

All endpoints return appropriate content types:

- APT endpoints: `text/plain`
- RPM endpoints: `text/xml`
- Health check: `application/json`

## Notes

- Only AMD64 architecture is supported (Proton packages are amd64-only)
- All requests are cached for optimal performance
- The service acts as an intelligent proxy to official Proton repositories
