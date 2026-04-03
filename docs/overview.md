# Overview

**claude-warmup** is a Node.js HTTP server that returns `hello claude warmup (requests: N)` — where `N` is a persistent, atomically incremented request counter stored in Redis.

It is a production-grade reference application demonstrating secure Kubernetes deployment patterns: non-root containers, read-only filesystems, NetworkPolicy, RBAC, persistent storage, health probes, and automated CI/CD with vulnerability scanning.

## Features

- HTTP server on port 3000 with structured JSON logging
- Request counter persisted in Redis via `INCR` — survives pod restarts
- Password-authenticated Redis connection
- `/healthz` health check endpoint
- HTTP security headers on all responses
- Kubernetes-native: probes, resource limits, multi-replica, PVC

## Architecture

```
                        ┌──────────────────────────────┐
  HTTP :80              │       Kubernetes Cluster      │
 ──────────────────────▶│                              │
                        │  Service: claude-warmup       │
                        │  (ClusterIP, port 80→3000)   │
                        │           │                   │
                        │    ┌──────┴──────┐            │
                        │    │  Pod (×2)   │            │
                        │    │ claude-warmup│           │
                        │    │  :3000      │            │
                        │    └──────┬──────┘            │
                        │           │ REDIS_PASSWORD    │
                        │           ▼                   │
                        │  Service: redis               │
                        │  (ClusterIP, port 6379)       │
                        │           │                   │
                        │    ┌──────┴──────┐            │
                        │    │  Pod (×1)   │            │
                        │    │   Redis 7   │            │
                        │    │  + PVC 1Gi  │            │
                        │    └─────────────┘            │
                        └──────────────────────────────┘
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Returns `hello claude warmup (requests: N)` |
| `GET` | `/healthz` | Returns `ok` — used by Kubernetes probes |
| `*` | `/*` | Returns `404 not found` |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 (alpine) |
| Cache/DB | Redis 7 (alpine) |
| Orchestration | Kubernetes (k3d for local) |
| Registry | GitHub Container Registry (GHCR) |
| CI/CD | GitHub Actions |
| Image scanning | Trivy (aquasecurity) |
