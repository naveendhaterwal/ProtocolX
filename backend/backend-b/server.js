// ProtocolX — Backend B (Mac 4)
// Plain HTTP backend using only Node's built-in "http" module (no dependencies).

const http = require("http");
const os = require("os");

const HOST = "0.0.0.0"; // listen on all interfaces so other Macs on the LAN can reach it
const PORT = 3002;

const server = http.createServer((req, res) => {
  // Log every request: time, client IP, method, path
  console.log(`${new Date().toISOString()} ${req.socket.remoteAddress} ${req.method} ${req.url}`);

  // Every response identifies this backend
  res.setHeader("X-Backend", "B");

  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Hello from Backend B (Mac 4, host ${os.hostname()})\n`);
  } else if (req.method === "GET" && req.url === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ backend: "B", status: "ok", host: os.hostname(), port: PORT }) + "\n");
  } else {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found (Backend B)\n");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Backend B listening on http://${HOST}:${PORT}`);
});
