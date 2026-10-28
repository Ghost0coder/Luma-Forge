import { HistogramData } from '../types/editor';

/**
 * Computes 256-bin RGB and Luminance histograms directly from a pixel buffer (ImageData array)
 * Zero DOM canvas allocations, lightning fast execution.
 */
export function computeHistogramFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number
): HistogramData {
  const red = new Array(256).fill(0);
  const green = new Array(256).fill(0);
  const blue = new Array(256).fill(0);
  const luminance = new Array(256).fill(0);

  const totalPixels = width * height;
  if (!data || data.length === 0 || totalPixels === 0) {
    return { red, green, blue, luminance, maxCount: 1, highlightClipping: 0, shadowClipping: 0 };
  }

  // Step sampling if buffer is very large to ensure sub-1ms computation time
  const step = totalPixels > 262144 ? Math.ceil(totalPixels / 262144) : 1;
  let shadowClipped = 0;
  let highlightClipped = 0;
  let sampledCount = 0;

  const len = data.length;
  const byteStep = step * 4;

  for (let i = 0; i < len; i += byteStep) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

    red[r]++;
    green[g]++;
    blue[b]++;
    luminance[lum]++;
    sampledCount++;

    if (r <= 2 && g <= 2 && b <= 2) shadowClipped++;
    if (r >= 253 && g >= 253 && b >= 253) highlightClipped++;
  }

  // Calculate max count for scaling (exclude extreme endpoints to prevent single-spike compression)
  let maxCount = 1;
  for (let i = 2; i < 254; i++) {
    if (red[i] > maxCount) maxCount = red[i];
    if (green[i] > maxCount) maxCount = green[i];
    if (blue[i] > maxCount) maxCount = blue[i];
    if (luminance[i] > maxCount) maxCount = luminance[i];
  }

  const normTotal = sampledCount || 1;
  return {
    red,
    green,
    blue,
    luminance,
    maxCount,
    highlightClipping: Math.round((highlightClipped / normTotal) * 1000) / 10,
    shadowClipping: Math.round((shadowClipped / normTotal) * 1000) / 10,
  };
}

/**
 * Computes 256-bin RGB and Luminance histograms from a rendered canvas
 */
export function computeHistogram(canvas: HTMLCanvasElement): HistogramData {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width === 0 || canvas.height === 0) {
    return {
      red: new Array(256).fill(0),
      green: new Array(256).fill(0),
      blue: new Array(256).fill(0),
      luminance: new Array(256).fill(0),
      maxCount: 1,
      highlightClipping: 0,
      shadowClipping: 0,
    };
  }

  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return computeHistogramFromImageData(imgData.data, canvas.width, canvas.height);
  } catch {
    return {
      red: new Array(256).fill(0),
      green: new Array(256).fill(0),
      blue: new Array(256).fill(0),
      luminance: new Array(256).fill(0),
      maxCount: 1,
      highlightClipping: 0,
      shadowClipping: 0,
    };
  }
}

