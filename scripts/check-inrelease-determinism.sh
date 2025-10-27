#!/bin/bash
set -euo pipefail

echo "🔍 Testing InRelease determinism with multiple fetches"
echo "========================================================"
echo ""

URL="https://proton-repo-proxy.baxyz.workers.dev/apt/dists/stable/InRelease"
OUTPUT_DIR="/tmp/inrelease-test-$(date +%s)"
mkdir -p "$OUTPUT_DIR"

echo "Fetching InRelease 10 times with 1 second between each..."
echo ""

for i in {1..10}; do
    echo -n "Fetch $i... "
    curl -fsSL "$URL" > "$OUTPUT_DIR/InRelease-$i.txt"
    SIZE=$(wc -c < "$OUTPUT_DIR/InRelease-$i.txt")
    MD5=$(md5sum "$OUTPUT_DIR/InRelease-$i.txt" | cut -d' ' -f1)
    echo "Size: $SIZE bytes, MD5: $MD5"
    sleep 1
done

echo ""
echo "Comparing all files..."
echo ""

FIRST_MD5=$(md5sum "$OUTPUT_DIR/InRelease-1.txt" | cut -d' ' -f1)
ALL_SAME=true

for i in {2..10}; do
    CURRENT_MD5=$(md5sum "$OUTPUT_DIR/InRelease-$i.txt" | cut -d' ' -f1)
    if [ "$FIRST_MD5" != "$CURRENT_MD5" ]; then
        echo "❌ File $i differs from file 1!"
        echo "   Diff:"
        diff -u "$OUTPUT_DIR/InRelease-1.txt" "$OUTPUT_DIR/InRelease-$i.txt" | head -20
        ALL_SAME=false
    fi
done

if [ "$ALL_SAME" = true ]; then
    echo "✅ All 10 fetches are IDENTICAL - perfectly deterministic!"
    echo ""
    echo "Content of InRelease:"
    echo "===================="
    cat "$OUTPUT_DIR/InRelease-1.txt"
else
    echo ""
    echo "❌ Files differ - NOT deterministic!"
    echo "This is the root cause of your APT reinstallation problem."
fi

echo ""
echo "Files saved in: $OUTPUT_DIR"
