import { maxFieldImageBytes } from "../../../electron/uploadedField";

/** Read actual image bytes, never a temporary OS path, so an upload survives moving the original. */
export async function readFieldImage(file: File) {
  const extension = file.name.split(".").at(-1)?.toLowerCase();
  const type = file.type || ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" }[extension ?? ""]);
  if (!type || !["image/png", "image/jpeg", "image/webp"].includes(type)) throw Error("Choose a PNG, JPEG, or WebP field image.");
  if (!file.size || file.size > maxFieldImageBytes) throw Error("Choose a nonempty field image up to 10 MB.");
  let href = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error("Could not read this field image."));
    reader.readAsDataURL(new Blob([file], { type }));
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const decoded = new Image();
    decoded.onload = () => resolve(decoded);
    decoded.onerror = () => reject(Error("This file could not be decoded as a field image."));
    decoded.src = href;
  });
  if (image.naturalWidth > 16384 || image.naturalHeight > 16384 || image.naturalWidth * image.naturalHeight > 64_000_000)
    throw Error("Use a field image up to 16384 pixels per side and 64 megapixels.");
  // Chromium decodes WebP, while Electron's nativeImage accepts PNG/JPEG on Windows.
  if (type === "image/webp") {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw Error("Could not prepare this field image.");
    context.drawImage(image, 0, 0);
    href = canvas.toDataURL("image/png");
    if (href.length > Math.ceil(maxFieldImageBytes / 3) * 4 + 64)
      throw Error("The decoded field image is too large to save. Choose a smaller image.");
  }
  return { href, pixelWidth: image.naturalWidth, pixelHeight: image.naturalHeight, rotate180: false };
}
