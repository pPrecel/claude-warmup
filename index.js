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
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'",
  };

  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain', ...securityHeaders });
    res.end('ok');
    return;
  }

  if (req.url !== '/') {
    res.writeHead(404, { 'Content-Type': 'text/plain', ...securityHeaders });
    res.end('not found');
    return;
  }

  try {
    const count = await redis.incr('request_count');
    res.writeHead(200, { 'Content-Type': 'text/plain', ...securityHeaders });
    res.end(`hello claude warmup (requests: ${count})`);
  } catch (err) {
    console.log(JSON.stringify({ level: 'error', msg: 'Redis error', error: err.message }));
    res.writeHead(503, { 'Content-Type': 'text/plain', ...securityHeaders });
    res.end('service unavailable');
  }
});

server.listen(3000, () => {
  console.log(JSON.stringify({ level: 'info', msg: 'Server running at http://localhost:3000' }));
});
