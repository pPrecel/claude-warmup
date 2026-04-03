# Release Flow

## Overview

Releases are triggered by pushing a `v*` git tag. The release workflow builds and publishes a versioned Docker image, bundles all Kubernetes manifests into a single deployable file, generates release notes from the git log, and creates a GitHub Release with the manifests as a downloadable asset.

## Creating a release

```bash
git tag v1.0.0
git push origin v1.0.0
```

That's it. The rest is automated.

## What the workflow does

```
push v* tag
      │
      ▼
  build job
  ├─ npm audit --audit-level=high
  ├─ docker build
  └─ push to GHCR:
       ghcr.io/pprecel/claude-warmup:v1.0.0
       ghcr.io/pprecel/claude-warmup:latest
      │
      ├──────────────────────┐
      ▼                      ▼
  scan job              release job
  Trivy CRITICAL/HIGH   (runs only if scan passes)
                        ├─ bundle k8s manifests → manifests.yaml
                        │  (image tag replaced with vX.Y.Z)
                        ├─ generate release notes from git log
                        └─ create GitHub Release
                             assets: manifests.yaml
```

The `release` job only runs if both `build` and `scan` pass — a release is never created from a vulnerable image.

## Release assets

Each GitHub Release includes:

- **`manifests.yaml`** — all Kubernetes manifests bundled into a single file, with the deployment image tag set to the release version (e.g. `ghcr.io/pprecel/claude-warmup:v1.0.0`). Ready to apply directly with `kubectl apply -f manifests.yaml`.

> `secret.yaml` is intentionally excluded. The Redis credentials secret must be created separately — see [deployment.md](deployment.md).

## Release notes

Release notes are auto-generated from commits since the previous tag, categorised by prefix:

| Category | Matched commit prefixes |
|----------|------------------------|
| Features | `add`, `feat`, `new` |
| Bug Fixes | `fix`, `bug`, `patch` |
| Security | `sec`, `cve`, `vuln`, `auth`, `rbac`, `policy` |
| Documentation | `doc`, `readme`, `claude` |
| CI/CD | `ci`, `build`, `workflow`, `pipeline`, `trivy`, `scan`, `test`, `integr` |
| Other | anything else |

Each entry links to its commit SHA. The notes also include the image reference and deployment instructions.

## Deploying a release

```bash
# 1. Create the Redis secret (first time only)
kubectl create secret generic redis-credentials \
  --from-literal=redis-password=$(openssl rand -base64 24)

# 2. Apply latest release manifests
kubectl apply -f https://github.com/pPrecel/claude-warmup/releases/latest/download/manifests.yaml

# 3. Verify
kubectl rollout status deployment/redis
kubectl rollout status deployment/claude-warmup
```

To pin to a specific version, replace `latest/download` with `download/vX.Y.Z`.

## Versioning convention

Use [Semantic Versioning](https://semver.org): `vMAJOR.MINOR.PATCH`

| Change | Version bump |
|--------|-------------|
| Breaking change | MAJOR (`v2.0.0`) |
| New feature, backwards-compatible | MINOR (`v1.1.0`) |
| Bug fix, security patch | PATCH (`v1.0.1`) |
