import { Adjustments, HSLMixer, ToneCurves, ColorGrading, CropGeometry } from '../types/editor';

export const DEFAULT_TONE_CURVES: ToneCurves = {
  rgb: [
    { x: 0, y: 0 },
    { x: 64, y: 64 },
    { x: 128, y: 128 },
    { x: 192, y: 192 },
    { x: 255, y: 255 },
  ],
  red: [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ],
  green: [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ],
  blue: [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ],
};

export const DEFAULT_HSL_MIXER: HSLMixer = {
  red: { hue: 0, saturation: 0, luminance: 0 },
  orange: { hue: 0, saturation: 0, luminance: 0 },
  yellow: { hue: 0, saturation: 0, luminance: 0 },
  green: { hue: 0, saturation: 0, luminance: 0 },
  aqua: { hue: 0, saturation: 0, luminance: 0 },
  blue: { hue: 0, saturation: 0, luminance: 0 },
  purple: { hue: 0, saturation: 0, luminance: 0 },
  magenta: { hue: 0, saturation: 0, luminance: 0 },
};

export const DEFAULT_COLOR_GRADING: ColorGrading = {
  shadows: { hue: 0, saturation: 0, luminance: 0 },
  midtones: { hue: 0, saturation: 0, luminance: 0 },
  highlights: { hue: 0, saturation: 0, luminance: 0 },
  balance: 0,
};

export const DEFAULT_CROP: CropGeometry = {
  active: false,
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  aspectRatio: 'original',
  rotation: 0,
  stepRotation: 0,
  flipH: false,
  flipV: false,
};

export function getDefaultAdjustments(): Adjustments {
  return {
    exposure: 0,
    brightness: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    temperature: 0,
    tint: 0,
    saturation: 0,
    vibrance: 0,
    toneCurves: JSON.parse(JSON.stringify(DEFAULT_TONE_CURVES)),
    hslMixer: JSON.parse(JSON.stringify(DEFAULT_HSL_MIXER)),
    colorGrading: JSON.parse(JSON.stringify(DEFAULT_COLOR_GRADING)),
    sharpening: 0,
    noiseReduction: 0,
    clarity: 0,
    dehaze: 0,
    vignette: 0,
    vignetteMidpoint: 50,
    vignetteFeather: 50,
    grain: 0,
    grainSize: 25,
    crop: { ...DEFAULT_CROP },
    masks: [],
  };
}

export function cloneAdjustments(adj: Adjustments): Adjustments {
  return JSON.parse(JSON.stringify(adj));
}
