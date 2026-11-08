import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const base = `${(process.env.SITE_BASE_PATH || "/simulators/").replace(/\/+$/, "")}/`;
const port = Number(process.env.PORT || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
};
// Match Pages' directory URLs rather than an SPA fallback: a missing nested
// asset must return 404 so deployment-path mistakes are visible during QA.
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    if (pathname === "/" && base !== "/") {
      response.writeHead(302, { Location: base }).end();
      return;
    }
    if (!pathname.startsWith(base)) {
      response.writeHead(404).end("Not found");
      return;
    }
    let target = resolve(root, pathname.slice(base.length));
    if (target !== resolve(root) && !target.startsWith(resolve(root) + sep)) {
      response.writeHead(403).end();
      return;
    }
    const info = await stat(target);
    if (info.isDirectory()) {
      if (!pathname.endsWith("/")) {
        response.writeHead(301, { Location: pathname + "/" }).end();
        return;
      }
      target = resolve(target, "index.html");
    }
    response
      .writeHead(200, {
        "Content-Type": mime[extname(target)] || "application/octet-stream",
      })
      .end(await readFile(target));
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`practicedesk: http://127.0.0.1:${port}${base}`),
);
