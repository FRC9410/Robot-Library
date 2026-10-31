import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const source = (path) => fileURLToPath(new URL(path, import.meta.url));
const load = async (entry) => {
  const result = await build({ entryPoints: [source(entry)], bundle: true, write: false, format: "esm", platform: "node", loader: { ".png": "empty" } });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
};
const { fieldLayouts } = await load("../src/features/field/fieldLayouts.ts");
const { rebuiltDrawingSize } = await load("../src/features/field/rebuiltDrawing.ts");

// Image sizes in fieldLayouts.ts must match the PNG headers, or the calibration lands in the wrong place.
const pngSize = (file) => { const bytes = fs.readFileSync(source(`../src/features/field/wpilib/${file}`)); return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]; };
const files = { "2026": "2026-rebuilt.png", "2025": "2025-reefscape.png" };
for (const layout of fieldLayouts) {
  const { image, drawing, length, width, tags } = layout;
  assert.ok(!!image !== !!drawing, `${layout.id} has exactly one backdrop`);
  assert.ok(tags.length > 0 && tags.every(tag => tag.x >= -0.01 && tag.x <= length + 0.01 && tag.y >= -0.01 && tag.y <= width + 0.01), `${layout.id} tags on field`);
  if (image) {
    assert.deepEqual([image.pixelWidth, image.pixelHeight], pngSize(files[layout.id.slice(0, 4)]), `${layout.id} image size`);
    assert.ok(image.left >= 0 && image.top >= 0 && image.right <= image.pixelWidth && image.bottom <= image.pixelHeight, `${layout.id} corners inside image`);
    const pixelAspect = (image.right - image.left) / (image.bottom - image.top);
    assert.ok(Math.abs(pixelAspect / (length / width) - 1) < 0.01, `${layout.id} calibrated corners match the field aspect ratio`);
    // Rotating the image is only exact when every tag has a partner at the rotated position.
    if (image.rotate180) {
      for (const tag of tags) {
        const miss = Math.min(...tags.map(other => Math.hypot(length - tag.x - other.x, width - tag.y - other.y)));
        assert.ok(miss < 0.01, `${layout.id} tag ${tag.id} has no rotated partner (${miss.toFixed(4)} m)`);
      }
    }
  }
}
assert.deepEqual(fieldLayouts.map(layout => [layout.length, layout.width]), [[16.541, 8.069], [16.541, 8.069], [17.548, 8.052]],
  "Field sizes come from the WPILib welded definitions");

// The simplified drawing comes from FIRST's manual and drawings; the AprilTag layout is an independent check.
const simplified = fieldLayouts.find(layout => layout.drawing);
const tag = Object.fromEntries(simplified.tags.map(t => [t.id, t]));
const near = (actual, expected, label, tolerance = 0.01) => assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual.toFixed(4)} vs ${expected.toFixed(4)}`);
near(rebuiltDrawingSize.length, simplified.length, "drawing length", 0.001);
near(rebuiltDrawingSize.width, simplified.width, "drawing width", 0.001);
const shapes = (element, alliance) => simplified.drawing.filter(shape => shape.element === element && shape.alliance === alliance);
const center = (shape) => ({ x: shape.x + shape.length / 2, y: shape.y + shape.width / 2 });
for (const [alliance, hubTags, trenchTags, towerTag, outpostTags] of [["blue", [18, 21, 20, 26], [17, 28], 31, [29, 30]], ["red", [2, 5, 9, 3], [6, 7], 15, [13, 14]]]) {
  const hub = center(shapes("hub", alliance)[0]);
  near(hub.x, (tag[hubTags[0]].x + tag[hubTags[1]].x) / 2, `${alliance} hub x`);
  near(hub.y, (tag[hubTags[0]].y + tag[hubTags[1]].y) / 2, `${alliance} hub y`);
  // Face tags stand slightly proud of the 47 in hub.
  near(shapes("hub", alliance)[0].length, Math.abs(tag[hubTags[2]].x - tag[hubTags[3]].x), `${alliance} hub size from face tags`, 0.02);
  for (const trench of shapes("trench", alliance)) near(center(trench).x, (tag[trenchTags[0]].x + tag[trenchTags[1]].x) / 2, `${alliance} trench x`);
  near(center(shapes("tower", alliance)[0]).y, tag[towerTag].y, `${alliance} tower center`);
  const outpost = shapes("outpost", alliance)[0];
  for (const id of outpostTags) assert.ok(tag[id].y > outpost.y && tag[id].y < outpost.y + outpost.width, `${alliance} outpost holds tag ${id}`);
}
for (const shape of simplified.drawing) {
  assert.ok(shape.x >= -1e-9 && shape.y >= -1e-9 && shape.x + shape.length <= simplified.length + 1e-3 && shape.y + shape.width <= simplified.width + 1e-3, `${shape.element} inside field`);
}

// The View menu lists the same layouts the renderer accepts.
const main = fs.readFileSync(source("../electron/main.ts"), "utf8");
const menuIds = [...main.matchAll(/\{ id: "([^"]+)", label: "[^"]+" \}/g)].map(match => match[1]);
assert.deepEqual(menuIds, ["none", ...fieldLayouts.map(layout => layout.id)], "View → Field Layout ids");
console.log(`Field layout checks passed (${fieldLayouts.length} layouts).`);
