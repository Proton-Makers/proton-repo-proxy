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

#### InRelease Metadata

- **Method**: GET
- **URL**: `/apt/dists/stable/InRelease`
- **Description**: APT InRelease metadata with GPG signature

#### Package Lists

- **Method**: GET
- **URL**: `/apt/dists/stable/main/binary-amd64/Packages`
- **Description**: APT packages for AMD64 architecture

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
