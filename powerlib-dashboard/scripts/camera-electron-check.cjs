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
  const wide = nativeImage.createFromBitmap(Buffer.alloc(320 * 180 * 4, 255), { width: 320, height: 180 }).toJPEG(80);
  const portrait = nativeImage.createFromBitmap(Buffer.alloc(180 * 320 * 4, 255), { width: 180, height: 320 }).toJPEG(80);
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
    } else if (["/stream", "/wide", "/portrait"].includes(req.url)) {
      const frame = req.url === "/wide" ? wide : req.url === "/portrait" ? portrait : jpeg;
      res.writeHead(200, { "Content-Type": "multipart/x-mixed-replace; boundary=frame", "Cache-Control": "no-store" });
      const send = () => { res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`); res.write(frame); res.write("\r\n"); };
      send();
      const interval = setInterval(send, 100);
      res.on("close", () => clearInterval(interval));
    } else { res.writeHead(404); res.end(); }
  });
  server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const csp = fs.readFileSync(path.join(project, "index.html"), "utf8").match(/content="(default-src[^"]+)"/)[1];
  const streamModule = path.join(project, "src/features/dashboard/cameraStream.ts");
  const panelModule = path.join(project, "src/features/limelights/LimelightsPanel.tsx");
  const dashboardModule = path.join(project, "src/features/dashboard/DashboardPanel.tsx");
  const contextModule = path.join(project, "src/features/networktables/NetworkTablesContext.tsx");
  const configModule = path.join(project, "src/features/config/ConfigDialog.tsx");
  buildSync({ stdin: { contents: `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { LimelightsPanel } from ${JSON.stringify(panelModule)};
    import { startCameraStream } from ${JSON.stringify(streamModule)};
    import { DashboardPanel } from ${JSON.stringify(dashboardModule)};
    import { NetworkTablesProvider, useNetworkTables } from ${JSON.stringify(contextModule)};
    import { ConfigDialog } from ${JSON.stringify(configModule)};
    import { saveWebUiOverride } from ${JSON.stringify(path.join(project, "src/features/limelights/limelightUtils.ts"))};
    const root = createRoot(document.getElementById("root"));
    function DashboardFixture() {
      const { setTopics } = useNetworkTables();
      const [open, setOpen] = React.useState(false); window.openFixtureSettings=()=>setOpen(true);
      React.useEffect(() => { setTopics([
        { name: "/CameraPublisher/wide/streams", type: "string[]", value: [${JSON.stringify(origin + "/wide")}] },
        { name: "/CameraPublisher/portrait/streams", type: "string[]", value: [${JSON.stringify(origin + "/portrait")}] }
      ]); }, [setTopics]);
      return React.createElement(React.Fragment, null, React.createElement(DashboardPanel, {}),
        open && React.createElement(ConfigDialog, { document: { loading: false, exists: true, path: "fixture", subsystems: [
          { id: "intake", name: "Intake", type: "velocity", motors: [{ role: "leader", id: 10, motorType: "X60" }] }
        ], error: null },
          onRefresh() {}, onSave: async () => {}, onClose: () => setOpen(false) }));
    }
    window.renderDashboard = () => root.render(React.createElement(NetworkTablesProvider, null, React.createElement(DashboardFixture)));
    window.frameReady = false;
    addEventListener("message", event => { if (event.data === "camera-config-ready") window.frameReady = true; });
    window.renderPanel = () => root.render(React.createElement(LimelightsPanel, {
      limelights: [{ tableName: "limelight-test", webUiUrl: ${JSON.stringify(origin + "/config")}, topicCount: 1, keys: ["hb"] }]
    }));
    window.setLegacyCameraOverride = url => { saveWebUiOverride('limelight-test', url); window.renderPanel(); };
    window.startStream = urls => {
      window.stopStream?.();
      window.stopStream = startCameraStream(document.getElementById("pool"), urls,
        image => { window.streamImage = image; }, failed => { window.streamFailed = failed; });
    };
    window.renderPanel();
  `, resolveDir: project }, bundle: true, loader: { ".png": "file" }, platform: "browser", format: "iife", outfile: path.join(temporary, "fixture.js"), define: { "process.env.NODE_ENV": '"production"' } });
  fs.writeFileSync(path.join(temporary, "index.html"), `<html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><link rel="stylesheet" href="fixture.css"></head><body><div id="root"></div><div id="pool"></div><script src="fixture.js"></script></body></html>`);
  window = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { partition: "camera-check", contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  const execute = window.webContents.executeJavaScript.bind(window.webContents);
  window.webContents.executeJavaScript = async expression => {
    try { return await execute(expression); }
    catch (error) { throw new Error(`${expression}: ${error.message}`); }
  };
  await window.loadFile(path.join(temporary, "index.html"));
  await waitFor("window.frameReady === true", "The HTTP config iframe was blocked under the application CSP");

  // The current tab has no override form, but still honors saved laptop overrides.
  const override = `${origin}/config?override=1`;
  await window.webContents.executeJavaScript(`window.setLegacyCameraOverride(${JSON.stringify(override)})`);
  await waitFor(`document.querySelector('iframe')?.src === ${JSON.stringify(override)} && document.querySelector('a')?.href === ${JSON.stringify(override)}`, "Saved overrides must update both iframe and Open link");
  await new Promise(resolve => {
    window.webContents.once("did-finish-load", resolve);
    window.reload();
  });
  await waitFor(`document.querySelector('iframe')?.src === ${JSON.stringify(override)}`, "Config override was not restored after reload");
  await window.webContents.executeJavaScript("window.setLegacyCameraOverride(undefined)");
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
  await window.webContents.executeJavaScript("window.renderDashboard()");
  await waitFor("document.querySelector('canvas[aria-label=\"wide live camera\"]')?.width === 320 && document.querySelector('canvas[aria-label=\"portrait live camera\"]')?.height === 320", "Camera thumbnails must use the frame dimensions");
  assert.equal(requests.get("/wide"), 1);
  assert.equal(requests.get("/portrait"), 1);
  await window.webContents.executeJavaScript("document.querySelector('button[aria-label=\"Show wide\"]').click()");
  await waitFor("document.querySelector('.dashboard-stage canvas')?.width === 320 && document.querySelector('.dashboard-stage canvas')?.height === 180", "Selected widescreen image must preserve its native aspect ratio");
  await window.webContents.executeJavaScript("document.querySelector('button[aria-label=\"Show portrait\"]').click()");
  await waitFor("document.querySelector('.dashboard-stage canvas')?.width === 180 && document.querySelector('.dashboard-stage canvas')?.height === 320", "Selected portrait image must preserve its native aspect ratio");
  assert.equal(requests.get("/wide"), 1, "Selecting a camera must share its thumbnail stream");
  assert.equal(requests.get("/portrait"), 1, "Switching cameras must retain the existing streams");
  await window.webContents.executeJavaScript("document.querySelector('button[aria-label=\"Show field view\"]').click(); window.openFixtureSettings()");
  await waitFor("document.querySelector('[role=\"dialog\"] h2')?.textContent === 'Settings'", "Config title must be renamed");
  await window.webContents.executeJavaScript("[...document.querySelectorAll('[role=\"dialog\"] button')].find(button => button.textContent === 'Add Subsystem').click()");
  await waitFor("document.querySelector('[role=\"dialog\"] h2')?.textContent === 'Add Subsystem'", "Add wizard must own its header");
  assert.equal(await window.webContents.executeJavaScript("getComputedStyle(document.querySelector('[role=\"dialog\"] h2')).textAlign"), "center", "Wizard header stays centered");
  assert.equal(await window.webContents.executeJavaScript("document.querySelectorAll('[role=\"dialog\"] h2').length"), 1, "Only the active view header is rendered");
  await window.webContents.executeJavaScript("document.querySelector('button[aria-label=\"Back to Settings\"]').click()");
  await waitFor("document.querySelector('[role=\"dialog\"] h2')?.textContent === 'Settings'", "Back must restore the settings header");
  await window.webContents.executeJavaScript("document.querySelector('button[aria-label=\"Edit Intake\"]').click()");
  await waitFor("document.querySelector('[role=\"dialog\"] h2')?.textContent === 'Edit Subsystem'", "Edit wizard must own its header");
  assert.equal(await window.webContents.executeJavaScript("[...document.querySelectorAll('[role=\"dialog\"] input')].some(input => input.value === 'Intake')"), true, "Edit values remain prefilled");
  await window.webContents.executeJavaScript("document.querySelector('button[aria-label=\"Back to Settings\"]').click()");
  await waitFor("document.querySelector('[role=\"dialog\"] h2')?.textContent === 'Settings'", "Edit back must restore the settings screen");
  await window.webContents.executeJavaScript("[...document.querySelectorAll('nav button, nav [role=\"button\"]')].find(button => button.textContent === 'Field').click()");
  await waitFor("document.querySelector('input[type=\"number\"]')", "Field category must show dimension inputs");
  await window.webContents.executeJavaScript(`{
    const fill = (label, value) => {
      const input = [...document.querySelectorAll('input')].find(el => el.labels?.[0]?.textContent === label);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    fill('Field length (m)', '18'); fill('Field width (m)', '9');
  }`);
  await sleep(100);
  await window.webContents.executeJavaScript("document.querySelector('form').requestSubmit()");
  await waitFor("document.querySelector('.dashboard-stage svg')?.getAttribute('viewBox') === '-12 -12 984 504' && document.querySelector('.dashboard-field-preview')?.style.aspectRatio === '18 / 9'", "Saving dimensions must refresh both field views immediately");
  await window.webContents.executeJavaScript("document.querySelector('button[aria-label=\"Close Settings\"]').click()");
  await waitFor("!document.querySelector('[role=\"dialog\"]')", "Config must close");
  await window.webContents.executeJavaScript("window.openFixtureSettings()");
  await waitFor("document.querySelector('[role=\"dialog\"]')", "Config must reopen");
  await window.webContents.executeJavaScript("[...document.querySelectorAll('nav button, nav [role=\"button\"]')].find(button => button.textContent === 'Field').click()");
  await waitFor("[...document.querySelectorAll('input')].some(input => input.value === '18') && [...document.querySelectorAll('input')].some(input => input.value === '9')", "Field dimensions must persist across opening Config");
  console.log("Electron checks passed: camera CSP/config persistence, error/timeout/MJPEG failover, stream retention/cleanup, wide/portrait aspect ratios, shared thumbnail/main streams, Config field save and immediate redraw/persistence.");
}).catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  window?.destroy();
  for (const socket of sockets) socket.destroy();
  if (server) await new Promise(resolve => server.close(resolve));
  if (path.dirname(temporary) === path.resolve(os.tmpdir()) && path.basename(temporary).startsWith("power-tool-camera-check-")) {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
  app.exit(process.exitCode ?? 0);
});
