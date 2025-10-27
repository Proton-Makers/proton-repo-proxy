#!/bin/bash
set -euo pipefail

PROXY_URL="https://proton-repo-proxy.baxyz.workers.dev/apt"

echo "🔧 Setting up Proton APT repository for testing..."
echo ""

# 1. Add repository
echo "📝 Adding repository to sources.list.d..."
echo "deb [trusted=yes] $PROXY_URL stable main" | sudo tee /etc/apt/sources.list.d/proton-repo-proxy.list

# 2. First apt update
echo ""
echo "📥 Running apt update (first time)..."
sudo apt update 2>&1 | grep -i proton || true

# 3. Check policy
echo ""
echo "📊 Checking apt policy for proton packages..."
apt-cache policy proton-mail proton-pass 2>&1 || true

# 4. Second apt update (to see if it changes)
echo ""
echo "📥 Running apt update (second time)..."
sudo apt update 2>&1 | grep -i proton || true

# 5. Check if upgrade wants to do something
echo ""
echo "🔍 Checking what apt upgrade wants to do..."
sudo apt list --upgradable 2>&1 | grep proton || echo "No proton packages to upgrade"

echo ""
echo "✅ Test complete"
