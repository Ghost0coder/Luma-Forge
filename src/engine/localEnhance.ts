import { Adjustments } from '../types/editor';

/**
 * Fast client-side photographic analysis to compute balanced auto-levels
 */
export function computeAutoEnhance(canvas: HTMLCanvasElement): Partial<Adjustments> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width === 0 || canvas.height === 0) {
    return { exposure: 0.15, contrast: 10, highlights: -15, shadows: 20, vibrance: 15 };
  }

  // Downsample to 128x128 for rapid calculation
  const sampleW = 128;
  const sampleH = 128;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = sampleW;
  tempCanvas.height = sampleH;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) {
    return { exposure: 0.15, contrast: 10, highlights: -15, shadows: 20, vibrance: 15 };
  }

  tempCtx.drawImage(canvas, 0, 0, sampleW, sampleH);
  const data = tempCtx.getImageData(0, 0, sampleW, sampleH).data;
  const totalPixels = sampleW * sampleH;

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumLum = 0;

  const lumHistogram = new Array(256).fill(0);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

    sumR += r;
    sumG += g;
    sumB += b;
    sumLum += lum;
    lumHistogram[lum]++;
  }

  const avgR = sumR / totalPixels;
  const avgG = sumG / totalPixels;
  const avgB = sumB / totalPixels;
  const avgLum = sumLum / totalPixels;

  // Find 1st percentile and 99th percentile luminance
  let count = 0;
  let p1 = 0;
  let p99 = 255;
  const threshold1 = totalPixels * 0.01;
  const threshold99 = totalPixels * 0.99;

  for (let i = 0; i < 256; i++) {
    count += lumHistogram[i];
    if (p1 === 0 && count >= threshold1) {
      p1 = i;
    }
    if (count >= threshold99) {
      p99 = i;
      break;
    }
  }

  // 1. Exposure adjustment: aim for mid-gray ~ 120-128
  const targetLum = 122;
  let suggestedExp = 0;
  if (avgLum > 10) {
    const ratio = targetLum / avgLum;
    // Clamp exposure to [-1.5, +1.5]
    suggestedExp = Math.max(-1.5, Math.min(1.5, Math.log2(ratio) * 0.7));
  }

  // 2. Contrast adjustment based on dynamic range spread
  const dynamicRange = p99 - p1;
  let suggestedContrast = 0;
  if (dynamicRange < 140) {
    suggestedContrast = Math.min(30, Math.round((140 - dynamicRange) * 0.35));
  } else if (dynamicRange > 220) {
    suggestedContrast = -5;
  }

  // 3. Highlight recovery & shadow lift
  let suggestedHighlights = 0;
  let suggestedShadows = 0;

  if (p99 > 240) {
    suggestedHighlights = -Math.min(45, Math.round((p99 - 220) * 1.5));
  }
  if (p1 < 30) {
    suggestedShadows = Math.min(40, Math.round((30 - p1) * 1.2));
  } else {
    suggestedShadows = 15;
  }

  // 4. White balance (Gray world approximation)
  const avgGray = (avgR + avgG + avgB) / 3;
  let suggestedTemp = 0;
  let suggestedTint = 0;

  if (avgB > 0 && avgR > 0) {
    const tempDelta = (avgGray - avgB) - (avgGray - avgR);
    suggestedTemp = Math.max(-25, Math.min(25, Math.round(tempDelta * 0.4)));
  }
  if (avgG > 0) {
    const tintDelta = avgGray - avgG;
    suggestedTint = Math.max(-20, Math.min(20, Math.round(tintDelta * 0.4)));
  }

  return {
    exposure: Math.round(suggestedExp * 100) / 100,
    contrast: suggestedContrast,
    highlights: suggestedHighlights,
    shadows: suggestedShadows,
    temperature: suggestedTemp,
    tint: suggestedTint,
    vibrance: 14,
    clarity: 10,
    sharpening: 15,
  };
}
