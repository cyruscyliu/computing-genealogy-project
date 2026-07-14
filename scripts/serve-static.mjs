import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const preferredPort = Number(process.env.PORT || 4317);
const maxPortAttempts = 20;

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "application/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
]);

function resolveRequestPath(urlPathname) {
  const decodedPath = decodeURIComponent(urlPathname);
  const relativePath = decodedPath === "/" ? "/index.html" : decodedPath;
  const absolutePath = path.resolve(rootDir, `.${relativePath}`);

  if (!absolutePath.startsWith(rootDir)) {
    return null;
  }

  return absolutePath;
}

async function sendFile(response, filePath) {
  const fileStats = await stat(filePath);
  if (fileStats.isDirectory()) {
    return sendNotFound(response);
  }

  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    "Content-Length": fileStats.size,
    "Content-Type": mimeTypes.get(extension) || "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  createReadStream(filePath).pipe(response);
}

function sendNotFound(response) {
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

function sendServerError(response, error) {
  response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(`Server error: ${error.message}`);
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const filePath = resolveRequestPath(requestUrl.pathname);
    if (!filePath) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    await access(filePath);
    await sendFile(response, filePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      sendNotFound(response);
      return;
    }

    sendServerError(response, error);
  }
});

function listenOnPort(port, attempt = 0) {
  server
    .once("error", (error) => {
      if (error.code === "EADDRINUSE" && attempt < maxPortAttempts) {
        listenOnPort(port + 1, attempt + 1);
        return;
      }

      throw error;
    })
    .listen(port, "0.0.0.0", () => {
      const address = server.address();
      const activePort = typeof address === "object" && address ? address.port : port;
      console.log(`Serving ${rootDir} at http://127.0.0.1:${activePort}`);
    });
}

listenOnPort(preferredPort);
