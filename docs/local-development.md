# Local Development

## Prerequisites

- Node.js 20+
- Docker
- [k3d](https://k3d.io) + kubectl

## Run with Node.js directly

Requires a Redis instance reachable at `redis:6379` (or override via env vars).

```bash
npm install
REDIS_HOST=localhost REDIS_PASSWORD=yourpassword node index.js
```

Test it:

```bash
curl http://localhost:3000        # hello claude warmup (requests: 1)
curl http://localhost:3000/healthz  # ok
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `redis` | Redis hostname |
| `REDIS_PASSWORD` | *(none)* | Redis password — required in production |

## Run with Docker Compose (quickstart)

```bash
docker build -t claude-warmup .
docker network create warmup
docker run -d --name redis --network warmup redis:7-alpine
docker run -d --name app --network warmup \
  -e REDIS_HOST=redis \
  -p 3000:3000 \
  claude-warmup
curl http://localhost:3000
```

## Run on k3d (full Kubernetes stack)

### 1. Create cluster

```bash
k3d cluster create claude-warmup --wait
```

### 2. Create the secret

`k8s/secret.yaml` is gitignored. Copy the example and fill in a base64-encoded password:

```bash
cp k8s/secret.yaml.example k8s/secret.yaml
# generate a password:
echo -n 'your-password' | base64
# paste the result into k8s/secret.yaml
```

### 3. Build and import the image

```bash
docker build -t ghcr.io/pprecel/claude-warmup:local .
k3d image import ghcr.io/pprecel/claude-warmup:local -c claude-warmup
```

### 4. Deploy

```bash
kubectl apply -f k8s/
kubectl set image deployment/claude-warmup claude-warmup=ghcr.io/pprecel/claude-warmup:local
kubectl patch deployment/claude-warmup \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"claude-warmup","imagePullPolicy":"Never"}]}}}}'

kubectl rollout status deployment/redis
kubectl rollout status deployment/claude-warmup
```

### 5. Test

```bash
kubectl port-forward svc/claude-warmup 8080:80
curl http://localhost:8080
```

### Tear down

```bash
k3d cluster delete claude-warmup
```
