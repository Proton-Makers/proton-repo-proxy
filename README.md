# Proton Repository Proxy

A modern APT/RPM repository proxy for Proton applications, built with TypeScript and Cloudflare Workers.

🌐 **Live Service**: <https://proton-repo-proxy.baxyz.workers.dev/>  
📚 **Documentation**: <https://proton-makers.github.io/proton-repo-proxy/>

## ✨ Features

- **Intelligent proxy**: 302 redirects to official Proton URLs
- **High-performance cache**: Metadata caching with Cloudflare KV
- **Multi-format support**: APT (.deb) and RPM (.rpm) packages
- **Modern architecture**: Strict TypeScript, Cloudflare Workers
- **Robust validation**: Zod schemas for data validation
- **REST API**: Endpoints for introspection and management
- **Automated deployment**: CI/CD with GitHub Actions
- **Code quality**: Biome for linting and formatting

## 🏗️ Architecture

```
├── src/
│   ├── types.ts           # TypeScript types and Zod schemas
│   ├── worker.ts          # Main Cloudflare Worker
│   └── lib/
│       ├── proton.ts      # Proton API integration
│       ├── apt.ts         # APT metadata generation
│       └── rpm.ts         # RPM metadata generation
├── .github/workflows/     # GitHub Actions CI/CD
├── package.json           # Project configuration
├── tsconfig.json          # TypeScript configuration
├── wrangler.toml          # Cloudflare Workers configuration
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Cloudflare account with Workers enabled
- Wrangler CLI installed

### Installation

```bash
# Clone the repository
git clone git@github.com:baxyz/proton-repo-proxy.git
cd proton-repo-proxy

# Enable corepack for pnpm
corepack enable

# Install dependencies
pnpm install

# Type check
pnpm run typecheck

# Format code
pnpm run format
```

### Cloudflare Configuration

1. **Create KV namespace**:

```bash
npx wrangler kv:namespace create "KV"
npx wrangler kv:namespace create "KV" --preview
```

2. **Configure environment variables**:

```bash
# Update wrangler.toml with your IDs
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_KV_NAMESPACE_ID="your-kv-id"
export CLOUDFLARE_KV_PREVIEW_ID="your-preview-id"
```

3. **Deploy**:

```bash
# Development
pnpm run deploy:dev

# Production
pnpm run deploy:prod
```

## 🌐 Live Service Usage

The service is deployed and ready to use at: **<https://proton-repo-proxy.baxyz.workers.dev/>**

### Health Check

```bash
curl https://proton-repo-proxy.baxyz.workers.dev/
# Returns: {"status":"ok","service":"proton-repo-proxy","version":"2.0.0","timestamp":"..."}
```

### APT Repository Usage

Add to your `/etc/apt/sources.list.d/proton.list`:

```bash
deb [trusted=yes] https://proton-repo-proxy.baxyz.workers.dev/apt stable main
```

### RPM Repository Usage

Add to your `/etc/yum.repos.d/proton.repo`:

```ini
[proton]
name=Proton Repository
baseurl=https://proton-repo-proxy.baxyz.workers.dev/rpm
enabled=1
gpgcheck=0
```

## 📋 API Endpoints

### APT Repositories

```
GET /apt/dists/stable/main/binary-amd64/Packages
GET /apt/dists/stable/main/binary-arm64/Packages
GET /apt/dists/stable/Release
```

### RPM Repositories

```
GET /rpm/repodata/repomd.xml
GET /rpm/repodata/primary.xml.gz
GET /rpm/repodata/filelists.xml.gz
GET /rpm/repodata/other.xml.gz
```

### Package Downloads

```
GET /packages/{filename}          # 302 redirect to Proton
GET /apt/pool/main/{filename}     # Legacy redirect
GET /rpm/rpms/{filename}          # Legacy redirect
```

### Management API

```
GET /api/packages                 # List all packages
GET /api/status                   # Service statistics
POST /api/cache/clear             # Clear cache
```

## 🔧 Usage

### Configure APT (Debian/Ubuntu)

```bash
# Add GPG key (if signing enabled)
curl -fsSL https://your-worker.workers.dev/pubkey.gpg | sudo apt-key add -

# Add repository
echo "deb https://your-worker.workers.dev/apt stable main" | sudo tee /etc/apt/sources.list.d/proton.list

# Update and install
sudo apt update
sudo apt install proton-mail proton-pass
```

### Configure RPM (RHEL/Fedora/CentOS)

```bash
# Create configuration file
sudo tee /etc/yum.repos.d/proton.repo << EOF
[proton]
name=Proton Repository
baseurl=https://your-worker.workers.dev/rpm
enabled=1
gpgcheck=0
EOF

# Install packages
sudo dnf install proton-mail proton-pass
```

## 🛠️ Development

### Code Structure

- **`src/types.ts`**: TypeScript definitions and Zod schemas
- **`src/worker.ts`**: Main Worker handler
- **`src/lib/proton.ts`**: Proton data fetching
- **`src/lib/apt.ts`**: APT metadata generation
- **`src/lib/rpm.ts`**: RPM metadata generation

### Available Scripts

```bash
pnpm run typecheck      # Type checking
pnpm run lint           # ESLint linting
pnpm run lint:fix       # Fix linting issues
pnpm run format         # Prettier formatting
pnpm run format:check   # Check formatting
pnpm run build          # Build for production
pnpm run deploy:dev     # Deploy to development
pnpm run deploy:prod    # Deploy to production
pnpm run test           # Run tests
pnpm run test:watch     # Run tests in watch mode
```

### Local Testing

```bash
# Start development server
pnpm run dev

# Test endpoints
curl http://localhost:8787/api/status
curl http://localhost:8787/apt/dists/stable/Release
```

## 🔐 Security

### Secret Management

GPG keys (optional) are managed via Wrangler secrets:

```bash
# Set secrets
npx wrangler secret put GPG_PRIVATE_KEY
npx wrangler secret put GPG_PASSPHRASE
```

### Environment Variables

- `BASE_URL`: Service base URL
- `GPG_PRIVATE_KEY`: GPG private key (optional)
- `GPG_PASSPHRASE`: GPG passphrase (optional)

## 📊 Monitoring

### Cloudflare Metrics

The service uses Cloudflare Analytics for monitoring:

- Requests per second
- Average latency
- Error rate
- Cache utilization

### Logs

Detailed logs available via Cloudflare Workers Logs:

```bash
npx wrangler tail
```

## 🚨 Troubleshooting

### Common Issues

1. **Cache errors**: Clear cache via `/api/cache/clear`
2. **High latency**: Check KV configuration
3. **500 errors**: Check Cloudflare logs

### Debugging

```bash
# Real-time logs
npx wrangler tail --format pretty

# Test endpoints
curl -v https://your-worker.workers.dev/api/status
```

## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Standards

- Strict TypeScript enabled
- ESLint + Prettier for formatting
- Unit tests required for new features
- Documentation for public functions

## 📄 License

This project is licensed under the AGPL-3.0 License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Proton AG](https://proton.me/) for their excellent applications
- [Cloudflare Workers](https://workers.cloudflare.com/) for the platform
- The open source community for the tools used

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/baxyz/proton-repo-proxy/issues)
- **Discussions**: [GitHub Discussions](https://github.com/baxyz/proton-repo-proxy/discussions)

---

**Note**: This project is not officially affiliated with Proton AG. It's a community proxy to facilitate Proton application installation.

## 📋 TODO List

### 🔧 Git & Repository Setup

- [ ] Add Git remote origin with SSH: `git remote set-url origin git@github.com:baxyz/proton-repo-proxy.git`
- [ ] Initialize Git repository: `git init` (if not done)
- [ ] Make initial commit with all project files
- [ ] Push to GitHub repository
- [ ] Set up branch protection rules on main branch
- [ ] Configure GitHub repository settings (description, topics, etc.)

### 🏗️ GitHub Configuration

- [ ] Create GitHub repository secrets for Cloudflare deployment:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `GPG_PRIVATE_KEY` (optional)
  - `GPG_PASSPHRASE` (optional)
- [ ] Configure GitHub Actions permissions
- [ ] Set up issue templates
- [ ] Create pull request template
- [ ] Configure repository labels
- [ ] Set up GitHub Pages (if needed for documentation)

### ☁️ Cloudflare Setup

- [ ] Create Cloudflare Workers account
- [ ] Set up KV namespaces:
  - Production namespace
  - Preview/staging namespace
- [ ] Configure custom domain (optional)
- [ ] Set up Cloudflare Analytics
- [ ] Configure rate limiting rules
- [ ] Set up monitoring and alerting
- [ ] Test deployment environments

### 📝 Documentation

- [ ] Complete API documentation with OpenAPI/Swagger spec
- [ ] Add code examples for different package managers
- [ ] Create troubleshooting guide
- [ ] Write deployment guide
- [ ] Add architecture diagrams
- [ ] Document configuration options
- [ ] Create contribution guidelines

### 🧪 Testing & Quality

- [ ] Set up unit tests with Vitest
- [ ] Add integration tests for Worker endpoints
- [ ] Set up test coverage reporting
- [ ] Add API endpoint tests
- [ ] Create performance benchmarks
- [ ] Set up automated testing in CI/CD
- [ ] Add security vulnerability scanning

### 🚀 Development & Features

- [ ] Complete GPG signing implementation
- [ ] Add support for multiple Proton applications
- [ ] Implement rate limiting and DDoS protection
- [ ] Add metrics and analytics collection
- [ ] Optimize cache invalidation strategies
- [ ] Add health check endpoints
- [ ] Implement graceful error handling
- [ ] Add request logging and monitoring

### 🔒 Security & Compliance

- [ ] Security audit of the codebase
- [ ] Set up dependency vulnerability scanning
- [ ] Implement proper CORS configuration
- [ ] Add request validation middleware
- [ ] Set up security headers
- [ ] Review and test secret management
- [ ] Document security practices

### 📊 Monitoring & Operations

- [ ] Set up Cloudflare Workers Analytics
- [ ] Configure log aggregation
- [ ] Set up alerting for service issues
- [ ] Create operational runbooks
- [ ] Set up performance monitoring
- [ ] Configure backup strategies for KV data
- [ ] Plan disaster recovery procedures

### 🎯 Performance Optimization

- [ ] Optimize Worker startup time
- [ ] Implement intelligent caching strategies
- [ ] Minimize bundle size
- [ ] Add edge caching optimizations
- [ ] Benchmark and optimize API responses
- [ ] Implement request/response compression

### 🌐 Production Readiness

- [ ] Load testing and capacity planning
- [ ] Set up staging environment
- [ ] Configure production deployment pipeline
- [ ] Create rollback procedures
- [ ] Set up status page
- [ ] Plan maintenance windows
- [ ] Document operational procedures
