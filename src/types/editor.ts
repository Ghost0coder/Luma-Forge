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
  global?: ColorGradingWheel;
  blending?: number; // 0 to 100 (default 50)
  balance?: number;  // -100 to +100 (default 0)
  strength?: number; // 0 to 100 (default 100)
}

export interface DetailAdjustments {
  // Sharpening
  sharpenAmount: number;   // 0 to 150
  sharpenRadius: number;   // 0.5 to 3.0
  sharpenDetail: number;   // 0 to 100
  sharpenMasking: number;  // 0 to 100

  // Noise Reduction
  noiseLuminance: number;        // 0 to 100
  noiseLuminanceDetail: number;  // 0 to 100
  noiseLuminanceContrast: number;// 0 to 100
  noiseColor: number;            // 0 to 100
  noiseColorDetail: number;      // 0 to 100
  noiseSmoothness: number;       // 0 to 100
}

export interface OpticsAdjustments {
  distortion: number;           // -100 to +100 (pincushion to barrel)
  chromaticAberration: boolean; // toggle CA correction
  caRedCyan: number;            // -100 to +100
  caBlueYellow: number;         // -100 to +100
  vignetteCorrection: number;   // 0 to 100
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
  isEditing?: boolean; // true while user is adjusting the crop overlay in the viewport
  x: number;      // 0 to 1
  y: number;      // 0 to 1
  width: number;  // 0 to 1
  height: number; // 0 to 1
  aspectRatio: string; // 'original' | '1:1' | '2:1' | '3:2' | '4:3' | '4:5' | '5:4' | '7:5' | '5:7' | '9:16' | '16:9' | 'free'
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

  // Detail
  sharpening: number;   // 0 to 150 (legacy & fast sync)
  noiseReduction: number; // 0 to 100 (legacy & fast sync)
  details: DetailAdjustments;

  // Effects
  texture: number;      // -100 to +100 (high-frequency micro-contrast)
  clarity: number;      // -100 to +100 (mid-tone local contrast)
  dehaze: number;       // -100 to +100 (atmospheric haze reduction)
  vignette: number;     // -100 to +100
  vignetteMidpoint: number; // 0 to 100
  vignetteFeather: number;  // 0 to 100
  grain: number;        // 0 to 100
  grainSize: number;    // 0 to 100
  grainRoughness: number; // 0 to 100 (fractal roughness)

  // Optics
  optics: OpticsAdjustments;

  // Geometry
  crop: CropGeometry;

  // Local masks
  masks: LocalMask[];

  // Background removal state
  backgroundRemoval?: BackgroundRemovalState;
}

export type PresetCategory =
  | 'Cinematic'
  | 'Portrait'
  | 'Landscape'
  | 'Street'
  | 'Film'
  | 'Black & White'
  | 'Vibrant'
  | 'Custom'
  | 'Monochrome'
  | 'Vintage';

export interface Preset {
  id: string;
  name: string;
  category: PresetCategory;
  description: string;
  adjustments: Partial<Adjustments>;
  thumbnail?: string;
  createdAt?: number;
  updatedAt?: number;
  isFavorite?: boolean;
  isCustom?: boolean;
  version?: number;
}

export interface PresetPack {
  format: 'lumaforge-preset-pack';
  version: number;
  name?: string;
  description?: string;
  exportedAt: number;
  presets: Preset[];
}

export interface HistoryEntry {
  id: string;
  action: string;
  timestamp: number;
  adjustments: Adjustments;
}

export interface Snapshot {
  id: string;
  name: string;
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
  snapshots?: Snapshot[];
  rating?: number; // 0 to 5
  flag?: 'pick' | 'reject' | 'none';
  colorLabel?: 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'none';
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

export type WorkspaceMode = 'develop' | 'select' | 'remove' | 'background';

export type SelectionMode = 'select-people' | 'brush' | 'lasso' | 'polygon' | 'color-range';
export type SelectionOperation = 'add' | 'subtract' | 'new';

export interface PersonDetectionInfo {
  detected: boolean;
  count: number;
  model: 'mediapipe-selfie' | 'local-saliency' | 'none';
  statusMessage?: string;
}

export interface SelectionState {
  mode: SelectionMode;
  operation: SelectionOperation;
  brushSize: number; // in pixels
  brushFeather: number;
  tolerance: number; // for color range (1-100)
  contiguous: boolean; // flood fill vs global
  polygonPoints: { x: number; y: number }[]; // in normalized coordinates
  lassoPoints: { x: number; y: number }[]; // in normalized coordinates
  maskBitmap: number[] | null; // 0-255 normalized alpha grid
  maskWidth: number;
  maskHeight: number;
  hasSelection: boolean;
  isDetectingPeople?: boolean;
  personInfo?: PersonDetectionInfo | null;
  localAdjustments: LocalMaskAdjustments;
}

export interface RetouchState {
  brushSize: number; // in pixels
  hardness: number; // 0 to 100
  feather: number; // 0 to 50
  mode: 'add' | 'erase';
  toolMode: 'object' | 'person'; // Remove Object vs Remove Person
  maskBitmap: number[] | null; // 0-255 alpha grid
  maskWidth: number;
  maskHeight: number;
  hasMask: boolean;
  isProcessing: boolean;
  algorithm: 'ai' | 'local';
  error: string | null;
  successMessage?: string | null;
}

export interface BackgroundRemovalState {
  enabled: boolean;
  isProcessing: boolean;
  modelType: 'mediapipe-selfie' | 'local-saliency' | 'none';
  maskBitmap: number[] | null; // 0-255 alpha values
  maskWidth: number;
  maskHeight: number;
  mode: 'transparent' | 'color' | 'image' | 'blur';
  color: string;
  blurRadius: number; // 0-30 px
  customBgUrl: string | null;
  feather: number; // 0-20 px
  edgeShift: number; // -10 to +10 px
  error: string | null;
}

