import { CropGeometry } from '../types/editor';

export interface AspectRatioOption {
  key: string;
  label: string;
  ratio: number | null; // width / height, or null for 'original' / 'free'
  category: 'square' | 'landscape' | 'portrait' | 'free' | 'original';
}

export const CROP_ASPECT_RATIOS: AspectRatioOption[] = [
  { key: 'original', label: 'Original', ratio: null, category: 'original' },
  { key: 'free', label: 'Free', ratio: null, category: 'free' },
  { key: '1:1', label: '1:1 Square', ratio: 1.0, category: 'square' },
  { key: '2:1', label: '2:1 Landscape', ratio: 2.0, category: 'landscape' },
  { key: '3:2', label: '3:2 Landscape', ratio: 3 / 2, category: 'landscape' },
  { key: '4:3', label: '4:3 Landscape', ratio: 4 / 3, category: 'landscape' },
  { key: '4:5', label: '4:5 Portrait', ratio: 4 / 5, category: 'portrait' },
  { key: '5:4', label: '5:4 Landscape', ratio: 5 / 4, category: 'landscape' },
  { key: '9:16', label: '9:16 Portrait', ratio: 9 / 16, category: 'portrait' },
  { key: '16:9', label: '16:9 Widescreen', ratio: 16 / 9, category: 'landscape' },
];

/**
 * Calculates the largest valid, centered crop rectangle for a given aspect ratio
 * within the uncropped source image boundaries.
 */
export function calculateAspectCrop(
  origW: number,
  origH: number,
  ratioKey: string,
  stepRotation = 0
): { x: number; y: number; width: number; height: number; active: boolean; aspectRatio: string } {
  const isRotated90 = stepRotation === 90 || stepRotation === 270;
  const uncroppedW = isRotated90 ? origH : origW;
  const uncroppedH = isRotated90 ? origW : origH;

  if (!uncroppedW || !uncroppedH) {
    return { x: 0, y: 0, width: 1, height: 1, active: false, aspectRatio: ratioKey };
  }

  const imageAspect = uncroppedW / uncroppedH;

  if (ratioKey === 'original') {
    return {
      active: true,
      aspectRatio: 'original',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    };
  }

  if (ratioKey === 'free') {
    return {
      active: true,
      aspectRatio: 'free',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    };
  }

  // Find target numeric ratio
  const option = CROP_ASPECT_RATIOS.find((r) => r.key === ratioKey);
  const r = option?.ratio || 1.0;

  let pixelW: number;
  let pixelH: number;

  if (r > imageAspect) {
    // Target ratio is wider than image: width spans full image width
    pixelW = uncroppedW;
    pixelH = Math.max(1, Math.round(uncroppedW / r));
    if (pixelH > uncroppedH) {
      pixelH = uncroppedH;
      pixelW = Math.max(1, Math.round(uncroppedH * r));
    }
  } else {
    // Target ratio is taller than or equal to image: height spans full image height
    pixelH = uncroppedH;
    pixelW = Math.max(1, Math.round(uncroppedH * r));
    if (pixelW > uncroppedW) {
      pixelW = uncroppedW;
      pixelH = Math.max(1, Math.round(uncroppedW / r));
    }
  }

  const normW = Math.min(1, pixelW / uncroppedW);
  const normH = Math.min(1, pixelH / uncroppedH);
  const normX = Math.max(0, Math.min(1 - normW, (1 - normW) / 2));
  const normY = Math.max(0, Math.min(1 - normH, (1 - normH) / 2));

  return {
    active: true,
    aspectRatio: ratioKey,
    x: normX,
    y: normY,
    width: normW,
    height: normH,
  };
}

/**
 * Calculates final export dimensions accounting for rotation, crop, and scale.
 */
export function getExportDimensions(
  origW: number,
  origH: number,
  crop: CropGeometry,
  scale = 1.0
): { width: number; height: number; aspect: number } {
  const isRotated90 = crop.stepRotation === 90 || crop.stepRotation === 270;
  const uncroppedW = isRotated90 ? origH : origW;
  const uncroppedH = isRotated90 ? origW : origH;

  const cropW = crop.active ? Math.max(0.01, Math.min(1, crop.width)) : 1;
  const cropH = crop.active ? Math.max(0.01, Math.min(1, crop.height)) : 1;

  const finalW = Math.max(1, Math.round(uncroppedW * cropW * scale));
  const finalH = Math.max(1, Math.round(uncroppedH * cropH * scale));

  return {
    width: finalW,
    height: finalH,
    aspect: finalW / finalH,
  };
}
