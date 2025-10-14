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

### Other Package Formats

This proxy currently supports **APT repositories** (Repository #1). Support for other package formats (RPM, Pacman, etc.) may be added in the future based on community needs.

To request support for additional package formats, please [open an issue on GitHub](https://github.com/beerisgood/proton-repo-proxy/issues).

## Response Formats

All endpoints return appropriate content types:

- APT endpoints: `text/plain`
- Health check: `application/json`

## Notes

- Only AMD64 architecture is supported (Proton packages are amd64-only)
- All requests are cached for optimal performance
- The service acts as an intelligent proxy to official Proton repositories
