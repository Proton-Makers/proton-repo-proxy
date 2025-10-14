# Proton Repository Proxy

A modern APT repository proxy for Proton applications, built with TypeScript and Cloudflare Workers.

🚀 **Live Service**: <https://proton-repo-proxy.baxyz.workers.dev/>  
📚 **Complete Documentation**: <https://proton-makers.github.io/proton-repo-proxy/>  
🔧 **API Reference**: [API.md](API.md)

> ⚠️ **Important**: This is a community project and is **not affiliated with or endorsed by Proton AG**. It redirects to official Proton repositories but is maintained independently.

## 📖 Quick Usage

**For detailed setup instructions, visit: <https://proton-makers.github.io/proton-repo-proxy/>**

### 🐧 APT Repository (Repository #1)

```bash
echo "deb [trusted=yes] https://proton-repo-proxy.baxyz.workers.dev/apt stable main" | sudo tee /etc/apt/sources.list.d/proton-repo-proxy.list
sudo apt update
```

### 📦 Other Package Formats

Currently, this proxy focuses on APT (Debian/Ubuntu). If you'd like support for other package formats (RPM for Fedora/RHEL, Pacman for Arch, etc.), feel free to:

- 🙋 **Open an issue** to request a new repository type
- 🤝 **Contribute** by submitting a pull request
- 💬 **Join the discussion** on GitHub Discussions

We're open to adding more repository types based on community needs!

## 🛠️ Development

```bash
# Clone and setup
git clone https://github.com/Proton-Makers/proton-repo-proxy.git
cd proton-repo-proxy
corepack enable && pnpm install

# Development
pnpm run typecheck  # Type checking
pnpm run lint       # Code linting  
pnpm run format     # Code formatting
pnpm run deploy     # Deploy to Cloudflare Workers
```

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**📚 For complete documentation, API reference, and troubleshooting, visit: <https://proton-makers.github.io/proton-repo-proxy/>**
