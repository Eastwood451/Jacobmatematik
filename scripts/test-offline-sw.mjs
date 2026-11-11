/**
 * Checks that the service worker keeps online pages and redirects intact
 * and only replaces a navigation when the network fails.
 *
 *   node scripts/test-offline-sw.mjs
 *
 * Requires Google Chrome. Does not touch Supabase or pupil data.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
let dropConnections = false;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const server = createServer((req, res) => {
  if (dropConnections) {
    req.socket.destroy();
    return;
  }
  const url = new URL(req.url, "http://127.0.0.1");
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.includes("\0")) {
    res.writeHead(400).end();
    return;
  }
  const filePath = normalize(join(root, pathname));
  if (!filePath.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    if (!pathname.endsWith("/")) {
      res.writeHead(301, { Location: pathname + "/" + url.search }).end();
      return;
    }
    pathname += "index.html";
  }
  const target = normalize(join(root, pathname));
  if (!target.startsWith(root) || !existsSync(target) || statSync(target).isDirectory()) {
    res.writeHead(404).end("missing");
    return;
  }
  res.writeHead(200, { "Content-Type": types[extname(target)] || "application/octet-stream" });
  createReadStream(target).pipe(res);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
const chrome = spawn("google-chrome-stable", [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--lang=da-DK",
  `--user-data-dir=/tmp/jm-chrome-sw-${port}`,
  "--remote-debugging-port=0",
  "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });

let debugPort = 0;
const chromeLog = [];
function noteChrome(chunk) {
  const text = String(chunk);
  chromeLog.push(text);
  const match = text.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
  if (match) debugPort = Number(match[1]);
}
chrome.stdout.on("data", noteChrome);
chrome.stderr.on("data", noteChrome);

function fail(message) {
  console.error(message);
  chrome.kill();
  server.close();
  process.exit(1);
}

const deadline = Date.now() + 30000;
while (!debugPort) {
  if (Date.now() > deadline) fail("Chrome åbnede ikke DevTools.\n" + chromeLog.join("").slice(-2000));
  await new Promise((resolve) => setTimeout(resolve, 50));
}

const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json());
const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
if (!page) fail("Chrome havde ingen side at styre.");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve);
  socket.addEventListener("error", reject);
});

let nextId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  }
});

function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) fail(result.exceptionDetails.text + "\n" + expression);
  return result.result.value;
}

await send("Page.enable");
await send("Network.enable");

function waitForLoad() {
  return new Promise((resolve) => {
    function onMessage(event) {
      const message = JSON.parse(event.data);
      if (message.method === "Page.loadEventFired") {
        socket.removeEventListener("message", onMessage);
        resolve();
      }
    }
    socket.addEventListener("message", onMessage);
  });
}

async function open(path) {
  const loaded = waitForLoad();
  let timer;
  const timed = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Timeout ved " + path)), 15000);
  });
  await send("Page.navigate", { url: origin + path });
  try {
    await Promise.race([loaded, timed]);
  } finally {
    clearTimeout(timer);
  }
  return evaluate(`({ href: location.href, text: document.body.innerText.slice(0, 500) })`);
}

const home = await open("/");
if (!home.text.includes("Jacobmatematik") && !home.text.includes("maths")) fail("Forsiden manglede: " + home.text);
await evaluate(`navigator.serviceWorker.ready.then(() => true)`);
const cached = await evaluate(`caches.open("jm-offline-v1").then(async (cache) => (await cache.keys()).map((request) => new URL(request.url).pathname))`);
if (JSON.stringify(cached) !== JSON.stringify(["/offline.html"])) fail("Cachen indeholder mere end offlinesiden: " + JSON.stringify(cached));

const privacy = await open("/privatliv.html");
if (!privacy.text.includes("Cookies og privatliv")) fail("Onlinesiden blev ikke hentet: " + privacy.text);
if (privacy.text.includes("Der er ingen forbindelse")) fail("Onlinesiden viste offline-siden");

const fractions = await open("/broeker");
if (!fractions.href.endsWith("/broeker/")) fail("Omdirigering beholdt den forkerte adresse: " + fractions.href);
if (fractions.text.includes("Der er ingen forbindelse") || fractions.text.length < 40) fail("Omdirigeret side manglede indhold: " + fractions.text);

dropConnections = true;
const offline = await open("/rettigheder.html");
if (!offline.text.includes("Der er ingen forbindelse")) fail("Offline-navigation viste ikke reservesiden: " + offline.text);

dropConnections = false;
const rights = await open("/rettigheder.html");
if (!rights.text.includes("Rettigheder og brug")) fail("Siden kom ikke tilbage efter netværket: " + rights.text);

console.log("offline-sw ok");
socket.close();
chrome.kill();
server.close();
process.exit(0);
