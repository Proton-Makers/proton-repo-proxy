#!/bin/bash
set -euo pipefail

echo "🔍 Complete APT Diagnostic Script"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROXY_URL="https://proton-repo-proxy.baxyz.workers.dev/apt"
OUTPUT_DIR="/tmp/apt-complete-diag-$(date +%s)"
mkdir -p "$OUTPUT_DIR"

echo "📁 Output directory: $OUTPUT_DIR"
echo ""

# 1. Check if repository is configured
echo "1️⃣  Checking APT configuration..."
if grep -r "proton-repo-proxy" /etc/apt/sources.list.d/ 2>/dev/null; then
    echo -e "${GREEN}✅ Repository configured${NC}"
else
    echo -e "${YELLOW}⚠️  Repository not configured in /etc/apt/sources.list.d/${NC}"
fi
echo ""

# 2. Check local APT lists
echo "2️⃣  Checking local APT cache..."
APT_LIST=$(find /var/lib/apt/lists/ -name "*proton-repo-proxy*Packages" 2>/dev/null | head -1 || true)
if [ -n "$APT_LIST" ]; then
    echo -e "${GREEN}✅ Found local list: $APT_LIST${NC}"
    
    # Extract package entries
    sed -n '/^Package: proton-mail$/,/^$/p' "$APT_LIST" > "$OUTPUT_DIR/local-mail.txt"
    sed -n '/^Package: proton-pass$/,/^$/p' "$APT_LIST" > "$OUTPUT_DIR/local-pass.txt"
    
    echo "Local proton-mail entry:"
    cat "$OUTPUT_DIR/local-mail.txt"
    echo ""
    echo "Local proton-pass entry:"
    cat "$OUTPUT_DIR/local-pass.txt"
else
    echo -e "${YELLOW}⚠️  No local APT list found${NC}"
fi
echo ""

# 3. Fetch remote Packages
echo "3️⃣  Fetching remote Packages file..."
curl -fsSL "$PROXY_URL/dists/stable/main/binary-amd64/Packages" > "$OUTPUT_DIR/remote-Packages"

# Extract package entries
sed -n '/^Package: proton-mail$/,/^$/p' "$OUTPUT_DIR/remote-Packages" > "$OUTPUT_DIR/remote-mail.txt"
sed -n '/^Package: proton-pass$/,/^$/p' "$OUTPUT_DIR/remote-Packages" > "$OUTPUT_DIR/remote-pass.txt"

echo "Remote proton-mail entry:"
cat "$OUTPUT_DIR/remote-mail.txt"
echo ""
echo "Remote proton-pass entry:"
cat "$OUTPUT_DIR/remote-pass.txt"
echo ""

# 4. Compare if local exists
if [ -n "$APT_LIST" ]; then
    echo "4️⃣  Comparing local vs remote..."
    
    echo "📦 proton-mail:"
    if diff -u "$OUTPUT_DIR/local-mail.txt" "$OUTPUT_DIR/remote-mail.txt" > "$OUTPUT_DIR/diff-mail.txt"; then
        echo -e "${GREEN}✅ Identical${NC}"
    else
        echo -e "${RED}❌ DIFFERENT!${NC}"
        cat "$OUTPUT_DIR/diff-mail.txt"
    fi
    echo ""
    
    echo "📦 proton-pass:"
    if diff -u "$OUTPUT_DIR/local-pass.txt" "$OUTPUT_DIR/remote-pass.txt" > "$OUTPUT_DIR/diff-pass.txt"; then
        echo -e "${GREEN}✅ Identical${NC}"
    else
        echo -e "${RED}❌ DIFFERENT!${NC}"
        cat "$OUTPUT_DIR/diff-pass.txt"
    fi
    echo ""
fi

# 5. Check Release file determinism
echo "5️⃣  Checking Release file determinism..."
curl -fsSL "$PROXY_URL/dists/stable/Release" > "$OUTPUT_DIR/Release-1.txt"
sleep 2
curl -fsSL "$PROXY_URL/dists/stable/Release" > "$OUTPUT_DIR/Release-2.txt"

if diff -u "$OUTPUT_DIR/Release-1.txt" "$OUTPUT_DIR/Release-2.txt" > "$OUTPUT_DIR/Release-diff.txt"; then
    echo -e "${GREEN}✅ Release file is deterministic${NC}"
else
    echo -e "${RED}❌ Release file varies between calls!${NC}"
    cat "$OUTPUT_DIR/Release-diff.txt"
fi
echo ""

# 6. Verify .deb checksums
echo "6️⃣  Verifying .deb file checksums..."

for pkg in proton-mail proton-pass; do
    echo "📦 $pkg:"
    
    # Extract metadata from remote
    PKG_FILE="$OUTPUT_DIR/remote-${pkg/proton-/}.txt"
    FILENAME=$(grep "^Filename:" "$PKG_FILE" | cut -d' ' -f2 | tr -d '[:space:]')
    SIZE=$(grep "^Size:" "$PKG_FILE" | cut -d' ' -f2 | tr -d '[:space:]')
    MD5=$(grep "^MD5sum:" "$PKG_FILE" | cut -d' ' -f2 | tr -d '[:space:]')
    SHA256=$(grep "^SHA256:" "$PKG_FILE" | cut -d' ' -f2 | tr -d '[:space:]')
    
    echo "  Filename: $FILENAME"
    echo "  Declared Size: $SIZE"
    echo "  Declared MD5: $MD5"
    echo "  Declared SHA256: $SHA256"
    
    # Download .deb
    DEB_URL="$PROXY_URL/$FILENAME"
    DEB_FILE="$OUTPUT_DIR/$pkg.deb"
    
    echo "  📥 Downloading from: $DEB_URL"
    if curl -fsSL "$DEB_URL" -o "$DEB_FILE"; then
        ACTUAL_SIZE=$(stat -f%z "$DEB_FILE" 2>/dev/null || stat -c%s "$DEB_FILE" 2>/dev/null)
        ACTUAL_MD5=$(md5sum "$DEB_FILE" | cut -d' ' -f1)
        ACTUAL_SHA256=$(sha256sum "$DEB_FILE" | cut -d' ' -f1)
        
        echo "  Actual Size: $ACTUAL_SIZE"
        echo "  Actual MD5: $ACTUAL_MD5"
        echo "  Actual SHA256: $ACTUAL_SHA256"
        
        # Compare
        if [ "$SIZE" = "$ACTUAL_SIZE" ] && [ "$MD5" = "$ACTUAL_MD5" ] && [ "$SHA256" = "$ACTUAL_SHA256" ]; then
            echo -e "  ${GREEN}✅ All checksums match!${NC}"
        else
            echo -e "  ${RED}❌ CHECKSUM MISMATCH!${NC}"
            [ "$SIZE" != "$ACTUAL_SIZE" ] && echo -e "    ${RED}Size mismatch${NC}"
            [ "$MD5" != "$ACTUAL_MD5" ] && echo -e "    ${RED}MD5 mismatch${NC}"
            [ "$SHA256" != "$ACTUAL_SHA256" ] && echo -e "    ${RED}SHA256 mismatch${NC}"
        fi
    else
        echo -e "  ${RED}❌ Failed to download .deb${NC}"
    fi
    echo ""
done

echo "✅ Diagnostic complete!"
echo "📁 All results saved in: $OUTPUT_DIR"
