import { HistogramData } from '../types/editor';

/**
 * Computes 256-bin RGB and Luminance histograms from a rendered canvas
 */
export function computeHistogram(canvas: HTMLCanvasElement): HistogramData {
  const red = new Array(256).fill(0);
  const green = new Array(256).fill(0);
  const blue = new Array(256).fill(0);
  const luminance = new Array(256).fill(0);

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width === 0 || canvas.height === 0) {
    return {
      red,
      green,
      blue,
      luminance,
      maxCount: 1,
      highlightClipping: 0,
      shadowClipping: 0,
    };
  }

  // Sample down if canvas is large to keep it lightning fast (<= 256x256 sampling)
  const sampleW = Math.min(256, canvas.width);
  const sampleH = Math.min(256, canvas.height);
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = sampleW;
  tempCanvas.height = sampleH;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) {
    return { red, green, blue, luminance, maxCount: 1, highlightClipping: 0, shadowClipping: 0 };
  }

  tempCtx.drawImage(canvas, 0, 0, sampleW, sampleH);
  const imgData = tempCtx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;
  const totalPixels = sampleW * sampleH;

  let shadowClipped = 0;
  let highlightClipped = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

    red[r]++;
    green[g]++;
    blue[b]++;
    luminance[lum]++;

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

  return {
    red,
    green,
    blue,
    luminance,
    maxCount,
    highlightClipping: Math.round((highlightClipped / totalPixels) * 1000) / 10,
    shadowClipping: Math.round((shadowClipped / totalPixels) * 1000) / 10,
  };
}
