export const uploadedFieldId = "uploaded-field";
export const maxFieldImageBytes = 10 * 1024 * 1024;

export type UploadedField = {
  version: 1;
  label: string;
  length: number;
  width: number;
  image: { href: string; pixelWidth: number; pixelHeight: number; rotate180: boolean };
};

/** Keep the on-disk upload bounded and independent of arbitrary file paths or URLs. */
export function validateUploadedField(value: unknown): UploadedField {
  if (!value || typeof value !== "object") throw Error("Invalid uploaded field.");
  const field = value as UploadedField;
  if (field.version !== 1 || typeof field.label !== "string" || !field.label.trim() || field.label.trim().length > 80)
    throw Error("Enter a field name between 1 and 80 characters.");
  if (![field.length, field.width].every(number => typeof number === "number" && Number.isFinite(number) && number > 0))
    throw Error("Field dimensions must be positive, finite numbers.");
  const image = field.image;
  if (!image || ![image.pixelWidth, image.pixelHeight].every(number => Number.isInteger(number) && number > 0 && number <= 16384)
      || image.pixelWidth * image.pixelHeight > 64_000_000 || typeof image.rotate180 !== "boolean")
    throw Error("Use a field image up to 16384 pixels per side and 64 megapixels.");
  if (typeof image.href !== "string" || image.href.length > Math.ceil(maxFieldImageBytes / 3) * 4 + 64
      || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image.href))
    throw Error("Use a PNG, JPEG, or WebP image up to 10 MB.");
  return { version: 1, label: field.label.trim(), length: field.length, width: field.width,
    image: { href: image.href, pixelWidth: image.pixelWidth, pixelHeight: image.pixelHeight, rotate180: image.rotate180 } };
}
