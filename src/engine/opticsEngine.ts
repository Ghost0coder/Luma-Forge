import { OpticsAdjustments } from '../types/editor';

/**
 * Professional Lens Optics Engine
 * Corrects geometric lens distortion, lateral chromatic aberration (defringing),
 * and flat-field optical vignetting.
 */

export function applyOpticsAdjustments(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  optics: OpticsAdjustments
): void {
  if (!optics) return;

  const hasDistortion = (optics.distortion || 0) !== 0;
  const hasCA = optics.chromaticAberration || (optics.caRedCyan || 0) !== 0 || (optics.caBlueYellow || 0) !== 0;
  const hasVignetteCorr = (optics.vignetteCorrection || 0) > 0;

  if (!hasDistortion && !hasCA && !hasVignetteCorr) return;

  const halfW = width / 2;
  const halfH = height / 2;
  const maxR = Math.hypot(halfW, halfH);

  // 1. Lens Vignette Profile Correction (flat-field corner illumination)
  if (hasVignetteCorr) {
    const factor = (optics.vignetteCorrection / 100) * 0.45;
    for (let y = 0; y < height; y++) {
      const dy = y - halfH;
      const row = y * width * 4;
      for (let x = 0; x < width; x++) {
        const dx = x - halfW;
        const normR = Math.hypot(dx, dy) / maxR;
        const boost = 1 + factor * Math.pow(normR, 2.5);
        const idx = row + x * 4;

        data[idx] = Math.min(255, Math.round(data[idx] * boost));
        data[idx + 1] = Math.min(255, Math.round(data[idx + 1] * boost));
        data[idx + 2] = Math.min(255, Math.round(data[idx + 2] * boost));
      }
    }
  }

  // 2. Geometric Lens Distortion and Chromatic Aberration
  if (hasDistortion || hasCA) {
    const src = new Uint8ClampedArray(data);
    const kDistort = ((optics.distortion || 0) / 100) * 0.22;

    const rShift = optics.chromaticAberration
      ? (((optics.caRedCyan ?? 0) / 100) * 0.012 + 0.003)
      : (((optics.caRedCyan ?? 0) / 100) * 0.012);

    const bShift = optics.chromaticAberration
      ? (((optics.caBlueYellow ?? 0) / 100) * 0.012 - 0.003)
      : (((optics.caBlueYellow ?? 0) / 100) * 0.012);

    for (let y = 0; y < height; y++) {
      const ny = (y - halfH) / halfH; // -1 to 1
      const row = y * width * 4;

      for (let x = 0; x < width; x++) {
        const nx = (x - halfW) / halfW; // -1 to 1
        const r2 = nx * nx + ny * ny;

        // Base geometric radial distortion factor
        const dFactor = hasDistortion ? (1 + kDistort * r2) : 1.0;

        // Channel coordinates
        const gxSrc = (nx * dFactor) * halfW + halfW;
        const gySrc = (ny * dFactor) * halfH + halfH;

        // Green channel (reference)
        data[row + x * 4 + 1] = sampleBilinear(src, width, height, gxSrc, gySrc, 1);

        // Red channel (with lateral chromatic aberration offset)
        if (rShift !== 0) {
          const rxSrc = (nx * (dFactor + rShift * r2)) * halfW + halfW;
          const rySrc = (ny * (dFactor + rShift * r2)) * halfH + halfH;
          data[row + x * 4] = sampleBilinear(src, width, height, rxSrc, rySrc, 0);
        } else {
          data[row + x * 4] = sampleBilinear(src, width, height, gxSrc, gySrc, 0);
        }

        // Blue channel (with lateral chromatic aberration offset)
        if (bShift !== 0) {
          const bxSrc = (nx * (dFactor + bShift * r2)) * halfW + halfW;
          const bySrc = (ny * (dFactor + bShift * r2)) * halfH + halfH;
          data[row + x * 4 + 2] = sampleBilinear(src, width, height, bxSrc, bySrc, 2);
        } else {
          data[row + x * 4 + 2] = sampleBilinear(src, width, height, gxSrc, gySrc, 2);
        }
      }
    }
  }
}

/**
 * Bilinear sampling helper for sub-pixel accuracy during geometric transformations
 */
function sampleBilinear(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
  channel: number
): number {
  if (x < 0 || x >= w - 1 || y < 0 || y >= h - 1) {
    const cx = Math.max(0, Math.min(w - 1, Math.round(x)));
    const cy = Math.max(0, Math.min(h - 1, Math.round(y)));
    return src[(cy * w + cx) * 4 + channel];
  }

  const x0 = Math.floor(x);
  const x1 = x0 + 1;
  const y0 = Math.floor(y);
  const y1 = y0 + 1;

  const dx = x - x0;
  const dy = y - y0;

  const i00 = (y0 * w + x0) * 4 + channel;
  const i10 = (y0 * w + x1) * 4 + channel;
  const i01 = (y1 * w + x0) * 4 + channel;
  const i11 = (y1 * w + x1) * 4 + channel;

  const v0 = src[i00] * (1 - dx) + src[i10] * dx;
  const v1 = src[i01] * (1 - dx) + src[i11] * dx;

  return Math.round(v0 * (1 - dy) + v1 * dy);
}
