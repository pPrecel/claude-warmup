# claude-warmup

[![Build](https://github.com/pPrecel/claude-warmup/actions/workflows/build.yaml/badge.svg)](https://github.com/pPrecel/claude-warmup/actions/workflows/build.yaml)
[![Release](https://github.com/pPrecel/claude-warmup/actions/workflows/release.yaml/badge.svg)](https://github.com/pPrecel/claude-warmup/actions/workflows/release.yaml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A production-grade Node.js HTTP server that returns a persistent request counter backed by Redis, deployed on Kubernetes. Built as a reference project demonstrating secure, production-oriented deployment patterns: non-root containers, NetworkPolicy, RBAC, PersistentVolumeClaim, health probes, and automated CI/CD with vulnerability scanning.

```
curl http://localhost:8080
hello claude warmup (requests: 42)
```

## Documentation

- [Overview](docs/overview.md) — Architecture, features, endpoints, tech stack
- [Local Development](docs/local-development.md) — Run with Node.js, Docker, or k3d
- [Deployment](docs/deployment.md) — Production Kubernetes deployment, secret management, security hardening
- [Security & Testing](docs/security-and-testing.md) — Security audit results, test strategy, CI pipeline, running tests locally
- [Release Flow](docs/release-flow.md) — How to cut a release, versioned images, manifest assets, release notes

## Quick start

```bash
# Create cluster
k3d cluster create claude-warmup --wait

# Create Redis secret
kubectl create secret generic redis-credentials \
  --from-literal=redis-password=$(openssl rand -base64 24)

# Deploy
kubectl apply -f k8s/

# Test
kubectl port-forward svc/claude-warmup 8080:80
curl http://localhost:8080
```

## CI jobs

Every push to `main` runs three jobs:

| Job | Description |
|-----|-------------|
| `build` | npm audit + Docker build + push to GHCR |
| `scan` | Trivy vulnerability scan (CRITICAL/HIGH) |
| `integration-test` | Full stack deployment on k3d + assertions |

Releases (`v*` tags) additionally run a `release` job that bundles Kubernetes manifests and publishes a GitHub Release.

## License

[ISC](LICENSE)
