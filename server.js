const express = require("express");
const { createBareServer } = require("bare-server-node");
const path = require("path");
const http = require("http");
const fs = require("fs");

const app = express();
const bareServer = createBareServer("/bare/");

// Copy UV files to public on startup
const uvPath = path.join(__dirname, "node_modules/@titaniumnetwork-dev/ultraviolet/dist");
const publicUV = path.join(__dirname, "public/uv");
if (!fs.existsSync(publicUV)) fs.mkdirSync(publicUV, {recursive: true});
if (fs.existsSync(uvPath)) {
  fs.readdirSync(uvPath).forEach(f => {
    fs.copyFileSync(path.join(uvPath, f), path.join(publicUV, f));
  });
  console.log("✓ UV files copied");
}

app.use(express.static(path.join(__dirname, "public")));

// Simple redirect proxy fallback
app.get("/go", async (req, res) => {
  res.redirect(req.query.url || "https://google.com");
});

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
```

Then in the Codespace terminal run:
```
node server.js
