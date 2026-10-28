/**
 * Deterministic Subject & Spatial Contrast Masking Engine for LumaForge
 * Calculates subject probability using spatial contrast, border seeds, and Gaussian saliency priors.
 * Works 100% offline in-browser with zero network requests or AI inference dependencies.
 */

export interface AISegmentationResult {
  bitmap: number[]; // 0 to 255 alpha values
  width: number;
  height: number;
  modelName: string;
  license: string;
  downloadSize: string;
  inferenceTimeMs: number;
}

/**
 * High-precision browser-native saliency and spatial contrast segmentation
 * Works 100% offline in local browser session
 */
export function runLocalSaliencySegmentation(
  canvas: HTMLCanvasElement | HTMLImageElement,
  targetW = 256,
  targetH = 256
): number[] {
  const temp = document.createElement('canvas');
  temp.width = targetW;
  temp.height = targetH;
  const ctx = temp.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Array(targetW * targetH).fill(255);

  ctx.drawImage(canvas, 0, 0, targetW, targetH);
  const imgData = ctx.getImageData(0, 0, targetW, targetH);
  const data = imgData.data;

  // 1. Compute border color statistics (background seeds)
  let bgR = 0, bgG = 0, bgB = 0, bgCount = 0;
  for (let x = 0; x < targetW; x++) {
    // Top border
    let idx = (0 * targetW + x) * 4;
    bgR += data[idx]; bgG += data[idx + 1]; bgB += data[idx + 2]; bgCount++;
    // Bottom border
    idx = ((targetH - 1) * targetW + x) * 4;
    bgR += data[idx]; bgG += data[idx + 1]; bgB += data[idx + 2]; bgCount++;
  }
  for (let y = 0; y < targetH; y++) {
    // Left border
    let idx = (y * targetW + 0) * 4;
    bgR += data[idx]; bgG += data[idx + 1]; bgB += data[idx + 2]; bgCount++;
    // Right border
    idx = (y * targetW + (targetW - 1)) * 4;
    bgR += data[idx]; bgG += data[idx + 1]; bgB += data[idx + 2]; bgCount++;
  }
  bgR /= bgCount;
  bgG /= bgCount;
  bgB /= bgCount;

  const rawAlpha = new Float32Array(targetW * targetH);
  const cx = targetW / 2;
  const cy = targetH * 0.45; // slightly higher than center for natural portrait/subject framing
  const maxR = Math.hypot(targetW * 0.45, targetH * 0.45);

  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const idx = (y * targetW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Color distance from background seed
      const dr = r - bgR;
      const dg = g - bgG;
      const db = b - bgB;
      const colorDist = Math.sqrt(dr * dr + dg * dg + db * db) / 441.67; // 0..1

      // Center-spatial prior (Gaussian falloff)
      const distCenter = Math.hypot(x - cx, y - cy);
      const spatialWeight = Math.exp(-Math.pow(distCenter / maxR, 2) * 1.8);

      // Contrast against local surroundings
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const lumDist = Math.abs(lum - (0.2126 * bgR + 0.7152 * bgG + 0.0722 * bgB)) / 255;

      // Combined subject probability
      let prob = colorDist * 0.45 + lumDist * 0.35 + spatialWeight * 0.45;

      // Sigmoid thresholding for clean subject separation
      prob = 1 / (1 + Math.exp(-10 * (prob - 0.42)));
      rawAlpha[y * targetW + x] = Math.max(0, Math.min(1, prob));
    }
  }

  // 2. Spatial box/Gaussian filter smoothing to remove edge noise
  const smoothed = new Uint8ClampedArray(targetW * targetH);
  for (let y = 1; y < targetH - 1; y++) {
    for (let x = 1; x < targetW - 1; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += rawAlpha[(y + dy) * targetW + (x + dx)];
        }
      }
      smoothed[y * targetW + x] = Math.round((sum / 9) * 255);
    }
  }

  return Array.from(smoothed);
}

/**
 * Runs deterministic subject segmentation on a source image or canvas
 */
export async function segmentSubject(
  source: HTMLImageElement | HTMLCanvasElement
): Promise<AISegmentationResult> {
  const startTime = performance.now();
  const targetW = 256;
  const targetH = 256;

  const bitmap = runLocalSaliencySegmentation(source, targetW, targetH);
  const elapsed = Math.round(performance.now() - startTime);

  return {
    bitmap,
    width: targetW,
    height: targetH,
    modelName: 'LumaForge Local Saliency Engine',
    license: 'MIT / Open Source',
    downloadSize: '0 KB (Local In-Memory)',
    inferenceTimeMs: elapsed,
  };
}
