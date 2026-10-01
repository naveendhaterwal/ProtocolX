const http = require('http');

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

const server = http.createServer((req, res) => {
  // Set required header identifying this backend
  res.setHeader('X-Backend', 'A');

  const { method, url } = req;

  if (method === 'GET' && url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'Hello from Backend A',
      backend: 'Backend A',
      status: 'healthy'
    }, null, 2) + '\n');
  } else if (method === 'GET' && url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'OK',
      backend: 'Backend A',
      uptime: process.uptime()
    }, null, 2) + '\n');
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not Found',
      backend: 'Backend A'
    }, null, 2) + '\n');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Backend A server listening on http://${HOST}:${PORT}`);
});
