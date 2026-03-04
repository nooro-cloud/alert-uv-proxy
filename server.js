const express = require("express");
const { createBareServer } = require("bare-server-node");
const path = require("path");
const http = require("http");

const app = express();
const bareServer = createBareServer("/bare/");

app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer((req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

server.on("upgrade", (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Alert Proxy running on port ${PORT}`));
