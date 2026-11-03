import { Adjustments, Preset, PresetPack, PresetCategory } from '../types/editor';
import { cloneAdjustments, getDefaultAdjustments } from '../engine/defaultAdjustments';

/**
 * Applies preset adjustments onto current adjustments with a strength factor (0.0 to 2.0, default 1.0).
 * Preserves existing masks, crop, and background removal non-destructively.
 */
export function applyPresetWithStrength(
  base: Adjustments,
  preset: Preset,
  strength = 1.0
): Adjustments {
  const result = cloneAdjustments(base);
  const pAdj = preset.adjustments;
  if (!pAdj) return result;

  // Basic Light
  if (pAdj.exposure !== undefined) result.exposure = pAdj.exposure * strength;
  if (pAdj.brightness !== undefined) result.brightness = pAdj.brightness * strength;
  if (pAdj.contrast !== undefined) result.contrast = pAdj.contrast * strength;
  if (pAdj.highlights !== undefined) result.highlights = pAdj.highlights * strength;
  if (pAdj.shadows !== undefined) result.shadows = pAdj.shadows * strength;
  if (pAdj.whites !== undefined) result.whites = pAdj.whites * strength;
  if (pAdj.blacks !== undefined) result.blacks = pAdj.blacks * strength;

  // Color / White Balance
  if (pAdj.temperature !== undefined) result.temperature = pAdj.temperature * strength;
  if (pAdj.tint !== undefined) result.tint = pAdj.tint * strength;
  if (pAdj.saturation !== undefined) result.saturation = pAdj.saturation * strength;
  if (pAdj.vibrance !== undefined) result.vibrance = pAdj.vibrance * strength;

  // Effects
  if (pAdj.texture !== undefined) result.texture = pAdj.texture * strength;
  if (pAdj.clarity !== undefined) result.clarity = pAdj.clarity * strength;
  if (pAdj.dehaze !== undefined) result.dehaze = pAdj.dehaze * strength;
  if (pAdj.vignette !== undefined) result.vignette = Math.round(pAdj.vignette * strength);
  if (pAdj.vignetteMidpoint !== undefined) result.vignetteMidpoint = pAdj.vignetteMidpoint;
  if (pAdj.vignetteFeather !== undefined) result.vignetteFeather = pAdj.vignetteFeather;
  if (pAdj.grain !== undefined) result.grain = Math.round(pAdj.grain * strength);
  if (pAdj.grainSize !== undefined) result.grainSize = pAdj.grainSize;
  if (pAdj.grainRoughness !== undefined) result.grainRoughness = pAdj.grainRoughness;

  // Details
  if (pAdj.sharpening !== undefined) {
    result.sharpening = Math.round(pAdj.sharpening * strength);
    result.details.sharpenAmount = result.sharpening;
  }
  if (pAdj.noiseReduction !== undefined) {
    result.noiseReduction = Math.round(pAdj.noiseReduction * strength);
    result.details.noiseLuminance = result.noiseReduction;
  }
  if (pAdj.details) {
    result.details = {
      ...result.details,
      ...pAdj.details,
      sharpenAmount: Math.round((pAdj.details.sharpenAmount ?? result.details.sharpenAmount) * strength),
      noiseLuminance: Math.round((pAdj.details.noiseLuminance ?? result.details.noiseLuminance) * strength),
      noiseColor: Math.round((pAdj.details.noiseColor ?? result.details.noiseColor) * strength),
    };
    result.sharpening = result.details.sharpenAmount;
    result.noiseReduction = result.details.noiseLuminance;
  }

  // Optics
  if (pAdj.optics) {
    result.optics = {
      ...result.optics,
      ...pAdj.optics,
      distortion: Math.round((pAdj.optics.distortion ?? 0) * strength),
      vignetteCorrection: Math.round((pAdj.optics.vignetteCorrection ?? 0) * strength),
    };
  }

  // Tone Curves
  if (pAdj.toneCurves) {
    result.toneCurves = JSON.parse(JSON.stringify(pAdj.toneCurves));
  }

  // HSL Mixer
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

  // Color Grading
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
      balance: Math.round((pAdj.colorGrading.balance ?? 0) * strength),
      global: pAdj.colorGrading.global
        ? {
            hue: pAdj.colorGrading.global.hue,
            saturation: Math.round(pAdj.colorGrading.global.saturation * strength),
            luminance: Math.round(pAdj.colorGrading.global.luminance * strength),
          }
        : undefined,
      blending: pAdj.colorGrading.blending,
      strength: pAdj.colorGrading.strength,
    };
  }

  // Note: masks, crop, and backgroundRemoval remain untouched from base
  return result;
}

/**
 * Serializes a single preset to a downloadable JSON file
 */
export function exportPresetToFile(preset: Preset): void {
  const exportPayload = {
    format: 'lumaforge-preset',
    version: 1,
    id: preset.id,
    name: preset.name,
    category: preset.category,
    description: preset.description,
    isFavorite: preset.isFavorite,
    adjustments: preset.adjustments,
    exportedAt: Date.now(),
  };

  const data = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${preset.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.lumaforge.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Serializes multiple presets into a single downloadable Preset Pack
 */
export function exportPresetPackToFile(presets: Preset[], packName = 'LumaForge-Presets'): void {
  const exportPayload: PresetPack = {
    format: 'lumaforge-preset-pack',
    version: 1,
    name: packName,
    description: `Exported preset collection containing ${presets.length} presets`,
    exportedAt: Date.now(),
    presets: presets.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      isFavorite: p.isFavorite,
      adjustments: p.adjustments,
      version: 1,
    })),
  };

  const data = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${packName.toLowerCase().replace(/[^a-z0-9]/g, '-')}.lumaforge-pack.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Duplicates a preset (built-in or custom) to create an editable custom preset
 */
export function duplicatePreset(source: Preset, newName?: string): Preset {
  const name = newName || `${source.name} (Copy)`;
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    category: source.category,
    description: source.description ? `${source.description} (Duplicate)` : 'Custom preset',
    adjustments: JSON.parse(JSON.stringify(source.adjustments || {})),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isFavorite: false,
    isCustom: true,
    version: 1,
  };
}

/**
 * Validates and safely parses an imported preset JSON string.
 * Supports both individual preset files and preset pack collections.
 * Protects against executable code and prototype pollution.
 */
export function parsePresetFile(jsonText: string): Preset | Preset[] {
  if (!jsonText || typeof jsonText !== 'string') {
    throw new Error('Import failed: empty or invalid file contents');
  }

  // Safety check for code injection
  if (jsonText.includes('__proto__') || jsonText.includes('constructor') || jsonText.includes('<script')) {
    throw new Error('Import rejected: preset file contains unsafe properties or executable tokens');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err: any) {
    throw new Error(`Import failed: malformed JSON (${err.message})`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Import failed: preset payload must be a JSON object');
  }

  // Case 1: Preset Pack
  if (parsed.format === 'lumaforge-preset-pack' && Array.isArray(parsed.presets)) {
    if (parsed.presets.length === 0) {
      throw new Error('Import failed: preset pack is empty');
    }
    return parsed.presets.map((item: any, idx: number) => {
      if (!item.name || typeof item.name !== 'string') {
        throw new Error(`Import failed: preset #${idx + 1} in pack is missing a name`);
      }
      return {
        id: `custom-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        name: String(item.name).trim(),
        category: (item.category as PresetCategory) || 'Custom',
        description: typeof item.description === 'string' ? item.description : 'Imported preset',
        adjustments: item.adjustments && typeof item.adjustments === 'object' ? item.adjustments : {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isFavorite: Boolean(item.isFavorite),
        isCustom: true,
        version: 1,
      };
    });
  }

  // Case 2: Single Preset
  if (!parsed.name || typeof parsed.name !== 'string') {
    throw new Error('Import failed: preset is missing a required name');
  }

  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: String(parsed.name).trim(),
    category: (parsed.category as PresetCategory) || 'Custom',
    description: typeof parsed.description === 'string' ? parsed.description : 'Imported preset',
    adjustments: parsed.adjustments && typeof parsed.adjustments === 'object' ? parsed.adjustments : {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isFavorite: Boolean(parsed.isFavorite),
    isCustom: true,
    version: 1,
  };
}
