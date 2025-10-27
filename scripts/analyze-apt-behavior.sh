#!/bin/bash
set -euo pipefail

echo "🔍 Analyzing APT behavior in detail"
echo "===================================="
echo ""

# Check sources.list configuration
echo "1️⃣  APT Source Configuration:"
cat /etc/apt/sources.list.d/proton-repo-proxy.list 2>/dev/null || echo "File not found"
echo ""

# Simulate apt update with debug
echo "2️⃣  Running apt update with debug output..."
echo ""
sudo apt-get update -o Debug::Acquire::http=true -o Debug::pkgAcquire::Worker=true 2>&1 | grep -A10 -B10 "proton-repo-proxy" || true
echo ""

# Check what apt thinks needs upgrading
echo "3️⃣  Packages that APT thinks need upgrade:"
apt list --upgradable 2>/dev/null | grep proton || echo "No proton packages need upgrade"
echo ""

# Detailed policy
echo "4️⃣  Detailed policy for proton-mail:"
apt-cache policy proton-mail
echo ""

# Check installed package info
echo "5️⃣  Installed package details:"
dpkg -s proton-mail | grep -E "^(Package|Version|Status|Size|MD5sum|SHA256):" || true
echo ""

# Check if there's a .deb in cache
echo "6️⃣  APT cache for proton packages:"
ls -lh /var/cache/apt/archives/proton-* 2>/dev/null || echo "No cached .deb files"
echo ""

# Simulate upgrade
echo "7️⃣  Simulating upgrade to see what APT wants to do:"
sudo apt-get -s upgrade 2>&1 | grep -A5 proton || echo "No proton packages in upgrade simulation"
