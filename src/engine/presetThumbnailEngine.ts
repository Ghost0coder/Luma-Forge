import { Adjustments, Preset } from '../types/editor';
import { applyPresetWithStrength } from '../presets/presetUtils';
import { getDefaultAdjustments } from './defaultAdjustments';
import { processPixelData } from './pipeline';

// In-memory cache for rendered preset thumbnail data URLs
const thumbnailCache = new Map<string, string>();
const MAX_CACHE_ENTRIES = 128;

// Reusable offscreen canvas for rendering thumbnails
let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;

function getThumbnailCanvas(size = 80): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = size;
    offscreenCanvas.height = size;
    offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (!offscreenCtx) return null;
  return { canvas: offscreenCanvas, ctx: offscreenCtx };
}

/**
 * Generates an image-processed thumbnail data URL for a preset using the provided source image
 * (or standard high-dynamic-range colorful swatch).
 */
export function generatePresetThumbnail(
  preset: Preset,
  sourceImg?: HTMLImageElement | null,
  size = 80
): string | null {
  if (typeof document === 'undefined') return null;

  const sourceKey = sourceImg ? (sourceImg.src || 'custom-image') : 'default-swatch';
  const cacheKey = `${sourceKey}__${preset.id}__${size}`;

  const cached = thumbnailCache.get(cacheKey);
  if (cached) return cached;

  const kit = getThumbnailCanvas(size);
  if (!kit) return null;
  const { canvas, ctx } = kit;

  ctx.clearRect(0, 0, size, size);

  if (sourceImg && sourceImg.complete && sourceImg.naturalWidth > 0) {
    // Draw center-cropped portion of current image
    const sw = sourceImg.naturalWidth;
    const sh = sourceImg.naturalHeight;
    const minDim = Math.min(sw, sh);
    const sx = (sw - minDim) / 2;
    const sy = (sh - minDim) / 2;
    ctx.drawImage(sourceImg, sx, sy, minDim, minDim, 0, 0, size, size);
  } else {
    // Standard photographic gradient swatch covering skin tones, skies, foliage, and high-contrast edges
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#e89b72'); // Warm skin tone
    grad.addColorStop(0.35, '#c46d47'); // Shadow tone
    grad.addColorStop(0.7, '#3d7280'); // Deep teal foliage
    grad.addColorStop(1, '#8fc4d1'); // Cyan sky
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Add subtle horizon & highlight circle to showcase contrast & highlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(size * 0.7, size * 0.3, size * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // Extract pixel data and run pure image processing pipeline
  try {
    const imgData = ctx.getImageData(0, 0, size, size);
    const baseAdj = getDefaultAdjustments();
    const targetAdj = applyPresetWithStrength(baseAdj, preset, 1.0);

    processPixelData(imgData.data, size, size, targetAdj);
    ctx.putImageData(imgData, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    if (thumbnailCache.size >= MAX_CACHE_ENTRIES) {
      thumbnailCache.clear();
    }
    thumbnailCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch (err) {
    console.warn(`Failed to render thumbnail for preset ${preset.id}:`, err);
    return null;
  }
}

/**
 * Clear cached thumbnails when the user loads a new photo
 */
export function clearPresetThumbnailCache(): void {
  thumbnailCache.clear();
}
