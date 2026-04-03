---
title: claude-warmup
---

# claude-warmup

A production-grade Node.js HTTP server that returns a persistent request counter backed by Redis, deployed on Kubernetes.

## Documentation

- [Overview](overview.md) — Architecture, features, endpoints, tech stack
- [Local Development](local-development.md) — Run with Node.js, Docker, or k3d
- [Deployment](deployment.md) — Production Kubernetes deployment, secret management, security hardening
- [Security & Testing](security-and-testing.md) — Security audit results, test strategy, CI pipeline
- [Release Flow](release-flow.md) — How to cut a release, versioned images, manifest assets, release notes

## Quick start

```bash
k3d cluster create claude-warmup --wait
kubectl create secret generic redis-credentials \
  --from-literal=redis-password=$(openssl rand -base64 24)
kubectl apply -f k8s/
kubectl port-forward svc/claude-warmup 8080:80
curl http://localhost:8080
```

[GitHub Repository](https://github.com/pPrecel/claude-warmup)
