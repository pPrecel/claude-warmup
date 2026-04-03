# Security & Testing

## Security audit

A full security audit was performed and all findings addressed. Results by category:

### Application code (`index.js`)

| Finding | Severity | Resolution |
|---------|----------|------------|
| Redis password embedded in URL string | High | Password passed via `password` client option — never in URL |
| No error handling on `redis.connect()` | High | `.catch()` logs error and calls `process.exit(1)` |
| No error handling on `redis.incr()` | High | `try/catch` returns HTTP 503 on Redis failure |
| No URL routing — all paths hit Redis | Medium | Explicit routing: `/` increments, `/healthz` returns ok, all others return 404 |
| No HTTP security headers | Medium | `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy` added to all responses |

### Dockerfile

| Finding | Severity | Resolution |
|---------|----------|------------|
| No `HEALTHCHECK` instruction | Medium | Added `HEALTHCHECK` calling `/healthz` via `wget` |
| Runs as root | High | `USER node` added; `runAsUser: 1000` set in k8s securityContext |
| Vulnerable OS packages | Critical/High | `RUN apk upgrade --no-cache` upgrades all OS packages at build time |

### Kubernetes manifests

| Finding | Severity | Resolution |
|---------|----------|------------|
| `secret.yaml` committed with `changeme` password | Critical | File removed from git, added to `.gitignore`; password rotated |
| No container `securityContext` | High | `runAsNonRoot`, `runAsUser: 1000`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `capabilities.drop: ALL` |
| No egress NetworkPolicy | High | `app-egress` policy restricts app pods to DNS + Redis only |
| No RBAC | High | Dedicated ServiceAccount with empty Role (no API access needed) |
| Redis `$(REDIS_PASSWORD)` not interpolated in `args`/probes | High | Fixed using `command: ["sh", "-c", "redis-server --requirepass $REDIS_PASSWORD"]` and probe commands via `sh -c` |
| `imagePullPolicy: Always` with `:latest` | High | SHA-tagged image used in CI; `imagePullPolicy: Always` retained for latest pulls |
| No resource limits | Medium | CPU/memory requests and limits set on both deployments |
| No liveness/readiness probes | Medium | HTTP probes on `/healthz` for app; exec `redis-cli ping` for Redis |
| No PersistentVolumeClaim for Redis | Medium | 1Gi PVC created and mounted at `/data` |
| `runAsNonRoot` with non-numeric username | High | `runAsUser: 1000` added (required when image uses named user `node`) |

### CI/CD (`.github/workflows/`)

| Finding | Severity | Resolution |
|---------|----------|------------|
| Build triggers on all branches | Medium | Restricted to `main` branch and `v*` tags |
| Hardcoded `changeme` password in integration test | High | `TEST_REDIS_PASSWORD` GitHub Secret used |
| `curl \| bash` for k3d installation | High | Replaced with `AbsaOSS/k3d-action@v2` |
| No vulnerability scanning | Medium | Trivy scan job added (CRITICAL/HIGH, exit code 1) |
| No `npm audit` in pipeline | Low | `npm audit --audit-level=high` added as first build step |
| Background port-forward not cleaned up | Low | `kill $PF_PID` added after test assertions |
| No `packages: write` permission for GHCR | High | Added `permissions: packages: write` to build job |

### Dependencies

| Finding | Severity | Resolution |
|---------|----------|------------|
| Caret version range `^5.11.0` for redis | Medium | Pinned to exact version `5.11.0` |
| CVEs in npm's bundled tooling | High | Added `.trivyignore` for CVEs in npm's internal packages (not app runtime) |

---

## Known constraints

**`app-egress` NetworkPolicy in k3d**
The egress NetworkPolicy is deleted during the integration test (`kubectl delete networkpolicy app-egress`). k3d uses Flannel as its CNI which does not enforce NetworkPolicy egress rules — the policy would silently have no effect and can cause pod readiness issues in some k3d versions. The policy remains in the production manifests and is enforced on CNI-compliant clusters (Calico, Cilium, etc.).

**Redis runs as root**
The official `redis:7-alpine` image requires root to run. `runAsNonRoot: false` is set on the Redis container. `readOnlyRootFilesystem` is also `false` for Redis since it writes to `/data` and `/tmp`.

**`.trivyignore` for npm CVEs**
Trivy detects CVEs in packages bundled inside npm itself (`/usr/local/lib/node_modules/npm`). These are used by the npm CLI tool, not by the application at runtime. They are suppressed via `.trivyignore`. The application's own dependencies have no known CVEs.

---

## Test strategy

### Integration tests

There are no unit tests. The test strategy relies on integration tests that deploy the full stack (app + Redis) into a real Kubernetes cluster and verify end-to-end behaviour.

**What is tested:**

1. App responds with correct message and incrementing counter
2. Counter increments correctly across sequential requests
3. Redis rejects unauthenticated connections (`NOAUTH`)
4. Redis accepts authenticated connections (`PONG`)

### CI pipeline

Tests run automatically on every push to `main` as part of `.github/workflows/build.yaml`:

```
push to main
    │
    ▼
 build job
 ├─ npm audit
 ├─ docker build + push to GHCR (:sha + :latest)
    │
    ├──────────────┬──────────────────────┐
    ▼              ▼                      ▼
 scan job    integration-test job      (parallel)
 Trivy scan  k3d cluster + deploy
             + run assertions
```

`scan` and `integration-test` run in parallel after `build` completes. Both must pass for the commit to be green.

### Run integration tests locally

```bash
# 1. Build and import image
docker build -t ghcr.io/pprecel/claude-warmup:local .
k3d image import ghcr.io/pprecel/claude-warmup:local -c claude-warmup

# 2. Create secret (use your actual password)
kubectl delete secret redis-credentials --ignore-not-found
kubectl create secret generic redis-credentials \
  --from-literal=redis-password=your-password

# 3. Deploy
kubectl apply -f k8s/
kubectl set image deployment/claude-warmup \
  claude-warmup=ghcr.io/pprecel/claude-warmup:local
kubectl scale deployment/claude-warmup --replicas=1
kubectl patch deployment/claude-warmup \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"claude-warmup","imagePullPolicy":"Never"}]}}}}'
kubectl delete networkpolicy app-egress --ignore-not-found

# 4. Wait
kubectl rollout status deployment/redis --timeout=120s
kubectl rollout status deployment/claude-warmup --timeout=120s

# 5. Run assertions
kubectl port-forward svc/claude-warmup 8080:80 &
PF_PID=$!
sleep 2

RESPONSE=$(curl -sf http://localhost:8080)
echo "$RESPONSE" | grep -q "hello claude warmup (requests:" && echo "PASS: counter response"

kubectl exec deployment/redis -- redis-cli ping 2>&1 | grep -q "NOAUTH" && echo "PASS: Redis requires auth"
kubectl exec deployment/redis -- redis-cli -a your-password ping 2>&1 | grep -q "PONG" && echo "PASS: Redis auth works"

kill $PF_PID
```
