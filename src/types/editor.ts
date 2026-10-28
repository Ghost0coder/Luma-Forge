/**
 * Core type definitions for LumaForge non-destructive photo editor
 */

export interface CurvePoint {
  x: number; // 0 to 255
  y: number; // 0 to 255
}

export interface ToneCurves {
  rgb: CurvePoint[];
  red: CurvePoint[];
  green: CurvePoint[];
  blue: CurvePoint[];
}

export type HSLColorName =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'aqua'
  | 'blue'
  | 'purple'
  | 'magenta';

export interface HSLChannel {
  hue: number;        // -100 to +100
  saturation: number; // -100 to +100
  luminance: number;  // -100 to +100
}

export type HSLMixer = Record<HSLColorName, HSLChannel>;

export interface ColorGradingWheel {
  hue: number;        // 0 to 360
  saturation: number; // 0 to 100
  luminance: number;  // -100 to +100
}

export interface ColorGrading {
  shadows: ColorGradingWheel;
  midtones: ColorGradingWheel;
  highlights: ColorGradingWheel;
  balance: number; // -100 to +100
}

export type MaskType = 'radial' | 'linear' | 'brush' | 'ai-subject' | 'ai-background';

export interface LocalMaskAdjustments {
  exposure: number;   // -3.0 to +3.0
  contrast: number;   // -100 to +100
  saturation: number; // -100 to +100
  temperature: number;// -100 to +100
  sharpness: number;  // -100 to +100
}

export interface BrushPoint {
  x: number; // normalized 0 to 1
  y: number; // normalized 0 to 1
  pressure?: number;
}

export interface MaskRefinementStroke {
  x: number; // normalized 0 to 1
  y: number; // normalized 0 to 1
  mode: 'add' | 'erase';
  radius: number; // normalized 0 to 1
}

export interface LocalMask {
  id: string;
  name: string;
  type: MaskType;
  enabled: boolean;
  inverted: boolean;
  opacity: number; // 0 to 1
  // Geometry parameters (normalized 0 to 1)
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  centerX?: number;
  centerY?: number;
  radiusX?: number;
  radiusY?: number;
  feather?: number; // 0 to 1
  rotation?: number; // radians
  points?: BrushPoint[]; // for brush strokes
  brushRadius?: number; // normalized
  // AI Bitmap Mask parameters
  maskBitmap?: number[]; // 0..255 normalized alpha grid
  maskWidth?: number;
  maskHeight?: number;
  showOverlay?: boolean; // Show Lightroom Ruby Red preview overlay
  refineMode?: 'add' | 'erase' | 'none';
  refineRadius?: number;
  refineFeather?: number;
  refineStrokes?: MaskRefinementStroke[];
  adjustments: LocalMaskAdjustments;
}

export interface CropGeometry {
  active: boolean;
  x: number;      // 0 to 1
  y: number;      // 0 to 1
  width: number;  // 0 to 1
  height: number; // 0 to 1
  aspectRatio: string; // 'original' | '1:1' | '4:3' | '16:9' | '3:2' | 'free'
  rotation: number; // -45 to 45 fine rotation degrees
  stepRotation: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
}

export interface Adjustments {
  // Light
  exposure: number;     // -5.0 to +5.0 EV
  brightness: number;   // -100 to +100
  contrast: number;     // -100 to +100
  highlights: number;   // -100 to +100
  shadows: number;      // -100 to +100
  whites: number;       // -100 to +100
  blacks: number;       // -100 to +100
  temperature: number;  // -100 to +100 (Cool to Warm)
  tint: number;         // -100 to +100 (Green to Magenta)

  // Color
  saturation: number;   // -100 to +100
  vibrance: number;     // -100 to +100
  toneCurves: ToneCurves;
  hslMixer: HSLMixer;
  colorGrading: ColorGrading;

  // Detail & Effects
  sharpening: number;   // 0 to 100
  noiseReduction: number; // 0 to 100
  clarity: number;      // -100 to +100
  dehaze: number;       // -100 to +100
  vignette: number;     // -100 to +100
  vignetteMidpoint: number; // 0 to 100
  vignetteFeather: number;  // 0 to 100
  grain: number;        // 0 to 100
  grainSize: number;    // 0 to 100

  // Geometry
  crop: CropGeometry;

  // Local masks
  masks: LocalMask[];
}

export interface Preset {
  id: string;
  name: string;
  category: 'Cinematic' | 'Portrait' | 'Landscape' | 'Monochrome' | 'Vintage' | 'Custom';
  description: string;
  adjustments: Partial<Adjustments>;
  createdAt?: number;
  isCustom?: boolean;
}

export interface HistoryEntry {
  id: string;
  action: string;
  timestamp: number;
  adjustments: Adjustments;
}

export interface PhotoProject {
  id: string;
  name: string;
  imageDataUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
  adjustments: Adjustments;
  history: HistoryEntry[];
  historyIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface HistogramData {
  red: number[];
  green: number[];
  blue: number[];
  luminance: number[];
  maxCount: number;
  highlightClipping: number; // percentage 0-100
  shadowClipping: number;    // percentage 0-100
}

export interface AIAnalysisResult {
  sceneSummary: string;
  lightingDiagnosis: string;
  colorHarmony: string;
  suggestedAdjustments: Partial<Adjustments>;
  confidence: number;
}
