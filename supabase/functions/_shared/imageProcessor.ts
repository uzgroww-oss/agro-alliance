/**
 * Image processing utilities – built on `sharp` and auxiliary libraries.
 * Each function receives a Buffer of the source image and returns a Buffer
 * (or metadata) appropriate for the transformation.
 */

import sharp from "npm:sharp@0.33.4";
import { encode } from "npm:blurhash@2.0.5";
import exifParser from "npm:exif-parser@0.1.12";
import { createHash } from "node:crypto";

/** Resize to thumbnail (max 200px width or height) and output as JPEG */
export async function generateThumbnail(input: Buffer): Promise<{ data: Buffer; width: number; height: number; size: number }> {
  const img = sharp(input);
  const metadata = await img.metadata();
  const maxDim = 200;
  const resized = img.resize({
    width: metadata.width && metadata.width > metadata.height ? maxDim : undefined,
    height: metadata.height && metadata.height >= metadata.width ? maxDim : undefined,
    fit: sharp.fit.inside,
    withoutEnlargement: true,
  }).jpeg({ quality: 80 });
  const data = await resized.toBuffer();
  const { width, height, size } = await resized.metadata();
  return { data, width: width ?? 0, height: height ?? 0, size: data.length };
}

/** Convert to WebP */
export async function convertToWebp(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const img = sharp(input);
  const { data, info } = await img.webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Convert to AVIF */
export async function convertToAvif(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const img = sharp(input);
  const { data, info } = await img.avif({ quality: 80 }).toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** JPEG optimization – re‑encode with quality and strip metadata */
export async function optimizeJpeg(input: Buffer): Promise<{ data: Buffer; size: number }> {
  const img = sharp(input);
  const { data } = await img.jpeg({ quality: 85, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  return { data, size: data.length };
}

/** PNG optimization – reduce colors, compress */
export async function optimizePng(input: Buffer): Promise<{ data: Buffer; size: number }> {
  const img = sharp(input);
  const { data } = await img.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer({ resolveWithObject: true });
  return { data, size: data.length };
}

/** Compute BlurHash string (default 4x3 components) */
export async function computeBlurHash(input: Buffer): Promise<string> {
  const img = sharp(input).raw();
  const { data, info } = await img.toBuffer({ resolveWithObject: true });
  return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
}

/** Extract dominant color (average of all pixels) */
export async function extractDominantColor(input: Buffer): Promise<string> {
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  const pixels = info.width * info.height;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  r = Math.round(r / pixels);
  g = Math.round(g / pixels);
  b = Math.round(b / pixels);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Extract EXIF (if any) */
export function extractExif(input: Buffer): Record<string, unknown> {
  try {
    const parser = exifParser.create(input);
    const result = parser.parse();
    return result.tags ?? {};
  } catch {
    return {};
  }
}

/** Correct image orientation based on EXIF */
export async function correctOrientation(input: Buffer): Promise<Buffer> {
  const img = sharp(input);
  const metadata = await img.metadata();
  if (metadata.orientation && metadata.orientation !== 1) {
    return await img.rotate().toBuffer();
  }
  return input;
}

/** Extract basic metadata (width, height, format, size) */
export async function extractMetadata(input: Buffer): Promise<{ width: number; height: number; format: string; size: number }> {
  const img = sharp(input);
  const meta = await img.metadata();
  return {
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    format: meta.format ?? "unknown",
    size: input.length,
  };
}

/** Compute SHA‑256 hash of a buffer (hex string) */
export function computeHash(input: Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}
