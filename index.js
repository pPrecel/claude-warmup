const http = require('http');
const { createClient } = require('redis');

const redisPassword = process.env.REDIS_PASSWORD;
const redisUrl = redisPassword
  ? `redis://:${redisPassword}@redis:6379`
  : (process.env.REDIS_URL || 'redis://redis:6379');
const redis = createClient({ url: redisUrl });

redis.connect().then(() => {
  const server = http.createServer(async (req, res) => {
    const count = await redis.incr('request_count');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`hello claude warmup (requests: ${count})`);
  });

  server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
  });
});
