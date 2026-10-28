import { Adjustments, Preset } from '../types/editor';
import { cloneAdjustments, getDefaultAdjustments } from '../engine/defaultAdjustments';

/**
 * Applies preset adjustments onto current adjustments with a strength factor (0.0 to 2.0, default 1.0)
 */
export function applyPresetWithStrength(
  base: Adjustments,
  preset: Preset,
  strength = 1.0
): Adjustments {
  const result = cloneAdjustments(base);
  const pAdj = preset.adjustments;

  if (pAdj.exposure !== undefined) result.exposure = pAdj.exposure * strength;
  if (pAdj.brightness !== undefined) result.brightness = pAdj.brightness * strength;
  if (pAdj.contrast !== undefined) result.contrast = pAdj.contrast * strength;
  if (pAdj.highlights !== undefined) result.highlights = pAdj.highlights * strength;
  if (pAdj.shadows !== undefined) result.shadows = pAdj.shadows * strength;
  if (pAdj.whites !== undefined) result.whites = pAdj.whites * strength;
  if (pAdj.blacks !== undefined) result.blacks = pAdj.blacks * strength;
  if (pAdj.temperature !== undefined) result.temperature = pAdj.temperature * strength;
  if (pAdj.tint !== undefined) result.tint = pAdj.tint * strength;

  if (pAdj.saturation !== undefined) result.saturation = pAdj.saturation * strength;
  if (pAdj.vibrance !== undefined) result.vibrance = pAdj.vibrance * strength;
  if (pAdj.clarity !== undefined) result.clarity = pAdj.clarity * strength;
  if (pAdj.dehaze !== undefined) result.dehaze = pAdj.dehaze * strength;
  if (pAdj.sharpening !== undefined) result.sharpening = Math.round(pAdj.sharpening * strength);
  if (pAdj.vignette !== undefined) result.vignette = Math.round(pAdj.vignette * strength);
  if (pAdj.vignetteMidpoint !== undefined) result.vignetteMidpoint = pAdj.vignetteMidpoint;
  if (pAdj.vignetteFeather !== undefined) result.vignetteFeather = pAdj.vignetteFeather;
  if (pAdj.grain !== undefined) result.grain = Math.round(pAdj.grain * strength);
  if (pAdj.grainSize !== undefined) result.grainSize = pAdj.grainSize;

  if (pAdj.toneCurves) {
    result.toneCurves = JSON.parse(JSON.stringify(pAdj.toneCurves));
  }

  if (pAdj.hslMixer) {
    const defaultAdj = getDefaultAdjustments();
    const mixer = JSON.parse(JSON.stringify(defaultAdj.hslMixer));
    const keys = Object.keys(pAdj.hslMixer) as (keyof typeof mixer)[];
    for (const key of keys) {
      const ch = pAdj.hslMixer[key as keyof typeof pAdj.hslMixer];
      if (ch) {
        mixer[key] = {
          hue: Math.round(ch.hue * strength),
          saturation: Math.round(ch.saturation * strength),
          luminance: Math.round(ch.luminance * strength),
        };
      }
    }
    result.hslMixer = mixer;
  }

  if (pAdj.colorGrading) {
    result.colorGrading = {
      shadows: {
        hue: pAdj.colorGrading.shadows.hue,
        saturation: Math.round(pAdj.colorGrading.shadows.saturation * strength),
        luminance: Math.round(pAdj.colorGrading.shadows.luminance * strength),
      },
      midtones: {
        hue: pAdj.colorGrading.midtones.hue,
        saturation: Math.round(pAdj.colorGrading.midtones.saturation * strength),
        luminance: Math.round(pAdj.colorGrading.midtones.luminance * strength),
      },
      highlights: {
        hue: pAdj.colorGrading.highlights.hue,
        saturation: Math.round(pAdj.colorGrading.highlights.saturation * strength),
        luminance: Math.round(pAdj.colorGrading.highlights.luminance * strength),
      },
      balance: Math.round(pAdj.colorGrading.balance * strength),
    };
  }

  return result;
}

/**
 * Serializes a preset to a downloadable JSON file
 */
export function exportPresetToFile(preset: Preset): void {
  const data = JSON.stringify(preset, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${preset.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.lumaforge.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Validates and parses an imported preset JSON string
 */
export function parsePresetFile(jsonText: string): Preset {
  const parsed = JSON.parse(jsonText);
  if (!parsed.name || typeof parsed.name !== 'string') {
    throw new Error('Invalid preset file: missing name');
  }
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: parsed.name,
    category: 'Custom',
    description: parsed.description || 'Custom user preset',
    adjustments: parsed.adjustments || {},
    createdAt: Date.now(),
    isCustom: true,
  };
}
