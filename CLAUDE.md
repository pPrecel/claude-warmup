# claude-warmup

A Node.js HTTP server that returns `hello claude warmup (requests: N)` where N is a persistent request counter stored in Redis.

## Architecture

- **`index.js`** — HTTP server on port 3000. Routes: `GET /` (counter), `GET /healthz` (health check), 404 for everything else.
- **Redis** — stores the `request_count` key via `INCR`. Password-authenticated.
- **Kubernetes** — deployed on k3d locally or any k8s cluster. All manifests in `k8s/`.

## Local development

```bash
node index.js          # requires Redis running at redis:6379 or set REDIS_HOST/REDIS_PASSWORD
```

## Running locally on k3d

```bash
k3d cluster create claude-warmup --wait

# Create the secret (never commit secret.yaml — see k8s/secret.yaml.example)
cp k8s/secret.yaml.example k8s/secret.yaml
# edit k8s/secret.yaml with your base64-encoded password

kubectl apply -f k8s/
kubectl rollout status deployment/redis
kubectl rollout status deployment/claude-warmup

kubectl port-forward svc/claude-warmup 8080:80
curl http://localhost:8080
```

## Kubernetes manifests (`k8s/`)

| File | Purpose |
|------|---------|
| `deployment.yaml` | App deployment (2 replicas, probes, securityContext, RBAC SA) |
| `service.yaml` | ClusterIP service, port 80 → 3000 |
| `redis.yaml` | Redis deployment + PVC (1Gi) + ClusterIP service |
| `secret.yaml.example` | Template — copy to `secret.yaml` and fill in password |
| `network-policy.yaml` | Ingress: only app→redis on 6379. Egress: app→DNS+redis only |
| `rbac.yaml` | ServiceAccount + Role + RoleBinding for the app |

> `k8s/secret.yaml` is gitignored. Never commit it.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PASSWORD` | *(none)* | Redis password (from Kubernetes Secret) |

## CI/CD (`.github/workflows/build.yaml`)

Three jobs on push to `main` or version tags:

1. **`build`** — npm audit → build → push to `ghcr.io/pprecel/claude-warmup:{sha,latest}`
2. **`scan`** — Trivy vulnerability scan (CRITICAL/HIGH, uses `.trivyignore` for npm tooling CVEs)
3. **`integration-test`** — spins up k3d, deploys full stack, verifies counter and Redis auth

Requires GitHub Secret: `TEST_REDIS_PASSWORD`

## Security decisions

- Redis password stored in Kubernetes Secret (`redis-credentials`), never in code or manifests
- Container runs as non-root (`USER node`)
- `securityContext`: `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true` (app), `capabilities.drop: ALL`
- NetworkPolicy restricts Redis ingress to app pods only; egress policy blocks all except DNS+Redis (removed in integration test — k3d doesn't enforce it correctly)
- RBAC: dedicated ServiceAccount with empty Role (no k8s API access needed)
- HTTP security headers on all responses: `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`

## Known constraints

- `app-egress` NetworkPolicy is deleted in integration test because k3d's CNI doesn't enforce it correctly — it is present in production manifests
- Redis runs as root (`runAsNonRoot: false`) because the official `redis:7-alpine` image requires root
- `.trivyignore` suppresses CVEs in npm's own bundled tooling (not app runtime deps)
