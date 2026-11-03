import { DetailAdjustments } from '../types/editor';

/**
 * Professional Image Detail & Texture Processing Engine
 * High-performance, memory-efficient in-place pixel buffer algorithms
 * Suitable for both Web Worker and main-thread execution
 */

/**
 * Professional Sharpening:
 * - Amount (0 to 150): Boost multiplier
 * - Radius (0.5 to 3.0 px): Spatial convolution reach
 * - Detail (0 to 100): High-frequency threshold preservation
 * - Masking (0 to 100): Edge-detection mask so flat areas (skin, sky) remain unsharpened
 */
export function applyProfessionalSharpening(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  details: DetailAdjustments
): void {
  const amount = details.sharpenAmount;
  if (amount <= 0 || width < 4 || height < 4) return;

  const strength = (amount / 100) * 1.25;
  const radius = Math.max(0.5, Math.min(3.0, details.sharpenRadius || 1.0));
  const detailThreshold = (100 - (details.sharpenDetail ?? 25)) * 0.4; // 0 to 40
  const maskingThreshold = (details.sharpenMasking || 0) * 0.8; // 0 to 80

  const len = data.length;
  // Compute luminance buffer for analysis & edge masking
  const lum = new Float32Array(width * height);
  for (let i = 0, p = 0; i < len; i += 4, p++) {
    lum[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }

  // Pre-calculate edge mask using Sobel gradient magnitude if masking > 0
  const edgeMask = maskingThreshold > 0 ? new Float32Array(width * height) : null;
  if (edgeMask) {
    for (let y = 1; y < height - 1; y++) {
      const row = y * width;
      const up = (y - 1) * width;
      const down = (y + 1) * width;
      for (let x = 1; x < width - 1; x++) {
        const gx =
          -lum[up + x - 1] + lum[up + x + 1] -
          2 * lum[row + x - 1] + 2 * lum[row + x + 1] -
          lum[down + x - 1] + lum[down + x + 1];
        const gy =
          -lum[up + x - 1] - 2 * lum[up + x] - lum[up + x + 1] +
          lum[down + x - 1] + 2 * lum[down + x] + lum[down + x + 1];
        const mag = Math.hypot(gx, gy);
        edgeMask[row + x] = Math.max(0, Math.min(1, (mag - maskingThreshold) / 20));
      }
    }
  }

  // Spatial blur buffer for unsharp masking
  // For radius <= 1.0 use fast 3x3 kernel, for radius > 1.0 use 5x5 separable kernel
  const blurred = new Float32Array(width * height);
  const rInt = radius > 1.5 ? 2 : 1;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -rInt; dy <= rInt; dy++) {
        const ny = Math.max(0, Math.min(height - 1, y + dy));
        const nRow = ny * width;
        for (let dx = -rInt; dx <= rInt; dx++) {
          const nx = Math.max(0, Math.min(width - 1, x + dx));
          sum += lum[nRow + nx];
          count++;
        }
      }
      blurred[row + x] = sum / count;
    }
  }

  // Apply unsharp mask high-pass boost with detail suppression & edge masking
  for (let p = 0; p < width * height; p++) {
    const diff = lum[p] - blurred[p];
    const absDiff = Math.abs(diff);

    // Detail threshold suppression (suppresses micro-noise in low-detail areas)
    if (absDiff <= detailThreshold) continue;

    // Masking factor: only sharpen high-contrast edges when masking > 0
    const maskFactor = edgeMask ? edgeMask[p] : 1.0;
    if (maskFactor <= 0.01) continue;

    const delta = (diff - Math.sign(diff) * detailThreshold) * strength * maskFactor;
    const idx = p * 4;

    data[idx] = Math.max(0, Math.min(255, data[idx] + delta));
    data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + delta));
    data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + delta));
  }
}

/**
 * Professional Noise Reduction:
 * - Luminance NR: Edge-preserving bilateral filter on luminance
 * - Luminance Detail: Threshold preserving fine textures
 * - Luminance Contrast: Prevents washed out blacks in shadows
 * - Color Noise Reduction: Separable chrominance smoothing on Cb/Cr channels
 */
export function applyProfessionalNoiseReduction(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  details: DetailAdjustments
): void {
  const lumNR = details.noiseLuminance;
  const colNR = details.noiseColor;

  if ((lumNR <= 0 && colNR <= 0) || width < 4 || height < 4) return;

  const len = data.length;

  // 1. Color Noise Reduction (Chrominance low-pass filter)
  if (colNR > 0) {
    const colStrength = (colNR / 100) * 0.85;
    const colRadius = Math.max(1, Math.round(((details.noiseSmoothness ?? 50) / 100) * 3));
    const cbBuf = new Float32Array(width * height);
    const crBuf = new Float32Array(width * height);

    // Convert RGB to YCbCr chrominance
    for (let i = 0, p = 0; i < len; i += 4, p++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      cbBuf[p] = -0.1687 * r - 0.3313 * g + 0.5 * b;
      crBuf[p] = 0.5 * r - 0.4187 * g - 0.0813 * b;
    }

    // Filter chrominance buffer
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        let sumCb = 0;
        let sumCr = 0;
        let count = 0;
        for (let dy = -colRadius; dy <= colRadius; dy++) {
          const ny = Math.max(0, Math.min(height - 1, y + dy));
          const nRow = ny * width;
          for (let dx = -colRadius; dx <= colRadius; dx++) {
            const nx = Math.max(0, Math.min(width - 1, x + dx));
            sumCb += cbBuf[nRow + nx];
            sumCr += crBuf[nRow + nx];
            count++;
          }
        }

        const avgCb = sumCb / count;
        const avgCr = sumCr / count;
        const p = row + x;
        const idx = p * 4;

        const origCb = cbBuf[p];
        const origCr = crBuf[p];
        const newCb = origCb * (1 - colStrength) + avgCb * colStrength;
        const newCr = origCr * (1 - colStrength) + avgCr * colStrength;

        // Delta back into RGB
        const dCb = newCb - origCb;
        const dCr = newCr - origCr;

        data[idx] = Math.max(0, Math.min(255, data[idx] + 1.402 * dCr));
        data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] - 0.34414 * dCb - 0.71414 * dCr));
        data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + 1.772 * dCb));
      }
    }
  }

  // 2. Luminance Noise Reduction (Edge-preserving bilateral filter)
  if (lumNR > 0) {
    const lumFactor = (lumNR / 100) * 0.75;
    const edgeThreshold = Math.max(5, (100 - (details.noiseLuminanceDetail ?? 50)) * 0.6); // 5 to 65
    const contrastProtect = ((details.noiseLuminanceContrast ?? 0) / 100) * 0.4;

    const copy = new Uint8ClampedArray(data);

    for (let y = 1; y < height - 1; y++) {
      const row = y * width * 4;
      const up = (y - 1) * width * 4;
      const down = (y + 1) * width * 4;

      for (let x = 1; x < width - 1; x++) {
        const idx = row + x * 4;
        const cR = copy[idx];
        const cG = copy[idx + 1];
        const cB = copy[idx + 2];
        const cLum = 0.2126 * cR + 0.7152 * cG + 0.0722 * cB;

        // Skip deep shadow contrast if contrastProtect is high
        if (contrastProtect > 0 && (cLum < 25 || cLum > 230)) {
          continue;
        }

        let sumR = 0, sumG = 0, sumB = 0, weightSum = 0;

        const neighborIndices = [
          idx - 4,
          idx + 4,
          up + x * 4,
          down + x * 4,
          up + (x - 1) * 4,
          up + (x + 1) * 4,
          down + (x - 1) * 4,
          down + (x + 1) * 4,
        ];

        for (let k = 0; k < 8; k++) {
          const nIdx = neighborIndices[k];
          const nR = copy[nIdx];
          const nG = copy[nIdx + 1];
          const nB = copy[nIdx + 2];
          const nLum = 0.2126 * nR + 0.7152 * nG + 0.0722 * nB;

          const diff = Math.abs(cLum - nLum);
          if (diff < edgeThreshold) {
            const w = Math.cos((diff / edgeThreshold) * (Math.PI / 2));
            sumR += nR * w;
            sumG += nG * w;
            sumB += nB * w;
            weightSum += w;
          }
        }

        if (weightSum > 0) {
          const avgR = sumR / weightSum;
          const avgG = sumG / weightSum;
          const avgB = sumB / weightSum;

          data[idx] = Math.round(cR * (1 - lumFactor) + avgR * lumFactor);
          data[idx + 1] = Math.round(cG * (1 - lumFactor) + avgG * lumFactor);
          data[idx + 2] = Math.round(cB * (1 - lumFactor) + avgB * lumFactor);
        }
      }
    }
  }
}

/**
 * Professional Texture Adjustment:
 * High-frequency micro-contrast enhancement without haloing.
 * Boosts subtle details (skin pores, fabric weave, foliage) or provides natural softening.
 */
export function applyTextureAdjustment(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  textureAmount: number
): void {
  if (textureAmount === 0 || width < 4 || height < 4) return;

  const strength = (textureAmount / 100) * 0.6;
  const len = data.length;

  // Extract luminance
  const lum = new Float32Array(width * height);
  for (let i = 0, p = 0; i < len; i += 4, p++) {
    lum[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }

  // Dual-radius difference to isolate high-frequency band without mid-frequency halos
  const blurSmall = new Float32Array(width * height);
  const blurMedium = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    const up = (y - 1) * width;
    const down = (y + 1) * width;

    for (let x = 1; x < width - 1; x++) {
      const p = row + x;
      // 3x3 small box blur
      blurSmall[p] =
        (lum[up + x - 1] + lum[up + x] + lum[up + x + 1] +
          lum[row + x - 1] + lum[p] + lum[row + x + 1] +
          lum[down + x - 1] + lum[down + x] + lum[down + x + 1]) / 9;
    }
  }

  // Second pass: 5x5 medium blur
  for (let y = 2; y < height - 2; y++) {
    const row = y * width;
    for (let x = 2; x < width - 2; x++) {
      let sum = 0;
      for (let dy = -2; dy <= 2; dy++) {
        const ny = (y + dy) * width;
        for (let dx = -2; dx <= 2; dx++) {
          sum += blurSmall[ny + (x + dx)];
        }
      }
      blurMedium[row + x] = sum / 25;
    }
  }

  // High-frequency band = blurSmall - blurMedium
  for (let p = 0; p < width * height; p++) {
    const highFreq = blurSmall[p] - blurMedium[p];
    // Threshold high frequencies to prevent amplifying hard edge halos
    if (Math.abs(highFreq) < 40) {
      const delta = highFreq * strength;
      const idx = p * 4;
      data[idx] = Math.max(0, Math.min(255, data[idx] + delta));
      data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + delta));
      data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + delta));
    }
  }
}
