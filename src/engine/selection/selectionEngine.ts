/**
 * Traditional Non-AI Computer Vision Object Selection Engine for LumaForge
 * Pure mathematical and pixel-buffer algorithms:
 * - Rasterized brush selection with smooth interpolation and feathering
 * - Freehand lasso and polygon rasterization via ray-casting point-in-polygon
 * - Color-range selection with perceptual Euclidean distance & contiguous BFS flood fill
 * - Morphological dilation (expand), erosion (contract), Gaussian feathering, and inversion
 *
 * Runs 100% offline in browser without network, AI models, or external runtimes.
 */

import { LocalMaskAdjustments } from '../../types/editor';

/**
 * Creates an empty zero-filled selection mask
 */
export function createEmptySelection(width: number, height: number): number[] {
  return new Array(width * height).fill(0);
}

/**
 * Resamples a mask buffer from (oldW x oldH) to (newW x newH) using nearest/bilinear interpolation
 * Prevents mask loss during viewport resize, zoom, or dimension changes.
 */
export function resampleMask(
  oldMask: number[],
  oldW: number,
  oldH: number,
  newW: number,
  newH: number
): number[] {
  if (oldW === newW && oldH === newH) return [...oldMask];
  const newMask = new Array(newW * newH);
  const sx = oldW / newW;
  const sy = oldH / newH;

  for (let y = 0; y < newH; y++) {
    const oy = Math.min(oldH - 1, Math.floor(y * sy));
    for (let x = 0; x < newW; x++) {
      const ox = Math.min(oldW - 1, Math.floor(x * sx));
      newMask[y * newW + x] = oldMask[oy * oldW + ox] || 0;
    }
  }

  return newMask;
}

/**
 * Point in polygon check using ray-casting algorithm
 */
export function isPointInPolygon(px: number, py: number, points: { x: number; y: number }[]): boolean {
  let inside = false;
  const len = points.length;
  if (len < 3) return false;

  for (let i = 0, j = len - 1; i < len; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Rasterizes polygon / lasso points onto a selection mask buffer
 */
export function applyPolygonToSelection(
  mask: number[],
  width: number,
  height: number,
  normalizedPoints: { x: number; y: number }[],
  isAdd = true
): number[] {
  if (normalizedPoints.length < 3) return mask;

  // Convert normalized [0, 1] points to pixel coordinates
  const pixelPoints = normalizedPoints.map((p) => ({
    x: p.x * width,
    y: p.y * height,
  }));

  // Find bounding box to minimize ray casts
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  for (const pt of pixelPoints) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const startX = Math.max(0, Math.floor(minX));
  const endX = Math.min(width - 1, Math.ceil(maxX));
  const startY = Math.max(0, Math.floor(minY));
  const endY = Math.min(height - 1, Math.ceil(maxY));

  const result = [...mask];
  const targetVal = isAdd ? 255 : 0;

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      if (isPointInPolygon(x + 0.5, y + 0.5, pixelPoints)) {
        result[y * width + x] = targetVal;
      }
    }
  }

  return result;
}

/**
 * Rasterizes smooth brush stroke onto selection mask
 */
export function applyBrushStrokeToSelection(
  mask: number[],
  width: number,
  height: number,
  x0: number, // pixel coords
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  feather = 0,
  isAdd = true
): number[] {
  const result = [...mask];
  const targetVal = isAdd ? 255 : 0;
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / Math.max(1, radius * 0.35)));

  const rFloor = Math.ceil(radius);
  const rSq = radius * radius;
  const innerR = Math.max(0, radius - feather);
  const innerRSq = innerR * innerR;

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = Math.round(x0 + (x1 - x0) * t);
    const cy = Math.round(y0 + (y1 - y0) * t);

    const minX = Math.max(0, cx - rFloor);
    const maxX = Math.min(width - 1, cx + rFloor);
    const minY = Math.max(0, cy - rFloor);
    const maxY = Math.min(height - 1, cy + rFloor);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (dSq <= rSq) {
          const idx = y * width + x;
          if (feather <= 0 || dSq <= innerRSq) {
            result[idx] = targetVal;
          } else {
            const d = Math.sqrt(dSq);
            const alphaFactor = Math.cos(((d - innerR) / feather) * (Math.PI / 2));
            const strokeAlpha = Math.round(alphaFactor * 255);
            if (isAdd) {
              result[idx] = Math.max(result[idx], strokeAlpha);
            } else {
              result[idx] = Math.min(result[idx], 255 - strokeAlpha);
            }
          }
        }
      }
    }
  }

  return result;
}

/**
 * Color-range selection: calculates perceptual color distance from seed
 * and optionally runs BFS flood fill for contiguous regions
 */
export function applyColorRangeToSelection(
  pixelData: Uint8ClampedArray,
  mask: number[],
  width: number,
  height: number,
  seedR: number,
  seedG: number,
  seedB: number,
  tolerance: number, // 1 to 100
  contiguous = false,
  seedPixelX?: number,
  seedPixelY?: number,
  isAdd = true
): number[] {
  const result = [...mask];
  const targetVal = isAdd ? 255 : 0;
  const tolNorm = tolerance / 100;

  // Color distance threshold (perceptual Euclidean in sRGB)
  function getColorDist(r: number, g: number, b: number): number {
    const dr = r - seedR;
    const dg = g - seedG;
    const db = b - seedB;
    // Weighted Euclidean matching human eye sensitivity
    return Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db) / 255;
  }

  if (!contiguous || seedPixelX == null || seedPixelY == null) {
    // Global non-contiguous color range selection
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pIdx = (y * width + x) * 4;
        const d = getColorDist(pixelData[pIdx], pixelData[pIdx + 1], pixelData[pIdx + 2]);
        if (d <= tolNorm) {
          result[y * width + x] = targetVal;
        }
      }
    }
    return result;
  }

  // Contiguous 4-way BFS flood fill starting from seed
  const visited = new Uint8Array(width * height);
  const queue: number[] = [seedPixelY * width + seedPixelX];
  visited[seedPixelY * width + seedPixelX] = 1;

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    result[curr] = targetVal;

    // Check 4 neighbors
    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        if (!visited[nIdx]) {
          visited[nIdx] = 1;
          const pIdx = nIdx * 4;
          const d = getColorDist(pixelData[pIdx], pixelData[pIdx + 1], pixelData[pIdx + 2]);
          if (d <= tolNorm) {
            queue.push(nIdx);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Inverts the selection mask (255 -> 0, 0 -> 255)
 */
export function invertSelectionMask(mask: number[]): number[] {
  return mask.map((v) => 255 - v);
}

/**
 * Morphological dilation (expands selection by radius pixels)
 */
export function expandSelectionMask(mask: number[], width: number, height: number, radius = 4): number[] {
  const result = new Array(width * height).fill(0);
  const rSq = radius * radius;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] > 128) {
        const minY = Math.max(0, y - radius);
        const maxY = Math.min(height - 1, y + radius);
        const minX = Math.max(0, x - radius);
        const maxX = Math.min(width - 1, x + radius);

        for (let ny = minY; ny <= maxY; ny++) {
          for (let nx = minX; nx <= maxX; nx++) {
            if ((nx - x) * (nx - x) + (ny - y) * (ny - y) <= rSq) {
              result[ny * width + nx] = 255;
            }
          }
        }
      }
    }
  }

  return result;
}

/**
 * Morphological erosion (contracts selection by radius pixels)
 */
export function contractSelectionMask(mask: number[], width: number, height: number, radius = 4): number[] {
  const result = [...mask];
  const rSq = radius * radius;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] > 0) {
        // If any pixel in neighborhood is unselected, this pixel becomes unselected
        let hasUnselectedNeighbor = false;
        const minY = Math.max(0, y - radius);
        const maxY = Math.min(height - 1, y + radius);
        const minX = Math.max(0, x - radius);
        const maxX = Math.min(width - 1, x + radius);

        for (let ny = minY; ny <= maxY && !hasUnselectedNeighbor; ny++) {
          for (let nx = minX; nx <= maxX; nx++) {
            if ((nx - x) * (nx - x) + (ny - y) * (ny - y) <= rSq) {
              if (mask[ny * width + nx] < 128) {
                hasUnselectedNeighbor = true;
                break;
              }
            }
          }
        }

        if (hasUnselectedNeighbor) {
          result[y * width + x] = 0;
        }
      }
    }
  }

  return result;
}

/**
 * Gaussian-like feathering for smooth soft selection edges
 */
export function featherSelectionMask(mask: number[], width: number, height: number, radius = 4): number[] {
  if (radius <= 0) return mask;
  const result = new Array(width * height).fill(0);
  const r = Math.max(1, Math.round(radius));

  // Horizontal blur pass
  const temp = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < width) {
          sum += mask[y * width + nx];
          count++;
        }
      }
      temp[y * width + x] = sum / count;
    }
  }

  // Vertical blur pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) {
          sum += temp[ny * width + x];
          count++;
        }
      }
      result[y * width + x] = Math.round(sum / count);
    }
  }

  return result;
}

/**
 * Applies local tone adjustments specifically to selected pixels
 */
export function applyAdjustmentsToSelection(
  targetCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mask: number[],
  adjustments: LocalMaskAdjustments
): void {
  const imgData = targetCtx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const exposureMult = Math.pow(2, adjustments.exposure || 0);
  const contrastFactor =
    adjustments.contrast !== 0
      ? (259 * ((adjustments.contrast || 0) + 255)) / (255 * (259 - (adjustments.contrast || 0)))
      : 1;
  const satFactor = 1 + (adjustments.saturation || 0) / 100;
  const tempOffset = (adjustments.temperature || 0) / 100;
  const rTempMult = 1 + tempOffset * 0.25;
  const bTempMult = 1 - tempOffset * 0.25;

  const hasAdjustments =
    adjustments.exposure !== 0 ||
    adjustments.contrast !== 0 ||
    adjustments.saturation !== 0 ||
    adjustments.temperature !== 0;

  if (!hasAdjustments) return;

  for (let i = 0; i < mask.length; i++) {
    const alpha = mask[i] / 255;
    if (alpha <= 0.005) continue;

    const pIdx = i * 4;
    let r = data[pIdx];
    let g = data[pIdx + 1];
    let b = data[pIdx + 2];

    // Temperature
    r *= rTempMult;
    b *= bTempMult;

    // Exposure
    r *= exposureMult;
    g *= exposureMult;
    b *= exposureMult;

    // Contrast
    if (adjustments.contrast !== 0) {
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;
    }

    // Saturation
    if (adjustments.saturation !== 0) {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = lum + (r - lum) * satFactor;
      g = lum + (g - lum) * satFactor;
      b = lum + (b - lum) * satFactor;
    }

    // Clamp
    const cr = Math.max(0, Math.min(255, Math.round(r)));
    const cg = Math.max(0, Math.min(255, Math.round(g)));
    const cb = Math.max(0, Math.min(255, Math.round(b)));

    // Blend using selection mask alpha weight
    data[pIdx] = Math.round(data[pIdx] * (1 - alpha) + cr * alpha);
    data[pIdx + 1] = Math.round(data[pIdx + 1] * (1 - alpha) + cg * alpha);
    data[pIdx + 2] = Math.round(data[pIdx + 2] * (1 - alpha) + cb * alpha);
  }

  targetCtx.putImageData(imgData, 0, 0);
}
