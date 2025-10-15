# Workflow Architecture

## Overview

The `update-metadata.yml` workflow is designed to efficiently manage repository metadata updates with support for multiple package formats (APT, RPM, etc.).

## Workflow Structure

```
┌─────────────────┬─────────────────┐
│ check-versions  │  check-caches   │ (parallel)
└────────┬────────┴────────┬────────┘
         └─────────────────┘
                 ↓
         update-hashes (if needed)
                 ↓
    ┌────────────┼────────────┐
    │            │            │
  update-apt  update-rpm  ... (parallel, future)
    │            │            │
    └────────────┴────────────┘
                 ↓
         finalize-update
```

## Jobs

### Phase 1: Parallel Checks

#### `check-versions`
- Detects latest Proton Mail and Pass versions
- Outputs: `mail_version`, `pass_version`, `update_needed`
- Compares with cached versions in KV

#### `check-caches`
- Verifies all KV cache states (hashes, APT, RPM)
- Outputs: `apt_needs_update`, `hashes_need_update`, `reasons`
- Independent from version check

### Phase 2: Hash Calculation

#### `update-hashes`
- Runs if: versions changed OR caches missing OR forced
- Downloads all .deb packages from Proton
- Calculates SHA256 hashes
- Uses GitHub Actions cache (key: `update-metadata-packages-{versions}`)
- Uploads `package-hashes.json` as artifact for next jobs
- **This is the only job that downloads packages** (90+ MB each)

### Phase 3: Format-Specific Updates (Parallel)

#### `update-apt`
- Downloads `package-hashes.json` artifact
- Generates APT metadata:
  - `Packages` file with pool paths
  - `Release` file with SHA256 hashes
  - Architecture-specific `Release`
  - URL mapping (pool path → Proton download URL)
- Uploads to KV:
  - `apt-packages`
  - `apt-release`
  - `apt-arch-release`
  - `apt-url-mapping`

#### `update-rpm` (Future)
- Same pattern as `update-apt`
- Generates RPM repodata XML
- Uploads to KV with `rpm-*` keys
- Structure commented in workflow

### Phase 4: Finalization

#### `finalize-update`
- Runs if **at least one** format update succeeded
- Updates `latest-versions` cache (avoids race conditions)
- Updates `last-update-timestamp`
- Generates final summary report

## Manual Triggers

### Inputs

- `force_update`: Force all updates (bypass all checks)
- `force_hashes`: Force hash recalculation only
- `force_apt`: Force APT metadata regeneration only

### Usage

```bash
# Force full update
gh workflow run update-metadata.yml --field force_update=true

# Force only APT regeneration (reuse existing hashes)
gh workflow run update-metadata.yml --field force_apt=true

# Force hash recalculation (will trigger APT update)
gh workflow run update-metadata.yml --field force_hashes=true
```

## GitHub Actions Cache

### Package Cache
- **Path**: `/tmp/proton-packages/*.deb`
- **Key**: `update-metadata-packages-{mail_version}-{pass_version}`
- **Retention**: 1 day
- **Purpose**: Avoid re-downloading 90+ MB packages

### Benefits
- Faster runs when versions haven't changed
- Reduced bandwidth usage
- Cost savings on GitHub Actions minutes

## Artifacts

### `package-hashes`
- **File**: `package-hashes.json`
- **Retention**: 1 day
- **Consumer**: `update-apt`, `update-rpm` (future)
- **Purpose**: Share hash data between jobs

## Adding New Formats

To add a new package format (e.g., Flatpak):

1. Add output to `check-caches.ts`:
   ```typescript
   flatpak_needs_update: boolean
   ```

2. Add check in `check-caches` job output

3. Copy `update-apt` job and modify:
   ```yaml
   update-flatpak:
     needs: [check-versions, check-caches, update-hashes]
     if: |
       needs.update-hashes.result == 'success' ||
       needs.check-caches.outputs.flatpak_needs_update == 'true' ||
       inputs.force_flatpak == true
   ```

4. Create generation script:
   ```bash
   src/github/generate-flatpak-metadata.ts
   src/github/upload-flatpak-metadata.ts
   ```

5. Update `finalize-update` needs:
   ```yaml
   needs: [check-versions, update-apt, update-flatpak]
   if: |
     needs.update-apt.result == 'success' ||
     needs.update-flatpak.result == 'success'
   ```

## Error Handling

- If `check-versions` fails → entire workflow stops
- If `check-caches` fails → entire workflow stops
- If `update-hashes` fails → format updates are skipped
- If `update-apt` fails but `update-rpm` succeeds → finalize runs
- If all format updates fail → finalize is skipped

## Schedule

- **Cron**: `0 6 * * *` (6 AM UTC / 8 AM Paris)
- **Manual**: Via GitHub Actions UI or `gh` CLI
- **Push**: On workflow or source file changes

## Performance

Typical run times:
- `check-versions`: ~10s
- `check-caches`: ~10s
- `update-hashes`: ~2-5min (with cache: ~30s)
- `update-apt`: ~20s
- `finalize-update`: ~10s

**Total**: ~3-6 minutes (or ~1 minute with cache hits)
