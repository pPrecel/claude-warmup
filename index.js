const http = require('http');
const { createClient } = require('redis');

const redisPassword = process.env.REDIS_PASSWORD;
const redis = createClient({
  socket: { host: process.env.REDIS_HOST || 'redis', port: 6379 },
  password: redisPassword,
});

redis.connect().catch((err) => {
  console.log(JSON.stringify({ level: 'error', msg: 'Redis connection failed', error: err.message }));
  process.exit(1);
});

const server = http.createServer(async (req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }
  const count = await redis.incr('request_count');
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`hello claude warmup (requests: ${count})`);
});

server.listen(3000, () => {
  console.log(JSON.stringify({ level: 'info', msg: 'Server running at http://localhost:3000' }));
});
