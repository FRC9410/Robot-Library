import assert from "node:assert/strict";
import { mock } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

async function load(relativePath) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(relativePath, import.meta.url))], bundle: true, write: false, format: "esm", platform: "node" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
}
const { normalizeWebUiUrl, getLimelightWebUiUrl, readWebUiOverride, saveWebUiOverride } = await load("../src/features/limelights/limelightUtils.ts");
const { startCameraStream } = await load("../src/features/drive/cameraStream.ts");
const storage = new Map();
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const originalDocument = globalThis.document;
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key)
} });
const images = [];
globalThis.document = { createElement: () => {
  const image = { naturalWidth: 0, onload: null, onerror: null, src: "",
    removeAttribute: () => { image.src = ""; }, remove() {} };
  images.push(image);
  return image;
} };
mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
try {
  assert.equal(getLimelightWebUiUrl("limelight-front"), "http://limelight-front.local:5801");
  assert.equal(normalizeWebUiUrl(" http://10.94.10.11:5801/config "), "http://10.94.10.11:5801/config");
  assert.equal(normalizeWebUiUrl("https://camera.local:5801"), "https://camera.local:5801/");
  for (const invalid of ["", "camera.local", "javascript:alert(1)", "file:///camera", "http://user:pass@camera/"]) {
    assert.equal(normalizeWebUiUrl(invalid), undefined);
  }
  saveWebUiOverride("limelight-front", "http://10.94.10.11:5801/");
  assert.equal(readWebUiOverride("limelight-front"), "http://10.94.10.11:5801/");
  assert.equal(readWebUiOverride("limelight-rear"), undefined, "Overrides must be scoped per camera");
  saveWebUiOverride("limelight-front");
  assert.equal(readWebUiOverride("limelight-front"), undefined);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw Error("Storage unavailable"); } });
  assert.equal(readWebUiOverride("limelight-front"), undefined);
  assert.doesNotThrow(() => saveWebUiOverride("limelight-front", "http://camera:5801/"));

  let current;
  let failed;
  const connect = urls => startCameraStream({ append() {} }, urls, image => { current = image; }, value => { failed = value; });
  const stop = connect(["http://hostname/stream", "http://ip/stream"]);
  assert.equal(current.src, "http://hostname/stream");
  const first = current;
  current.onerror();
  assert.equal(first.src, "", "Failed requests must be cancelled");
  assert.equal(current.src, "http://ip/stream");
  current.naturalWidth = 640;
  mock.timers.tick(100);
  assert.equal(failed, false, "An open MJPEG response does not need to fire onload");
  const count = images.length;
  mock.timers.tick(12000);
  assert.equal(images.length, count, "Healthy streams must not reconnect on retry intervals");
  current.onerror();
  assert.equal(failed, true);
  mock.timers.tick(3999);
  assert.equal(images.length, count);
  mock.timers.tick(1);
  assert.equal(current.src, "http://hostname/stream", "Retry the list after all addresses fail");
  const lateError = current.onerror;
  stop();
  lateError();
  mock.timers.tick(20000);
  assert.equal(images.length, count + 1, "Unmount must cancel all timers and ignore late errors");
  assert.equal(current, undefined);

  const stopHanging = connect(["http://hang/stream", "http://fallback/stream"]);
  mock.timers.tick(4000);
  assert.equal(current.src, "http://fallback/stream", "A hanging connection must advance to the next URL");
  current.onload();
  assert.equal(failed, false);
  stopHanging();

  const stopOverride = connect(["http://override/stream"]);
  current.onerror();
  mock.timers.tick(4000);
  assert.equal(current.src, "http://override/stream", "An explicit stream override remains authoritative");
  stopOverride();
  console.log("Camera checks passed: config URLs, persistence/reset, ordered failover, hanging connections, MJPEG readiness, retry and cleanup.");
} finally {
  mock.timers.reset();
  globalThis.document = originalDocument;
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
}
