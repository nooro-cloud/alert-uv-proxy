const express = require("express");
const http = require("http");
const https = require("https");
const path = require("path");
const url = require("url");

const app = express();
app.use(express.static(path.join(__dirname, "public")));

app.use("/proxy", async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send("No URL");

  let targetUrl;
  try { targetUrl = new URL(target); }
  catch { return res.status(400).send("Invalid URL"); }

  const blocked = ['pornhub','xvideos','xnxx','onlyfans','brazzers','redtube','youporn','xhamster'];
  if (blocked.some(b => targetUrl.hostname.includes(b))) return res.status(403).send("Blocked");

  const proto = targetUrl.protocol === "https:" ? https : http;
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "identity",
      "Referer": targetUrl.origin,
    }
  };

  const proxyReq = proto.request(options, (proxyRes) => {
    // Handle redirects
    if ([301,302,303,307,308].includes(proxyRes.statusCode)) {
      const loc = proxyRes.headers["location"];
      if (loc) {
        try {
          const abs = new URL(loc, targetUrl).toString();
          return res.redirect("/?url=" + encodeURIComponent(abs));
        } catch(e) {}
      }
    }

    const ct = proxyRes.headers["content-type"] || "";
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", ct);

    if (!ct.includes("text/html")) {
      proxyRes.pipe(res);
      return;
    }

    let body = "";
    proxyRes.setEncoding("utf8");
    proxyRes.on("data", chunk => body += chunk);
    proxyRes.on("end", () => {
      const origin = targetUrl.origin;
      const proxyBase = "/?url=";

      const rewrite = (u) => {
        if (!u || u.startsWith("data:") || u.startsWith("blob:") || u.startsWith("javascript:") || u.startsWith("#") || u.startsWith("mailto:")) return u;
        try {
          let abs;
          if (u.startsWith("//")) abs = targetUrl.protocol + u;
          else if (u.startsWith("/")) abs = origin + u;
          else if (!u.startsWith("http")) abs = origin + "/" + u;
          else abs = u;
          return proxyBase + encodeURIComponent(abs);
        } catch(e) { return u; }
      };

      body = body.replace(/(src|href|action)=["']([^"']*?)["']/gi, (m, attr, val) => {
        if (["mailto:", "tel:", "#", "javascript:"].some(p => val.startsWith(p))) return m;
        const q = m.includes('"') ? '"' : "'";
        return `${attr}=${q}${rewrite(val)}${q}`;
      });

      const inject = `<base href="${origin}/"><script>
(function(){
  var P='/?url=', O='${origin}', T='${targetUrl.protocol}';
  function abs(u){
    if(!u||u.startsWith('data:')||u.startsWith('blob:')||u.startsWith('#'))return u;
    if(u.startsWith('//'))return T+u;
    if(u.startsWith('/'))return O+u;
    if(!u.startsWith('http'))return O+'/'+u;
    return u;
  }
  var _f=window.fetch;
  window.fetch=function(inp,init){
    try{var u=typeof inp==='string'?inp:inp.url;if(u&&!u.includes(location.hostname)){inp=P+encodeURIComponent(abs(u));}}catch(e){}
    return _f.apply(this,arguments);
  };
  var _x=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){
    try{if(u&&typeof u==='string'&&!u.includes(location.hostname)){u=P+encodeURIComponent(abs(u));}}catch(e){}
    return _x.apply(this,arguments);
  };
  document.addEventListener('click',function(e){
    var a=e.target.closest('a[href]');if(!a)return;
    var h=a.getAttribute('href');
    if(!h||h.startsWith('#')||h.startsWith('javascript:')||h.startsWith('mailto:'))return;
    var ab=abs(h);
    if(ab.startsWith('http')&&!ab.includes(location.hostname)){e.preventDefault();location.href=P+encodeURIComponent(ab);}
  },true);
})();
<\/script>`;

      body = body.replace(/<head[^>]*>/i, m => m + inject);
      body = body.replace(/<meta[^>]*content-security-policy[^>]*>/gi, "");
      res.send(body);
    });
  });

  proxyReq.on("error", (e) => {
    res.status(502).send(`<html><body style="background:#0a0a0a;color:#f0f0f0;font-family:sans-serif;padding:40px;"><h2 style="color:#ff2d2d">Could not reach site</h2><p>${targetUrl.hostname} refused the connection.</p></body></html>`);
  });

  proxyReq.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Alert Proxy running on port ${PORT}`));
