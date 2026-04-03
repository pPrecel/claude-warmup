# Production Deployment

## Kubernetes manifests

All manifests are bundled and attached to each [GitHub Release](https://github.com/pPrecel/claude-warmup/releases). Apply the latest release with:

```bash
kubectl apply -f https://github.com/pPrecel/claude-warmup/releases/latest/download/manifests.yaml
```

To pin to a specific version:

```bash
kubectl apply -f https://github.com/pPrecel/claude-warmup/releases/download/v1.0.0/manifests.yaml
```

| File | Purpose |
|------|---------|
| `deployment.yaml` | App deployment — 2 replicas, probes, securityContext, RBAC SA |
| `service.yaml` | ClusterIP service, port 80 → 3000 |
| `redis.yaml` | Redis Deployment + PersistentVolumeClaim + ClusterIP Service |
| `secret.yaml.example` | Template for the Redis credentials secret |
| `network-policy.yaml` | Ingress + egress NetworkPolicy rules |
| `rbac.yaml` | ServiceAccount, Role, RoleBinding for the app |

## Secret management

Redis credentials are stored in a Kubernetes Secret named `redis-credentials`. **Never commit `secret.yaml`** — it is gitignored.

Create the secret manually before deploying:

```bash
kubectl create secret generic redis-credentials \
  --from-literal=redis-password=$(openssl rand -base64 24)
```

Or copy and fill in `k8s/secret.yaml.example`:

```bash
cp k8s/secret.yaml.example k8s/secret.yaml
kubectl apply -f k8s/secret.yaml
```

For production, use an external secrets manager (Vault, AWS Secrets Manager, Sealed Secrets, External Secrets Operator) instead of managing the secret manually.

## Security hardening

### Non-root container

The app runs as UID 1000 (the built-in `node` user):

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL
```

### NetworkPolicy

Two policies are defined in `k8s/network-policy.yaml`:

- **`redis-allow-app`** — Redis only accepts ingress from pods labelled `app: claude-warmup` on port 6379. All other ingress to Redis is denied.
- **`app-egress`** — App pods may only send traffic to DNS (port 53) and Redis (port 6379). All other egress is denied.

### RBAC

A dedicated ServiceAccount (`claude-warmup`) is created with an empty Role — the app makes no Kubernetes API calls, so no API permissions are granted.

### HTTP security headers

Every response includes:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Content-Security-Policy: default-src 'none'
```

## Health probes

Both liveness and readiness probes call `GET /healthz`:

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /healthz
    port: 3000
  initialDelaySeconds: 3
  periodSeconds: 5
```

Redis uses exec probes with authenticated `redis-cli ping`.

## Resource limits

Both deployments have explicit requests and limits:

| Resource | Request | Limit |
|----------|---------|-------|
| CPU | 50m | 200m |
| Memory | 64Mi | 128Mi |

## Persistent storage

Redis data is stored on a 1Gi PersistentVolumeClaim (`redis-data`) mounted at `/data`. Counter values survive pod restarts and rescheduling.

## Multi-replica

The app runs with 2 replicas by default. Since the counter is stored in Redis (not in-process), all replicas share the same counter state correctly.

## Image tagging

The CI pipeline pushes two tags on every build:

- `ghcr.io/pprecel/claude-warmup:latest`
- `ghcr.io/pprecel/claude-warmup:<git-sha>`

For production deployments, always reference the SHA tag for reproducibility. The deployment uses `imagePullPolicy: Always` to ensure the latest image is pulled on pod restarts.

## Deployment checklist

- [ ] Secret `redis-credentials` created before `kubectl apply`
- [ ] Using a strong, randomly generated Redis password
- [ ] Image tag pinned to a specific SHA for reproducibility
- [ ] Cluster enforces NetworkPolicy (not all CNI plugins do — verify with your provider)
- [ ] etcd encryption at rest enabled (Kubernetes Secrets are base64, not encrypted by default)
- [ ] Consider external secret management for production
