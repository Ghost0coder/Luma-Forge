import { Adjustments, LocalMask } from '../types/editor';
import {
  generateCurveLUT,
  isCurveDefault,
  rgbToHsl,
  hslToRgb,
  prepareHslMixer,
  applyHslMixer,
  prepareColorGrading,
  applyColorGrading,
} from './colorScience';

export interface RenderOptions {
  maxDimension?: number; // scale down for smooth preview
  quality?: number;
}

/**
 * Fast pseudo-random number generator for consistent film grain
 */
function seededRandom(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Evaluates mask opacity at a normalized coordinate (nx, ny) in [0, 1]
 */
function evaluateMask(mask: LocalMask, nx: number, ny: number): number {
  if (!mask.enabled) return 0;
  let weight = 0;

  if (mask.type === 'radial') {
    const cx = mask.centerX ?? 0.5;
    const cy = mask.centerY ?? 0.5;
    const rx = Math.max(0.01, mask.radiusX ?? 0.3);
    const ry = Math.max(0.01, mask.radiusY ?? 0.3);
    const feather = Math.max(0.01, mask.feather ?? 0.5);

    // Normalized distance in ellipse coordinates
    const dx = (nx - cx) / rx;
    const dy = (ny - cy) / ry;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= 1.0) {
      if (dist <= 1.0 - feather) {
        weight = 1.0;
      } else {
        const t = (dist - (1.0 - feather)) / feather;
        weight = Math.cos(t * (Math.PI / 2));
      }
    }
  } else if (mask.type === 'linear') {
    const sx = mask.startX ?? 0.5;
    const sy = mask.startY ?? 1.0;
    const ex = mask.endX ?? 0.5;
    const ey = mask.endY ?? 0.0;

    const lineDx = ex - sx;
    const lineDy = ey - sy;
    const lineLenSq = lineDx * lineDx + lineDy * lineDy;

    if (lineLenSq > 0.0001) {
      // Project point onto line
      const ptDx = nx - sx;
      const ptDy = ny - sy;
      const t = (ptDx * lineDx + ptDy * lineDy) / lineLenSq;
      weight = Math.max(0, Math.min(1, t));
    }
  } else if (mask.type === 'brush' && mask.points && mask.points.length > 0) {
    const br = mask.brushRadius ?? 0.05;
    const brSq = br * br;
    let minDistSq = 999;

    for (const pt of mask.points) {
      const ddx = nx - pt.x;
      const ddy = ny - pt.y;
      const dSq = ddx * ddx + ddy * ddy;
      if (dSq < minDistSq) {
        minDistSq = dSq;
      }
      if (minDistSq <= brSq * 0.25) break;
    }

    if (minDistSq <= brSq) {
      const dist = Math.sqrt(minDistSq);
      const t = dist / br;
      weight = Math.cos(t * (Math.PI / 2));
    }
  } else if (
    (mask.type === 'ai-subject' || mask.type === 'ai-background' || mask.maskBitmap) &&
    mask.maskBitmap &&
    mask.maskBitmap.length > 0
  ) {
    const mw = mask.maskWidth ?? 256;
    const mh = mask.maskHeight ?? 256;
    const px = Math.max(0, Math.min(mw - 1, Math.round(nx * (mw - 1))));
    const py = Math.max(0, Math.min(mh - 1, Math.round(ny * (mh - 1))));
    let val = (mask.maskBitmap[py * mw + px] ?? 0) / 255.0;

    // Apply any interactive brush refinement strokes
    if (mask.refineStrokes && mask.refineStrokes.length > 0) {
      for (const stroke of mask.refineStrokes) {
        const dist = Math.hypot(nx - stroke.x, ny - stroke.y);
        const rad = stroke.radius || 0.06;
        if (dist <= rad) {
          const influence = Math.cos((dist / rad) * (Math.PI / 2));
          if (stroke.mode === 'add') {
            val = Math.min(1.0, val + influence * 0.9);
          } else if (stroke.mode === 'erase') {
            val = Math.max(0.0, val - influence * 0.9);
          }
        }
      }
    }

    weight = val;
  }

  const shouldInvert = mask.inverted || mask.type === 'ai-background';
  if (shouldInvert) {
    weight = 1.0 - weight;
  }

  return Math.max(0, Math.min(1, weight * (mask.opacity ?? 1.0)));
}

let sharedGeomCanvas: HTMLCanvasElement | null = null;
function getSharedGeomCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (!sharedGeomCanvas) {
    sharedGeomCanvas = document.createElement('canvas');
  }
  if (sharedGeomCanvas.width !== width) sharedGeomCanvas.width = width;
  if (sharedGeomCanvas.height !== height) sharedGeomCanvas.height = height;
  const ctx = sharedGeomCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  return { canvas: sharedGeomCanvas, ctx };
}

/**
 * Main non-destructive rendering function
 * Renders sourceImage through the complete adjustment stack onto targetCanvas
 */
export function renderImageAdjustments(
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  adjustments: Adjustments,
  options: RenderOptions = {}
): void {
  const origW = sourceImage instanceof HTMLImageElement ? sourceImage.naturalWidth : sourceImage.width;
  const origH = sourceImage instanceof HTMLImageElement ? sourceImage.naturalHeight : sourceImage.height;

  if (!origW || !origH) return;

  // Geometry: step rotation and crop
  const crop = adjustments.crop;
  const isRotated90 = crop.stepRotation === 90 || crop.stepRotation === 270;
  const uncroppedW = isRotated90 ? origH : origW;
  const uncroppedH = isRotated90 ? origW : origH;

  const cropX = crop.active ? Math.max(0, Math.min(1, crop.x)) : 0;
  const cropY = crop.active ? Math.max(0, Math.min(1, crop.y)) : 0;
  const cropW = crop.active ? Math.max(0.05, Math.min(1 - cropX, crop.width)) : 1;
  const cropH = crop.active ? Math.max(0.05, Math.min(1 - cropY, crop.height)) : 1;

  let renderW = Math.round(uncroppedW * cropW);
  let renderH = Math.round(uncroppedH * cropH);

  // Preview downsampling if requested
  if (options.maxDimension && (renderW > options.maxDimension || renderH > options.maxDimension)) {
    const scale = options.maxDimension / Math.max(renderW, renderH);
    renderW = Math.max(16, Math.round(renderW * scale));
    renderH = Math.max(16, Math.round(renderH * scale));
  }

  targetCanvas.width = renderW;
  targetCanvas.height = renderH;
  const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  // Draw source image into a shared offscreen buffer with orientation & crop
  const geomObj = getSharedGeomCanvas(renderW, renderH);
  if (!geomObj) return;
  const { ctx: gctx } = geomObj;

  gctx.save();
  gctx.clearRect(0, 0, renderW, renderH);
  gctx.translate(renderW / 2, renderH / 2);

  // Fine rotation
  if (crop.rotation !== 0) {
    gctx.rotate((crop.rotation * Math.PI) / 180);
  }

  // Flip
  gctx.scale(crop.flipH ? -1 : 1, crop.flipV ? -1 : 1);

  // Step rotation
  if (crop.stepRotation !== 0) {
    gctx.rotate((crop.stepRotation * Math.PI) / 180);
  }

  // Determine source sampling rectangle
  const sx = cropX * origW;
  const sy = cropY * origH;
  const sw = cropW * origW;
  const sh = cropH * origH;

  const drawW = isRotated90 ? renderH : renderW;
  const drawH = isRotated90 ? renderW : renderH;

  gctx.drawImage(sourceImage, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
  gctx.restore();

  // Extract pixel buffer for color processing
  const imgData = gctx.getImageData(0, 0, renderW, renderH);
  const data = imgData.data;
  const len = data.length;

  // Precompute tone curve LUTs & check activity
  const hasActiveCurves =
    !isCurveDefault(adjustments.toneCurves.rgb) ||
    !isCurveDefault(adjustments.toneCurves.red) ||
    !isCurveDefault(adjustments.toneCurves.green) ||
    !isCurveDefault(adjustments.toneCurves.blue);

  let lutRgb: Uint8Array | null = null;
  let lutRed: Uint8Array | null = null;
  let lutGreen: Uint8Array | null = null;
  let lutBlue: Uint8Array | null = null;

  if (hasActiveCurves) {
    lutRgb = generateCurveLUT(adjustments.toneCurves.rgb);
    lutRed = generateCurveLUT(adjustments.toneCurves.red);
    lutGreen = generateCurveLUT(adjustments.toneCurves.green);
    lutBlue = generateCurveLUT(adjustments.toneCurves.blue);
  }

  // Precompute adjustment factors
  const exposureMult = Math.pow(2, adjustments.exposure);
  const brightnessOffset = adjustments.brightness * 1.28; // -128 to 128
  const contrastFactor = (259 * (adjustments.contrast + 255)) / (255 * (259 - adjustments.contrast));
  const highlightsFactor = adjustments.highlights / 100;
  const shadowsFactor = adjustments.shadows / 100;
  const whitesFactor = adjustments.whites / 100;
  const blacksFactor = adjustments.blacks / 100;

  // Temperature & Tint
  const tempOffset = adjustments.temperature / 100;
  const tintOffset = adjustments.tint / 100;
  const rTempMult = 1 + tempOffset * 0.25;
  const bTempMult = 1 - tempOffset * 0.25;
  const gTintMult = 1 - tintOffset * 0.2;
  const rbTintMult = 1 + tintOffset * 0.1;

  // Saturation & Vibrance
  const globalSat = 1 + adjustments.saturation / 100;
  const vibranceFactor = adjustments.vibrance / 100;

  // Precompute HSL Mixer & Color Grading active structures
  const activeHslChannels = prepareHslMixer(adjustments.hslMixer);
  const isHslActive = activeHslChannels.length > 0;

  const preparedGrading = prepareColorGrading(adjustments.colorGrading);
  const isGradingActive = preparedGrading.isActive;

  // Vignette parameters
  const vignetteAmt = adjustments.vignette / 100;
  const vignetteMid = adjustments.vignetteMidpoint / 100;
  const vignetteFeather = Math.max(0.01, adjustments.vignetteFeather / 100);
  const centerX = renderW / 2;
  const centerY = renderH / 2;
  const maxRadius = Math.hypot(centerX, centerY);

  // Active masks
  const activeMasks = adjustments.masks.filter((m) => m.enabled);
  const hasMasks = activeMasks.length > 0;

  // Process all pixels
  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 1. White balance (temperature / tint)
    r = r * rTempMult * rbTintMult;
    g = g * gTintMult;
    b = b * bTempMult * rbTintMult;

    // 2. Exposure
    r *= exposureMult;
    g *= exposureMult;
    b *= exposureMult;

    // 3. Brightness
    if (brightnessOffset !== 0) {
      r += brightnessOffset;
      g += brightnessOffset;
      b += brightnessOffset;
    }

    // 4. Contrast
    if (adjustments.contrast !== 0) {
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;
    }

    // Normalized [0, 1] for tone mapping & color science
    let nr = Math.max(0, Math.min(255, r)) / 255;
    let ng = Math.max(0, Math.min(255, g)) / 255;
    let nb = Math.max(0, Math.min(255, b)) / 255;

    // Luminance
    const lum = 0.2126 * nr + 0.7152 * ng + 0.0722 * nb;

    // 5. Highlights and Shadows (smooth knee)
    if (highlightsFactor !== 0) {
      const hWeight = Math.max(0, (lum - 0.5) / 0.5);
      const hDelta = highlightsFactor * hWeight * 0.45;
      nr += nr * hDelta;
      ng += ng * hDelta;
      nb += nb * hDelta;
    }
    if (shadowsFactor !== 0) {
      const sWeight = Math.max(0, (0.5 - lum) / 0.5);
      const sDelta = shadowsFactor * sWeight * 0.45;
      nr += (1 - nr) * sDelta;
      ng += (1 - ng) * sDelta;
      nb += (1 - nb) * sDelta;
    }

    // 6. Whites and Blacks
    if (whitesFactor !== 0) {
      const wWeight = Math.pow(lum, 2.2);
      nr += wWeight * whitesFactor * 0.3;
      ng += wWeight * whitesFactor * 0.3;
      nb += wWeight * whitesFactor * 0.3;
    }
    if (blacksFactor !== 0) {
      const bWeight = Math.pow(1 - lum, 2.2);
      nr -= bWeight * blacksFactor * 0.3;
      ng -= bWeight * blacksFactor * 0.3;
      nb -= bWeight * blacksFactor * 0.3;
    }

    nr = Math.max(0, Math.min(1, nr));
    ng = Math.max(0, Math.min(1, ng));
    nb = Math.max(0, Math.min(1, nb));

    // 7. Saturation and Vibrance
    if (globalSat !== 1 || vibranceFactor !== 0) {
      const [h, s, l] = rgbToHsl(nr, ng, nb);
      let newS = s * globalSat;
      if (vibranceFactor !== 0) {
        // Vibrance protects highly saturated pixels
        const vibBoost = (1 - s) * vibranceFactor;
        newS += vibBoost * 0.6;
      }
      [nr, ng, nb] = hslToRgb(h, newS, l);
    }

    // 8. HSL Mixer (only run if HSL Mixer has non-zero adjustments)
    if (isHslActive) {
      const [hVal, sVal, lVal] = rgbToHsl(nr, ng, nb);
      const [mixedH, mixedS, mixedL] = applyHslMixer(hVal, sVal, lVal, activeHslChannels);
      [nr, ng, nb] = hslToRgb(mixedH, mixedS, mixedL);
    }

    // 9. Color Grading / Split Toning (only run if color grading is active)
    if (isGradingActive) {
      [nr, ng, nb] = applyColorGrading(nr, ng, nb, preparedGrading);
    }

    // Convert back to 0..255 for Tone Curves LUT
    let cr = Math.round(Math.max(0, Math.min(1, nr)) * 255);
    let cg = Math.round(Math.max(0, Math.min(1, ng)) * 255);
    let cb = Math.round(Math.max(0, Math.min(1, nb)) * 255);

    // 10. RGB Tone Curves
    if (hasActiveCurves && lutRgb && lutRed && lutGreen && lutBlue) {
      cr = lutRed[lutRgb[cr]];
      cg = lutGreen[lutRgb[cg]];
      cb = lutBlue[lutRgb[cb]];
    }

    // 11. Local Masks
    if (hasMasks) {
      const pixelIdx = i / 4;
      const px = pixelIdx % renderW;
      const py = Math.floor(pixelIdx / renderW);
      const nx = px / renderW;
      const ny = py / renderH;

      for (const mask of activeMasks) {
        const maskWeight = evaluateMask(mask, nx, ny);
        if (maskWeight > 0.005) {
          const adj = mask.adjustments;
          if (adj.exposure !== 0) {
            const mExp = Math.pow(2, adj.exposure * maskWeight);
            cr = Math.min(255, cr * mExp);
            cg = Math.min(255, cg * mExp);
            cb = Math.min(255, cb * mExp);
          }
          if (adj.contrast !== 0) {
            const mC = (259 * (adj.contrast * maskWeight + 255)) / (255 * (259 - adj.contrast * maskWeight));
            cr = Math.max(0, Math.min(255, mC * (cr - 128) + 128));
            cg = Math.max(0, Math.min(255, mC * (cg - 128) + 128));
            cb = Math.max(0, Math.min(255, mC * (cb - 128) + 128));
          }
          if (adj.saturation !== 0 || adj.temperature !== 0) {
            let [mh, ms, ml] = rgbToHsl(cr / 255, cg / 255, cb / 255);
            ms = Math.max(0, Math.min(1, ms * (1 + (adj.saturation / 100) * maskWeight)));
            mh = (mh + adj.temperature * 0.2 * maskWeight + 360) % 360;
            const [lr, lg, lb] = hslToRgb(mh, ms, ml);
            cr = Math.round(lr * 255);
            cg = Math.round(lg * 255);
            cb = Math.round(lb * 255);
          }
        }
      }
    }

    // 12. Vignette
    if (vignetteAmt !== 0) {
      const pixelIdx = i / 4;
      const px = pixelIdx % renderW;
      const py = Math.floor(pixelIdx / renderW);
      const dist = Math.hypot(px - centerX, py - centerY) / maxRadius;
      const startDist = vignetteMid * 0.7;
      if (dist > startDist) {
        const t = Math.min(1, (dist - startDist) / vignetteFeather);
        const vigFactor = 1 - vignetteAmt * (t * t);
        cr = Math.max(0, Math.min(255, cr * vigFactor));
        cg = Math.max(0, Math.min(255, cg * vigFactor));
        cb = Math.max(0, Math.min(255, cb * vigFactor));
      }
    }

    data[i] = cr;
    data[i + 1] = cg;
    data[i + 2] = cb;
  }

  // 13. Film Grain
  if (adjustments.grain > 0) {
    const grainIntensity = adjustments.grain * 0.7;
    for (let i = 0; i < len; i += 4) {
      const px = (i / 4) % renderW;
      const py = Math.floor((i / 4) / renderW);
      const noise = (seededRandom(px, py, 42) - 0.5) * grainIntensity;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
  }

  // 14. In-memory Sharpening filter before canvas writeback
  if (adjustments.sharpening > 0) {
    applyFastSharpenInMemory(imgData.data, renderW, renderH, adjustments.sharpening);
  }

  // Put processed image data back once
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Fast 3x3 unsharp masking pass directly on Uint8ClampedArray pixel buffer
 */
function applyFastSharpenInMemory(dst: Uint8ClampedArray, width: number, height: number, amount: number): void {
  const src = new Uint8ClampedArray(dst);
  const strength = (amount / 100) * 0.75;

  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width * 4;
    const upOffset = (y - 1) * width * 4;
    const downOffset = (y + 1) * width * 4;

    for (let x = 1; x < width - 1; x++) {
      const idx = rowOffset + x * 4;
      const leftIdx = rowOffset + (x - 1) * 4;
      const rightIdx = rowOffset + (x + 1) * 4;
      const upIdx = upOffset + x * 4;
      const downIdx = downOffset + x * 4;

      for (let c = 0; c < 3; c++) {
        const center = src[idx + c];
        const neighbors = (src[leftIdx + c] + src[rightIdx + c] + src[upIdx + c] + src[downIdx + c]) / 4;
        const diff = center - neighbors;
        dst[idx + c] = Math.max(0, Math.min(255, center + diff * strength));
      }
    }
  }
}
