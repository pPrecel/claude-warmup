const http = require('http');

let requestCount = 0;

const server = http.createServer((req, res) => {
  requestCount++;
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`hello claude warmup (requests: ${requestCount})`);
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
