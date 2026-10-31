// Local dev server that mimics Vercel: serves /public and runs /api/*.js handlers.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    try {
      const mod = await import(`./api/${url.pathname.slice(5).replace(/[^a-z]/gi, "")}.js`);
      return mod.default(req, res);
    } catch { res.statusCode = 404; return res.end("Not found"); }
  }
  const p = url.pathname === "/" ? "/index.html" : url.pathname;
  try {
    const body = await readFile(join("public", p.replace(/\.\./g, "")));
    res.setHeader("Content-Type", types[extname(p)] || "application/octet-stream");
    res.end(body);
  } catch { res.statusCode = 404; res.end("Not found"); }
}).listen(process.env.PORT || 3000, () => console.log("http://localhost:" + (process.env.PORT || 3000)));
