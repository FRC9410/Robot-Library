// Run with node_modules/electron/dist/electron.exe scripts/camera-electron-check.cjs.
// Uses local mock cameras; no robot or installed application is touched.
const { app, BrowserWindow, nativeImage } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { buildSync } = require("esbuild");

const project = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "power-tool-camera-check-"));
let window;
let server;
const sockets = new Set();
const requests = new Map();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(expression, message, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await window.webContents.executeJavaScript(expression)) return;
    await sleep(100);
  }
  throw Error(message);
}

app.whenReady().then(async () => {
  const jpeg = nativeImage.createFromBitmap(Buffer.alloc(16, 255), { width: 2, height: 2 }).toJPEG(80);
  assert.ok(jpeg.length > 0);
  server = http.createServer((req, res) => {
    requests.set(req.url, (requests.get(req.url) ?? 0) + 1);
    if (req.url.startsWith("/config")) {
      res.setHeader("Content-Type", "text/html");
      res.end('<html><body>Mock Limelight<script>parent.postMessage("camera-config-ready", "*")</script></body></html>');
    } else if (req.url === "/bad") {
      res.writeHead(503); res.end();
    } else if (req.url === "/hang") {
      // Leave the request open to exercise the first-frame timeout.
    } else if (req.url === "/stream") {
      res.writeHead(200, { "Content-Type": "multipart/x-mixed-replace; boundary=frame", "Cache-Control": "no-store" });
      const send = () => { res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\n\r\n`); res.write(jpeg); res.write("\r\n"); };
      send();
      const interval = setInterval(send, 100);
      res.on("close", () => clearInterval(interval));
    } else { res.writeHead(404); res.end(); }
  });
  server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const csp = fs.readFileSync(path.join(project, "index.html"), "utf8").match(/content="(default-src[^"]+)"/)[1];
  const streamModule = path.join(project, "src/features/drive/cameraStream.ts");
  const panelModule = path.join(project, "src/features/limelights/LimelightsPanel.tsx");
  buildSync({ stdin: { contents: `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { LimelightsPanel } from ${JSON.stringify(panelModule)};
    import { startCameraStream } from ${JSON.stringify(streamModule)};
    window.frameReady = false;
    addEventListener("message", event => { if (event.data === "camera-config-ready") window.frameReady = true; });
    window.renderPanel = () => createRoot(document.getElementById("root")).render(React.createElement(LimelightsPanel, {
      limelights: [{ tableName: "limelight-test", webUiUrl: ${JSON.stringify(origin + "/config")}, topicCount: 1, keys: ["hb"] }]
    }));
    window.startStream = urls => {
      window.stopStream?.();
      window.stopStream = startCameraStream(document.getElementById("pool"), urls,
        image => { window.streamImage = image; }, failed => { window.streamFailed = failed; });
    };
    window.renderPanel();
  `, resolveDir: project }, bundle: true, platform: "browser", format: "iife", outfile: path.join(temporary, "fixture.js"), define: { "process.env.NODE_ENV": '"production"' } });
  fs.writeFileSync(path.join(temporary, "index.html"), `<html><head><meta http-equiv="Content-Security-Policy" content="${csp}"></head><body><div id="root"></div><div id="pool"></div><script src="fixture.js"></script></body></html>`);
  window = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  await window.loadFile(path.join(temporary, "index.html"));
  await waitFor("window.frameReady === true", "The HTTP config iframe was blocked under the application CSP");

  // Drive the real controlled input, then submit its form.
  const override = `${origin}/config?override=1`;
  await window.webContents.executeJavaScript(`{
    const input = document.querySelector('input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(override)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }`);
  await sleep(100);
  await window.webContents.executeJavaScript("document.querySelector('form').requestSubmit()");
  await waitFor(`document.querySelector('iframe')?.src === ${JSON.stringify(override)} && document.querySelector('a')?.href === ${JSON.stringify(override)}`, "Apply must update both iframe and Open link");
  await new Promise(resolve => {
    window.webContents.once("did-finish-load", resolve);
    window.reload();
  });
  await waitFor(`document.querySelector('iframe')?.src === ${JSON.stringify(override)}`, "Config override was not restored after reload");
  await window.webContents.executeJavaScript("[...document.querySelectorAll('button')].find(button => button.textContent === 'Reset').click()");
  await waitFor(`document.querySelector('iframe')?.src === ${JSON.stringify(origin + "/config")}`, "Reset did not restore automatic config address");

  await window.webContents.executeJavaScript(`window.startStream(${JSON.stringify([origin + "/bad", origin + "/hang", origin + "/stream"])})`);
  await waitFor("window.streamImage?.naturalWidth > 0 && window.streamFailed === false", "Stream failed to advance past error and hanging addresses", 12000);
  assert.equal(requests.get("/bad"), 1);
  assert.equal(requests.get("/hang"), 1);
  assert.equal(requests.get("/stream"), 1);
  await sleep(4500);
  assert.equal(requests.get("/stream"), 1, "A healthy MJPEG stream was unnecessarily reconnected");
  await window.webContents.executeJavaScript("window.stopStream()");
  await waitFor("document.querySelector('#pool').children.length === 0 && window.streamImage === undefined", "Stream cleanup left an active image");
  console.log("Electron camera checks passed: config iframe CSP, Apply/Open/reset/persistence, HTTP failure/timeout/MJPEG fallback, healthy connection retention and cleanup.");
}).catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  window?.destroy();
  for (const socket of sockets) socket.destroy();
  if (server) await new Promise(resolve => server.close(resolve));
  if (path.dirname(temporary) === path.resolve(os.tmpdir()) && path.basename(temporary).startsWith("power-tool-camera-check-")) {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  app.exit(process.exitCode ?? 0);
});
