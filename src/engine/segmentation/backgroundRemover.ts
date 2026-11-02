/**
 * Background Removal and Compositing Engine for LumaForge
 * Features:
 * - MediaPipe SelfieSegmentation with automatic graceful fallback to Local Saliency Heuristic
 * - Mask edge shift (-10px to +10px) and edge feathering (0px to 20px)
 * - Modes: Transparent (true PNG alpha), Solid Color, Custom Image Backdrop, Bokeh Blur
 * - Transparent PNG export
 */

import { runLocalSaliencySegmentation } from './aiSegmentation';

export interface BackgroundRemovalOptions {
  mode: 'transparent' | 'color' | 'image' | 'blur';
  color?: string;
  blurRadius?: number;
  customBgImage?: HTMLImageElement | null;
  feather?: number; // 0 - 20
  edgeShift?: number; // -10 - 10
}

export interface BackgroundSegmentResult {
  mask: number[]; // 0 to 255 (255 = subject, 0 = background)
  width: number;
  height: number;
  modelType: 'mediapipe-selfie' | 'local-saliency';
  latencyMs: number;
}

/**
 * Attempts MediaPipe SelfieSegmentation first; gracefully falls back to deterministic local saliency
 */
export async function extractSubjectMask(
  sourceCanvas: HTMLCanvasElement | HTMLImageElement,
  targetW = 384,
  targetH = 384
): Promise<BackgroundSegmentResult> {
  const start = performance.now();

  // Try MediaPipe SelfieSegmentation if window / browser environment supports it
  if (typeof window !== 'undefined') {
    try {
      // Dynamic import to avoid SSR issues
      const mp = await import('@mediapipe/selfie_segmentation');
      const SelfieSegmentation = mp.SelfieSegmentation || (mp as any).default?.SelfieSegmentation;

      if (SelfieSegmentation) {
        const selfie = new SelfieSegmentation({
          locateFile: (file: string) => `/mediapipe/selfie_segmentation/${file}`,
        });

        selfie.setOptions({
          modelSelection: 1, // 1 = landscape/general, 0 = general portrait
        });

        const maskPromise = new Promise<number[]>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('MediaPipe model load timeout')), 12000);

          selfie.onResults((results: any) => {
            clearTimeout(timeout);
            try {
              const segCanvas = document.createElement('canvas');
              segCanvas.width = targetW;
              segCanvas.height = targetH;
              const sCtx = segCanvas.getContext('2d', { willReadFrequently: true });
              if (!sCtx) {
                reject(new Error('Canvas context unavailable'));
                return;
              }

              sCtx.drawImage(results.segmentationMask, 0, 0, targetW, targetH);
              const imgData = sCtx.getImageData(0, 0, targetW, targetH);
              const d = imgData.data;
              const mask = new Array(targetW * targetH);

              for (let i = 0; i < mask.length; i++) {
                // MediaPipe output has confidence in R or A channel
                mask[i] = d[i * 4];
              }

              resolve(mask);
            } catch (err) {
              reject(err);
            }
          });
        });

        await selfie.send({ image: sourceCanvas as any });
        const mask = await maskPromise;
        const latency = Math.round(performance.now() - start);

        return {
          mask,
          width: targetW,
          height: targetH,
          modelType: 'mediapipe-selfie',
          latencyMs: latency,
        };
      }
    } catch {
      // Graceful fallback to deterministic local saliency engine
    }
  }

  // Local deterministic fallback
  const mask = runLocalSaliencySegmentation(sourceCanvas, targetW, targetH);
  const latency = Math.round(performance.now() - start);

  return {
    mask,
    width: targetW,
    height: targetH,
    modelType: 'local-saliency',
    latencyMs: latency,
  };
}

/**
 * Applies edge shift (dilation/erosion) and feathering to the mask
 */
export function refineBackgroundMask(
  rawMask: number[],
  width: number,
  height: number,
  edgeShift = 0, // -10 to +10
  feather = 4 // 0 to 20
): number[] {
  let mask = [...rawMask];

  // 1. Edge shift
  if (edgeShift !== 0) {
    const shift = Math.abs(Math.round(edgeShift));
    const isExpand = edgeShift > 0;
    const rSq = shift * shift;
    const shifted = new Array(width * height).fill(isExpand ? 0 : 255);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const val = rawMask[y * width + x];
        if (isExpand && val > 128) {
          const minY = Math.max(0, y - shift);
          const maxY = Math.min(height - 1, y + shift);
          const minX = Math.max(0, x - shift);
          const maxX = Math.min(width - 1, x + shift);
          for (let ny = minY; ny <= maxY; ny++) {
            for (let nx = minX; nx <= maxX; nx++) {
              if ((nx - x) * (nx - x) + (ny - y) * (ny - y) <= rSq) {
                shifted[ny * width + nx] = 255;
              }
            }
          }
        } else if (!isExpand && val < 128) {
          const minY = Math.max(0, y - shift);
          const maxY = Math.min(height - 1, y + shift);
          const minX = Math.max(0, x - shift);
          const maxX = Math.min(width - 1, x + shift);
          for (let ny = minY; ny <= maxY; ny++) {
            for (let nx = minX; nx <= maxX; nx++) {
              if ((nx - x) * (nx - x) + (ny - y) * (ny - y) <= rSq) {
                shifted[ny * width + nx] = 0;
              }
            }
          }
        }
      }
    }
    mask = shifted;
  }

  // 2. Feathering via separable 2-pass box/Gaussian filter
  if (feather > 0) {
    const r = Math.max(1, Math.round(feather));
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

    const feathered = new Array(width * height);
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
        feathered[y * width + x] = Math.round(sum / count);
      }
    }
    mask = feathered;
  }

  return mask;
}

/**
 * Renders the composited background removal result onto target canvas
 */
export function renderCompositedBackground(
  targetCtx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement | HTMLImageElement,
  mask: number[], // 0 to 255
  maskW: number,
  maskH: number,
  outputW: number,
  outputH: number,
  options: BackgroundRemovalOptions
): void {
  // Clear target
  targetCtx.clearRect(0, 0, outputW, outputH);

  // 1. Draw Background Layer according to mode
  if (options.mode === 'transparent') {
    // Left transparent: no backdrop drawn
  } else if (options.mode === 'color') {
    targetCtx.fillStyle = options.color || '#ffffff';
    targetCtx.fillRect(0, 0, outputW, outputH);
  } else if (options.mode === 'image' && options.customBgImage) {
    // Draw background image with aspect-cover
    const img = options.customBgImage;
    const imgRatio = img.width / img.height;
    const targetRatio = outputW / outputH;
    let dw = outputW;
    let dh = outputH;
    let dx = 0;
    let dy = 0;

    if (imgRatio > targetRatio) {
      dw = outputH * imgRatio;
      dx = (outputW - dw) / 2;
    } else {
      dh = outputW / imgRatio;
      dy = (outputH - dh) / 2;
    }
    targetCtx.drawImage(img, dx, dy, dw, dh);
  } else if (options.mode === 'blur') {
    // Draw blurred version of original image
    targetCtx.save();
    targetCtx.filter = `blur(${Math.max(1, options.blurRadius || 12)}px)`;
    targetCtx.drawImage(sourceCanvas, 0, 0, outputW, outputH);
    targetCtx.restore();
  }

  // 2. Prepare Subject Canvas with Alpha Mask
  const subjectCanvas = document.createElement('canvas');
  subjectCanvas.width = outputW;
  subjectCanvas.height = outputH;
  const sCtx = subjectCanvas.getContext('2d', { willReadFrequently: true });
  if (!sCtx) return;

  // Draw original image
  sCtx.drawImage(sourceCanvas, 0, 0, outputW, outputH);

  // Apply alpha mask
  const imgData = sCtx.getImageData(0, 0, outputW, outputH);
  const d = imgData.data;

  // Bilinear interpolation for sampling mask at output resolution
  const scaleX = maskW / outputW;
  const scaleY = maskH / outputH;

  for (let y = 0; y < outputH; y++) {
    const my = Math.min(maskH - 1, Math.floor(y * scaleY));
    for (let x = 0; x < outputW; x++) {
      const mx = Math.min(maskW - 1, Math.floor(x * scaleX));
      const maskVal = mask[my * maskW + mx] || 0;
      const alpha = maskVal / 255;
      const pIdx = (y * outputW + x) * 4;

      // Multiply existing alpha with mask alpha
      d[pIdx + 3] = Math.round(d[pIdx + 3] * alpha);
    }
  }

  sCtx.putImageData(imgData, 0, 0);

  // 3. Composite subject over background
  targetCtx.drawImage(subjectCanvas, 0, 0);
}

/**
 * Exports full resolution transparent PNG
 */
export function exportTransparentPNG(
  sourceCanvas: HTMLCanvasElement | HTMLImageElement,
  mask: number[],
  maskW: number,
  maskH: number,
  filename = 'lumaforge-isolated-subject.png'
): string {
  const width =
    sourceCanvas instanceof HTMLImageElement
      ? sourceCanvas.naturalWidth || sourceCanvas.width
      : sourceCanvas.width;
  const height =
    sourceCanvas instanceof HTMLImageElement
      ? sourceCanvas.naturalHeight || sourceCanvas.height
      : sourceCanvas.height;

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const ctx = exportCanvas.getContext('2d');
  if (!ctx) return '';

  renderCompositedBackground(ctx, sourceCanvas, mask, maskW, maskH, width, height, {
    mode: 'transparent',
  });

  const dataUrl = exportCanvas.toDataURL('image/png');

  // Trigger download if in browser
  if (typeof document !== 'undefined') {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return dataUrl;
}
