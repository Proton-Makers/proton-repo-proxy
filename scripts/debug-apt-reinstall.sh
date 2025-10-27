#!/bin/bash
set -euo pipefail

PROXY_URL="https://proton-repo-proxy.baxyz.workers.dev/apt"
OUTPUT_DIR="/tmp/apt-debug-$(date +%s)"

echo "🔍 APT Reinstallation Debug Script"
echo "==================================="
echo "Output directory: $OUTPUT_DIR"
echo ""

mkdir -p "$OUTPUT_DIR"

# 1. Fetch current Packages file twice to check for determinism
echo "📥 Fetching Packages file (run 1)..."
curl -fsSL "$PROXY_URL/dists/stable/main/binary-amd64/Packages" > "$OUTPUT_DIR/Packages.run1"

echo "⏳ Waiting 2 seconds..."
sleep 2

echo "📥 Fetching Packages file (run 2)..."
curl -fsSL "$PROXY_URL/dists/stable/main/binary-amd64/Packages" > "$OUTPUT_DIR/Packages.run2"

echo ""
echo "📊 Comparing Packages files..."
if diff -u "$OUTPUT_DIR/Packages.run1" "$OUTPUT_DIR/Packages.run2" > "$OUTPUT_DIR/Packages.diff"; then
    echo "✅ Packages files are identical (deterministic)"
else
    echo "❌ Packages files differ!"
    echo "Diff saved to: $OUTPUT_DIR/Packages.diff"
    head -20 "$OUTPUT_DIR/Packages.diff"
fi

# 2. Fetch Release file twice to check for determinism
echo ""
echo "📥 Fetching Release file (run 1)..."
curl -fsSL "$PROXY_URL/dists/stable/Release" > "$OUTPUT_DIR/Release.run1"

echo "⏳ Waiting 2 seconds..."
sleep 2

echo "📥 Fetching Release file (run 2)..."
curl -fsSL "$PROXY_URL/dists/stable/Release" > "$OUTPUT_DIR/Release.run2"

echo ""
echo "📊 Comparing Release files..."
if diff -u "$OUTPUT_DIR/Release.run1" "$OUTPUT_DIR/Release.run2" > "$OUTPUT_DIR/Release.diff"; then
    echo "✅ Release files are identical (deterministic)"
else
    echo "❌ Release files differ!"
    echo "Diff saved to: $OUTPUT_DIR/Release.diff"
    cat "$OUTPUT_DIR/Release.diff"
fi

# 3. Show package entries
echo ""
echo "📦 Package entries from Packages file:"
echo "======================================"
grep -A 15 "^Package: proton-" "$OUTPUT_DIR/Packages.run1" || true

# 4. Check if local APT lists exist
echo ""
echo "🔍 Checking local APT lists..."
APT_LISTS=$(find /var/lib/apt/lists/ -name "*proton-repo-proxy*Packages" 2>/dev/null || true)
if [ -n "$APT_LISTS" ]; then
    echo "Found local APT lists:"
    echo "$APT_LISTS"
    
    for list in $APT_LISTS; do
        echo ""
        echo "📄 Content of $list:"
        grep -A 15 "^Package: proton-" "$list" || true
    done
else
    echo "⚠️  No local APT lists found (run 'apt update' first)"
fi

echo ""
echo "✅ Investigation complete"
echo "📁 Results saved in: $OUTPUT_DIR"
echo ""
echo "To analyze further:"
echo "  cat $OUTPUT_DIR/Packages.diff"
echo "  cat $OUTPUT_DIR/Release.diff"
