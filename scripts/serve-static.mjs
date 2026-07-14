import chokidar from "chokidar";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const preferredPort = Number(process.env.PORT || 4317);
const maxPortAttempts = 20;
const buildScriptPath = path.join(rootDir, "scripts", "build-dataset.mjs");
const liveReloadClients = new Set();
let reloadDebounceTimer = null;
let buildPromise = null;
let buildQueued = false;

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "application/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
]);

const liveReloadSnippet = `
<script>
(() => {
  if (window.__LINEAGE_LIVE_RELOAD__) {
    return;
  }
  window.__LINEAGE_LIVE_RELOAD__ = true;
  const protocol = window.location.protocol === "https:" ? "https" : "http";
  const source = new EventSource(protocol + "://" + window.location.host + "/__live_reload");
  source.addEventListener("reload", () => window.location.reload());
})();
</script>
`;

function resolveRequestPath(urlPathname) {
  const decodedPath = decodeURIComponent(urlPathname);
  const relativePath = decodedPath === "/" ? "/index.html" : decodedPath;
  const absolutePath = path.resolve(rootDir, `.${relativePath}`);

  if (!absolutePath.startsWith(rootDir)) {
    return null;
  }

  return absolutePath;
}

function injectLiveReload(html) {
  if (html.includes("__LINEAGE_LIVE_RELOAD__")) {
    return html;
  }

  if (html.includes("</body>")) {
    return html.replace("</body>", `${liveReloadSnippet}</body>`);
  }

  return `${html}${liveReloadSnippet}`;
}

function sendEventStream(response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  response.write(": connected\n\n");
  liveReloadClients.add(response);
  response.on("close", () => {
    liveReloadClients.delete(response);
  });
}

function broadcastReload() {
  for (const client of liveReloadClients) {
    client.write("event: reload\ndata: now\n\n");
  }
}

function scheduleReload() {
  clearTimeout(reloadDebounceTimer);
  reloadDebounceTimer = setTimeout(() => {
    broadcastReload();
  }, 120);
}

async function runDatasetBuild() {
  if (buildPromise) {
    buildQueued = true;
    return buildPromise;
  }

  buildPromise = new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [buildScriptPath], {
      cwd: rootDir,
      stdio: "inherit",
    });

    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`build-dataset exited with code ${code}`));
    });

    child.once("error", reject);
  });

  try {
    await buildPromise;
  } finally {
    buildPromise = null;
    const shouldRerun = buildQueued;
    buildQueued = false;
    if (shouldRerun) {
      await runDatasetBuild();
    }
  }
}

async function sendFile(response, filePath) {
  const fileStats = await stat(filePath);
  if (fileStats.isDirectory()) {
    return sendNotFound(response);
  }

  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") {
    const html = injectLiveReload(await readFile(filePath, "utf8"));
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(extension) || "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    });
    response.end(html);
    return;
  }

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
    if (requestUrl.pathname === "/__live_reload") {
      sendEventStream(response);
      return;
    }

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

function startWatchers() {
  const reloadWatcher = chokidar.watch(
    [
      path.join(rootDir, "index.html"),
      path.join(rootDir, "app.js"),
      path.join(rootDir, "styles.css"),
      path.join(rootDir, "data", "generated", "lineage-dataset.json"),
      path.join(rootDir, "data", "generated", "lineage-dataset.js"),
      path.join(rootDir, "data", "generated", "lineage-schema.json"),
    ],
    {
      ignoreInitial: true,
      usePolling: true,
      interval: 300,
      awaitWriteFinish: {
        stabilityThreshold: 150,
        pollInterval: 50,
      },
    }
  );

  reloadWatcher.on("all", () => {
    scheduleReload();
  });

  const buildWatcher = chokidar.watch(
    [
      path.join(rootDir, "data", "raw", "*.json"),
      buildScriptPath,
    ],
    {
      ignoreInitial: true,
      usePolling: true,
      interval: 300,
      awaitWriteFinish: {
        stabilityThreshold: 150,
        pollInterval: 50,
      },
    }
  );

  buildWatcher.on("all", async () => {
    try {
      await runDatasetBuild();
      scheduleReload();
    } catch (error) {
      console.error(error.message);
    }
  });
}

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

await runDatasetBuild();
startWatchers();
listenOnPort(preferredPort);
