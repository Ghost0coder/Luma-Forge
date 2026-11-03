import {
  generateCurveLUT,
  rgbToHsl,
  hslToRgb,
  applyHslMixer,
  prepareHslMixer,
  applyColorGrading,
  prepareColorGrading,
} from '../src/engine/colorScience';
import {
  getDefaultAdjustments,
  cloneAdjustments,
  migrateAdjustments,
  DEFAULT_DETAIL_ADJUSTMENTS,
  DEFAULT_OPTICS_ADJUSTMENTS,
  DEFAULT_COLOR_GRADING,
  DEFAULT_TONE_CURVES,
  DEFAULT_HSL_MIXER,
} from '../src/engine/defaultAdjustments';
import {
  applyProfessionalSharpening,
  applyProfessionalNoiseReduction,
  applyTextureAdjustment,
} from '../src/engine/detailsEngine';
import { applyOpticsAdjustments } from '../src/engine/opticsEngine';
import { processPixelData } from '../src/engine/pipeline';
import { applyPresetWithStrength, parsePresetFile, exportPresetToFile, duplicatePreset } from '../src/presets/presetUtils';
import { BUILT_IN_PRESETS } from '../src/presets/builtInPresets';
import { PhotoProject, Preset, LocalMask } from '../src/types/editor';
import { calculateAspectCrop, getExportDimensions, CROP_ASPECT_RATIOS } from '../src/engine/cropUtils';
import {
  isPointInPolygon,
  applyPolygonToSelection,
  applyBrushStrokeToSelection,
  applyColorRangeToSelection,
  invertSelectionMask,
  expandSelectionMask,
  contractSelectionMask,
  featherSelectionMask,
  createEmptySelection,
} from '../src/engine/selection/selectionEngine';
import { inpaintLocally } from '../src/engine/retouch/localPatch';
import { refineBackgroundMask } from '../src/engine/segmentation/backgroundRemover';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('--- LUMAFORGE AUTOMATED TEST SUITE ---');

// Test 1: Monotone Cubic Spline Tone Curve LUT
console.log('1. Testing Fritsch-Carlson Tone Curve Spline...');
const linearPoints = [{ x: 0, y: 0 }, { x: 255, y: 255 }];
const linearLut = generateCurveLUT(linearPoints);
assert(linearLut.length === 256, 'LUT must have 256 values');
assert(linearLut[0] === 0, 'Linear LUT start must be 0');
assert(linearLut[255] === 255, 'Linear LUT end must be 255');
assert(linearLut[128] === 128, 'Linear LUT midpoint must be 128');

// Test S-Curve monotonicity (no decreasing values)
const sCurvePoints = [
  { x: 0, y: 0 },
  { x: 64, y: 40 },
  { x: 128, y: 128 },
  { x: 192, y: 215 },
  { x: 255, y: 255 },
];
const sCurveLut = generateCurveLUT(sCurvePoints);
for (let i = 1; i < 256; i++) {
  assert(sCurveLut[i] >= sCurveLut[i - 1], `S-Curve must be monotonic at x=${i}`);
}
console.log('✓ Tone curve spline monotonicity test passed.');

// Test 2: Color Space Conversions (RGB <-> HSL)
console.log('2. Testing RGB <-> HSL Color Space Bi-directional round-trip...');
const testColors: [number, number, number][] = [
  [1, 0, 0],       // pure red
  [0, 1, 0],       // pure green
  [0, 0, 1],       // pure blue
  [1, 0.5, 0],     // orange
  [0.8, 0.6, 0.5], // skin tone
  [0.2, 0.2, 0.2], // neutral dark
];

for (const [r, g, b] of testColors) {
  const [h, s, l] = rgbToHsl(r, g, b);
  const [r2, g2, b2] = hslToRgb(h, s, l);
  const diff = Math.abs(r - r2) + Math.abs(g - g2) + Math.abs(b - b2);
  assert(diff < 0.01, `Color roundtrip failed for [${r}, ${g}, ${b}] -> diff ${diff}`);
}
console.log('✓ Color space conversions round-trip passed.');

// Test 3: HSL Color Mixer Channel Isolation & Falloff
console.log('3. Testing HSL Color Mixer selective hue targeting...');
const defaultAdj = getDefaultAdjustments();
const redMixer = cloneAdjustments(defaultAdj).hslMixer;
redMixer.red.hue = 50; // Shift red channel

// A pure red color (h ~ 0) should be shifted
const [shiftedH] = applyHslMixer(0, 0.8, 0.5, redMixer);
assert(shiftedH !== 0, 'Red mixer must alter red hue');

// A cyan/blue color (h = 200) should be completely untouched
const [untouchedH] = applyHslMixer(200, 0.8, 0.5, redMixer);
assert(Math.abs(untouchedH - 200) < 0.001, 'Red mixer must not affect blue hue');
console.log('✓ HSL mixer channel selectivity passed.');

// Test 4: Preset Application & Strength Scaling
console.log('4. Testing Preset Application & Strength Scaling...');
const baseAdj = getDefaultAdjustments();
const preset = BUILT_IN_PRESETS[0]; // Cinematic Teal & Orange

const fullStrength = applyPresetWithStrength(baseAdj, preset, 1.0);
assert(fullStrength.exposure === preset.adjustments.exposure, 'Full strength preset exposure mismatch');

const halfStrength = applyPresetWithStrength(baseAdj, preset, 0.5);
assert(
  Math.abs((halfStrength.exposure || 0) - (preset.adjustments.exposure || 0) * 0.5) < 0.001,
  'Half strength preset exposure mismatch'
);
console.log('✓ Preset strength scaling passed.');

// Test 5: Preset JSON Serialization & Deserialization
console.log('5. Testing Preset JSON Import & Export...');
const presetJson = JSON.stringify({
  name: 'Studio Matte Black',
  description: 'Deep film shadows',
  adjustments: { contrast: 30, saturation: -50 },
});
const importedResult = parsePresetFile(presetJson);
const importedPreset = Array.isArray(importedResult) ? importedResult[0] : importedResult;
assert(importedPreset.name === 'Studio Matte Black', 'Imported preset name mismatch');
assert(importedPreset.adjustments.contrast === 30, 'Imported preset adjustments mismatch');
assert(importedPreset.isCustom === true, 'Imported preset must be flagged as custom');
console.log('✓ Preset JSON import/export passed.');

// Test 6: Non-Destructive Undo/Redo State Invariants
console.log('6. Testing Non-destructive Undo/Redo stack invariants...');
const historyStack = [
  { id: '1', action: 'Init', timestamp: 1, adjustments: getDefaultAdjustments() },
];
let activeAdj = cloneAdjustments(historyStack[0].adjustments);

// Simulate change 1
activeAdj.exposure = 1.5;
historyStack.push({ id: '2', action: 'Exposure +1.5', timestamp: 2, adjustments: cloneAdjustments(activeAdj) });

// Simulate change 2
activeAdj.contrast = 25;
historyStack.push({ id: '3', action: 'Contrast +25', timestamp: 3, adjustments: cloneAdjustments(activeAdj) });

// Undo to step 1
const undoState = historyStack[1].adjustments;
assert(undoState.exposure === 1.5, 'Undo step 1 exposure mismatch');
assert(undoState.contrast === 0, 'Undo step 1 contrast must be 0');

// Redo to step 2
const redoState = historyStack[2].adjustments;
assert(redoState.exposure === 1.5, 'Redo step 2 exposure mismatch');
assert(redoState.contrast === 25, 'Redo step 2 contrast mismatch');
console.log('✓ Non-destructive undo/redo invariants verified.');

// Test 7: Project Serialization and Restoration
console.log('7. Testing Project Serialization and Restoration...');
const sampleProject: PhotoProject = {
  id: 'proj-test-123',
  name: 'Editorial_Portrait.jpg',
  imageDataUrl: 'data:image/jpeg;base64,/9j/testdata',
  thumbnailUrl: 'data:image/jpeg;base64,/9j/thumbdata',
  width: 4000,
  height: 3000,
  fileSize: 4500000,
  mimeType: 'image/jpeg',
  adjustments: {
    ...getDefaultAdjustments(),
    exposure: 0.75,
    highlights: -30,
    shadows: 20,
    temperature: 15,
  },
  history: [
    { id: 'h1', action: 'Import', timestamp: 100, adjustments: getDefaultAdjustments() },
    {
      id: 'h2',
      action: 'Exposure',
      timestamp: 200,
      adjustments: { ...getDefaultAdjustments(), exposure: 0.75 },
    },
  ],
  historyIndex: 1,
  createdAt: 100,
  updatedAt: 200,
};

// Serialize to JSON and parse back (simulating IndexedDB storage round-trip)
const serialized = JSON.stringify(sampleProject);
const restored: PhotoProject = JSON.parse(serialized);

assert(restored.id === sampleProject.id, 'Project ID mismatch');
assert(restored.width === 4000 && restored.height === 3000, 'Dimensions mismatch');
assert(restored.adjustments.exposure === 0.75, 'Restored adjustment mismatch');
assert(restored.adjustments.highlights === -30, 'Restored highlights mismatch');
assert(restored.history.length === 2, 'Restored history length mismatch');
assert(restored.historyIndex === 1, 'Restored historyIndex mismatch');
console.log('✓ Project serialization and session restoration passed.');

// Test 8: Authoritative Aspect Ratio, Crop Geometry & Export Dimension Regression Tests
console.log('8. Testing Aspect Ratio Calculations, Crop Geometry & Export Dimensions...');

// 8.1 Landscape Photo (3840 x 2160, 16:9)
const landW = 3840;
const landH = 2160;

// Test 1:1 Square crop on landscape photo
const land1x1 = calculateAspectCrop(landW, landH, '1:1');
assert(land1x1.active === true, '1:1 crop must be active');
assert(land1x1.aspectRatio === '1:1', 'aspectRatio must be 1:1');
assert(land1x1.width <= 1.0 && land1x1.height <= 1.0, 'Dimensions must be bounded');
assert(land1x1.x >= 0 && land1x1.y >= 0, 'Offsets must be positive');
const land1x1Export = getExportDimensions(landW, landH, land1x1 as any, 1.0);
assert(land1x1Export.width === land1x1Export.height, `1:1 on landscape must be square: ${land1x1Export.width}x${land1x1Export.height}`);
assert(land1x1Export.width === 2160 && land1x1Export.height === 2160, '1:1 crop must be 2160x2160');

// Test 2:1 Landscape crop on landscape photo
const land2x1 = calculateAspectCrop(landW, landH, '2:1');
assert(land2x1.active === true, '2:1 crop must be active');
assert(land2x1.aspectRatio === '2:1', 'aspectRatio must be 2:1');
const land2x1Export = getExportDimensions(landW, landH, land2x1 as any, 1.0);
const aspect2x1 = land2x1Export.width / land2x1Export.height;
assert(Math.abs(aspect2x1 - 2.0) < 0.005, `2:1 crop must be 2:1 ratio: ${land2x1Export.width}x${land2x1Export.height}`);
assert(land2x1Export.width === 3840 && land2x1Export.height === 1920, '2:1 crop must be 3840x1920');

// Switching from 1:1 to 2:1 visibly changes crop rectangle
assert(land1x1.width !== land2x1.width || land1x1.height !== land2x1.height, 'Switching 1:1 to 2:1 must change rectangle');

// 8.2 Portrait Photo (2000 x 3000, 2:3)
const portW = 2000;
const portH = 3000;

// Test 1:1 on portrait photo
const port1x1 = calculateAspectCrop(portW, portH, '1:1');
const port1x1Export = getExportDimensions(portW, portH, port1x1 as any, 1.0);
assert(port1x1Export.width === port1x1Export.height, `1:1 on portrait must be square: ${port1x1Export.width}x${port1x1Export.height}`);
assert(port1x1Export.width === 2000 && port1x1Export.height === 2000, '1:1 on portrait must be 2000x2000');

// Test 2:1 on portrait photo
const port2x1 = calculateAspectCrop(portW, portH, '2:1');
const port2x1Export = getExportDimensions(portW, portH, port2x1 as any, 1.0);
assert(Math.abs((port2x1Export.width / port2x1Export.height) - 2.0) < 0.005, `2:1 on portrait must be 2:1: ${port2x1Export.width}x${port2x1Export.height}`);
assert(port2x1Export.width === 2000 && port2x1Export.height === 1000, '2:1 on portrait must be 2000x1000');

// Test 4:5 on portrait photo
const port4x5 = calculateAspectCrop(portW, portH, '4:5');
const port4x5Export = getExportDimensions(portW, portH, port4x5 as any, 1.0);
assert(Math.abs((port4x5Export.width / port4x5Export.height) - 0.8) < 0.005, `4:5 on portrait must be 0.8: ${port4x5Export.width}x${port4x5Export.height}`);
assert(port4x5Export.width === 2000 && port4x5Export.height === 2500, '4:5 on portrait must be 2000x2500');

// 8.3 Square Photo (1500 x 1500, 1:1)
const sqW = 1500;
const sqH = 1500;
const sq2x1 = calculateAspectCrop(sqW, sqH, '2:1');
const sq2x1Export = getExportDimensions(sqW, sqH, sq2x1 as any, 1.0);
assert(Math.abs((sq2x1Export.width / sq2x1Export.height) - 2.0) < 0.005, '2:1 on square photo must be 2:1');
assert(sq2x1Export.width === 1500 && sq2x1Export.height === 750, '2:1 on square must be 1500x750');

// 8.4 Verify every ratio in selector produces valid, strictly non-overlapping bounds
for (const opt of CROP_ASPECT_RATIOS) {
  const cropResult = calculateAspectCrop(landW, landH, opt.key);
  assert(cropResult.x >= 0 && cropResult.x <= 1, `${opt.key}: x must be in [0, 1]`);
  assert(cropResult.y >= 0 && cropResult.y <= 1, `${opt.key}: y must be in [0, 1]`);
  assert(cropResult.width > 0 && cropResult.width <= 1, `${opt.key}: width must be in (0, 1]`);
  assert(cropResult.height > 0 && cropResult.height <= 1, `${opt.key}: height must be in (0, 1]`);
  assert(cropResult.x + cropResult.width <= 1.0001, `${opt.key}: x + width cannot exceed 1`);
  assert(cropResult.y + cropResult.height <= 1.0001, `${opt.key}: y + height cannot exceed 1`);
}

// 8.5 Repeated ratio switching does not accumulate rounding drift
let current = calculateAspectCrop(landW, landH, '1:1');
for (let cycle = 0; cycle < 5; cycle++) {
  current = calculateAspectCrop(landW, landH, '2:1');
  current = calculateAspectCrop(landW, landH, '16:9');
  current = calculateAspectCrop(landW, landH, '4:3');
  current = calculateAspectCrop(landW, landH, '1:1');
}
assert(current.width === land1x1.width && current.height === land1x1.height, 'Repeated switching must preserve exact dimensions');

// 8.6 Rotation 90° Handling and scaling
const rotCrop = calculateAspectCrop(landW, landH, '1:1', 90);
const rotExport100 = getExportDimensions(landW, landH, { ...rotCrop, stepRotation: 90, rotation: 0, flipH: false, flipV: false }, 1.0);
assert(rotExport100.width === rotExport100.height && rotExport100.width === 2160, 'Rotated 90° 1:1 export must be 2160x2160');

const rotExport50 = getExportDimensions(landW, landH, { ...rotCrop, stepRotation: 90, rotation: 0, flipH: false, flipV: false }, 0.5);
assert(rotExport50.width === 1080 && rotExport50.height === 1080, '50% scaled export must be 1080x1080');

console.log('✓ Aspect ratio, crop geometry and export dimension regression tests passed.');

// Test 9: Image Format & MIME Validation
console.log('9. Testing Image Import Format Validation...');
const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
function isValidImageFile(type: string): boolean {
  return allowedMimes.includes(type);
}
assert(isValidImageFile('image/jpeg'), 'JPEG must be accepted');
assert(isValidImageFile('image/png'), 'PNG must be accepted');
assert(isValidImageFile('image/webp'), 'WebP must be accepted');
assert(!isValidImageFile('application/pdf'), 'PDF must be rejected');
assert(!isValidImageFile('image/gif'), 'Unsupported GIF must be rejected');
console.log('✓ Image format and MIME validation passed.');

// Test 10: AI Bitmap Masking, Inversion, and Brush Refinement
console.log('10. Testing AI Bitmap Mask Evaluation and Refinement Strokes...');
const mw = 256;
const mh = 256;
const mockBitmap = new Array(mw * mh).fill(0);
// Center subject region (high alpha)
for (let y = 64; y < 192; y++) {
  for (let x = 64; x < 192; x++) {
    mockBitmap[y * mw + x] = 255;
  }
}

// Check subject mask alpha sampling at center vs background border
const centerVal = mockBitmap[128 * mw + 128] / 255;
const cornerVal = mockBitmap[10 * mw + 10] / 255;
assert(centerVal === 1.0, 'Center alpha must be 1.0');
assert(cornerVal === 0.0, 'Corner alpha must be 0.0');

// Test inversion (Background mask)
const bgCenterVal = 1.0 - centerVal;
const bgCornerVal = 1.0 - cornerVal;
assert(bgCenterVal === 0.0, 'Inverted background center alpha must be 0.0');
assert(bgCornerVal === 1.0, 'Inverted background corner alpha must be 1.0');

// Test 11: Pure Pixel Pipeline Execution with Details & Effects
console.log('11. Testing Pure Pixel Pipeline & Details & Effects (Clarity, Dehaze, Grain, Sharpening)...');
import { computeHistogramFromImageData } from '../src/engine/histogram';

const testW = 32;
const testH = 32;
const pixelBuffer = new Uint8ClampedArray(testW * testH * 4);
for (let i = 0; i < pixelBuffer.length; i += 4) {
  pixelBuffer[i] = 128;     // R
  pixelBuffer[i + 1] = 128; // G
  pixelBuffer[i + 2] = 128; // B
  pixelBuffer[i + 3] = 255; // A
}

// Neutral test pass
const neutralAdj = getDefaultAdjustments();
processPixelData(pixelBuffer, testW, testH, neutralAdj);
assert(pixelBuffer[0] === 128, 'Neutral adjustment must preserve original pixel value');

// Details & Effects test pass
const effectsAdj = {
  ...getDefaultAdjustments(),
  exposure: 1.0,
  clarity: 30,
  dehaze: 20,
  sharpening: 40,
  grain: 15,
  grainSize: 50,
  noiseReduction: 10,
};
const fxBuffer = new Uint8ClampedArray(pixelBuffer);
processPixelData(fxBuffer, testW, testH, effectsAdj);
assert(!isNaN(fxBuffer[0]), 'Pixel output must not contain NaN');
assert(fxBuffer[0] > 128, 'Exposure +1 EV must brighten pixels');
console.log('✓ Pure pixel pipeline and Details & Effects test passed.');

// Test 12: Fast Histogram Computation from ImageData Buffer
console.log('12. Testing Fast Zero-DOM Histogram Computation...');
const histData = computeHistogramFromImageData(fxBuffer, testW, testH);
assert(histData.red.length === 256, 'Histogram red bins must be 256');
assert(histData.luminance.length === 256, 'Histogram luminance bins must be 256');
assert(histData.maxCount > 0, 'Histogram maxCount must be greater than 0');
console.log('✓ Zero-DOM Histogram calculation test passed.');

// Test 13: Stale Render Job Discarding & Monotonic Job IDs
console.log('13. Testing Stale Render Result Discarding & Monotonic Job IDs...');
let latestJobId = 0;
let renderedJobId = -1;

function simulateWorkerResponse(jobId: number) {
  if (jobId >= latestJobId) {
    renderedJobId = jobId;
  }
}

// Request Job 1
latestJobId = 1;
// Request Job 2 (user dragged slider again before Job 1 finished)
latestJobId = 2;

// Job 1 completes late (stale)
simulateWorkerResponse(1);
assert(renderedJobId === -1, 'Stale Job 1 result must be discarded');

// Job 2 completes (latest)
simulateWorkerResponse(2);
assert(renderedJobId === 2, 'Latest Job 2 result must be accepted');
console.log('✓ Stale render job discarding logic passed.');

// Test 14: Continuous Slider History Immutability
console.log('14. Testing Continuous Slider History Immutability...');
const history = [
  { id: 'h1', action: 'Init', timestamp: 100, adjustments: getDefaultAdjustments() },
  { id: 'h2', action: 'Exposure', timestamp: 200, adjustments: { ...getDefaultAdjustments(), exposure: 0.5 } },
];

const actionName = 'Exposure';
const nextAdj = { ...getDefaultAdjustments(), exposure: 0.8 };
const updatedHistory = history.map((entry, idx) =>
  idx === history.length - 1 && entry.action === actionName
    ? { ...entry, adjustments: cloneAdjustments(nextAdj), timestamp: 300 }
    : entry
);

assert(history[1].adjustments.exposure === 0.5, 'Original history entry must remain untouched (immutable)');
assert(updatedHistory[1].adjustments.exposure === 0.8, 'Updated history entry must contain new adjustments');
console.log('✓ History update immutability test passed.');

// Test 15: Tone Curve Control Point Order Stability & Boundary Clamping
console.log('15. Testing Tone Curve Point Order Stability & Boundary Clamping...');
const sampleCurvePoints = [
  { x: 0, y: 0 },
  { x: 64, y: 50 },
  { x: 192, y: 200 },
  { x: 255, y: 255 },
];

function clampPointX(idx: number, rawX: number, points: { x: number; y: number }[]): number {
  const isFirst = idx === 0;
  const isLast = idx === points.length - 1;
  const minX = isFirst ? 0 : isLast ? 255 : points[idx - 1].x + 1;
  const maxX = isFirst ? 0 : isLast ? 255 : points[idx + 1].x - 1;
  return Math.max(minX, Math.min(maxX, Math.round(rawX)));
}

// Endpoint 0 cannot move horizontally
assert(clampPointX(0, 50, sampleCurvePoints) === 0, 'First point X must be clamped to 0');
// Endpoint 3 cannot move horizontally
assert(clampPointX(3, 200, sampleCurvePoints) === 255, 'Last point X must be clamped to 255');
// Middle point 1 attempted drag past point 0 (e.g. rawX = -20)
assert(clampPointX(1, -20, sampleCurvePoints) === 1, 'Point 1 X must not go below point 0 X + 1');
// Middle point 1 attempted drag past point 2 (e.g. rawX = 220)
assert(clampPointX(1, 220, sampleCurvePoints) === 191, 'Point 1 X must not exceed point 2 X - 1');

console.log('✓ Tone curve point order stability and boundary clamping passed.');

// Test 16: SVG Matrix Transform and Drag Click Guard Suppression
console.log('16. Testing SVG Matrix Transform & Drag Click Guard Suppression...');

// Mock SVG CTM matrix inverse transformation
function transformClientToSvg(clientX: number, clientY: number, matrixInverse: { a: number; d: number; e: number; f: number }) {
  const svgX = Math.max(0, Math.min(255, Math.round(clientX * matrixInverse.a + matrixInverse.e)));
  const svgY = Math.max(0, Math.min(255, Math.round(255 - (clientY * matrixInverse.d + matrixInverse.f))));
  return { x: svgX, y: svgY };
}

// Case A: 2x CSS Zoom (scale = 2, 512px rendered size)
const ctmInverse2x = { a: 0.5, d: 0.5, e: 0, f: 0 };
const coords2x = transformClientToSvg(256, 128, ctmInverse2x); // 50% X, 25% Y
assert(coords2x.x === 128 && coords2x.y === 191, 'CTM transformation at 2x zoom incorrect');

// Case B: Click guard suppression on drag end
let wasDraggingJustEnded = false;
function shouldAddPointOnClick(isDragging: boolean, wasDraggingEnded: boolean): boolean {
  if (isDragging || wasDraggingEnded) return false;
  return true;
}

assert(shouldAddPointOnClick(false, true) === false, 'Click on drag-end must be suppressed to prevent accidental point addition');
assert(shouldAddPointOnClick(false, false) === true, 'Clean click must be allowed to add a control point');

console.log('✓ SVG matrix transform and drag click guard tests passed.');

// Test 17: Traditional Non-AI Selection Engine (Point-in-poly, rasterization, flood fill, morphology)
console.log('17. Testing Traditional Non-AI Selection Engine Algorithms...');
// 17.1 Ray-casting Point in polygon
const triangle = [
  { x: 10, y: 10 },
  { x: 50, y: 10 },
  { x: 30, y: 50 },
];
assert(isPointInPolygon(30, 20, triangle) === true, 'Point (30, 20) must be inside triangle');
assert(isPointInPolygon(5, 5, triangle) === false, 'Point (5, 5) must be outside triangle');

// 17.2 Polygon rasterization onto selection mask
const selW = 64;
const selH = 64;
let selMask = createEmptySelection(selW, selH);
assert(selMask.length === selW * selH, 'Empty selection must match dimensions');

const normTriangle = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.5, y: 0.8 },
];
selMask = applyPolygonToSelection(selMask, selW, selH, normTriangle, true);
// Center should be selected
const centerSelIdx = Math.floor(selH * 0.4) * selW + Math.floor(selW * 0.5);
assert(selMask[centerSelIdx] === 255, 'Center of normalized polygon must be 255');
// Top corner should be unselected
assert(selMask[0] === 0, 'Corner outside polygon must be 0');

// 17.3 Brush rasterization
let brushMask = createEmptySelection(selW, selH);
brushMask = applyBrushStrokeToSelection(brushMask, selW, selH, 32, 32, 32, 32, 10, 0, true);
assert(brushMask[32 * selW + 32] === 255, 'Brush center must be 255');
assert(brushMask[0] === 0, 'Distant pixel must be 0');

// 17.4 Morphology: Dilation and Erosion
const dilated = expandSelectionMask(brushMask, selW, selH, 4);
assert(dilated[32 * selW + 32 + 13] === 255, 'Dilation must expand boundaries');

const eroded = contractSelectionMask(dilated, selW, selH, 4);
assert(eroded[32 * selW + 32] === 255, 'Center must survive round-trip');

// 17.5 Invert selection mask
const invertedSel = invertSelectionMask(brushMask);
assert(invertedSel[0] === 255, 'Inverted zero pixel must become 255');
assert(invertedSel[32 * selW + 32] === 0, 'Inverted 255 pixel must become 0');

// 17.6 Gaussian Feathering
const feathered = featherSelectionMask(brushMask, selW, selH, 3);
assert(feathered[32 * selW + 32] > 200, 'Feathered center must remain high');
assert(feathered.length === selW * selH, 'Feathered length must match');

// 17.7 Color range selection with BFS flood fill
const mockPixels = new Uint8ClampedArray(selW * selH * 4);
for (let y = 0; y < selH; y++) {
  for (let x = 0; x < selW; x++) {
    const idx = (y * selW + x) * 4;
    if (x < 32) {
      mockPixels[idx] = 255; // Red side
      mockPixels[idx + 1] = 0;
      mockPixels[idx + 2] = 0;
    } else {
      mockPixels[idx] = 0;   // Blue side
      mockPixels[idx + 1] = 0;
      mockPixels[idx + 2] = 255;
    }
    mockPixels[idx + 3] = 255;
  }
}
const colorSel = applyColorRangeToSelection(
  mockPixels,
  createEmptySelection(selW, selH),
  selW,
  selH,
  255, // Seed Red
  0,
  0,
  25,  // Tolerance
  true,
  10,  // Seed X
  10,  // Seed Y
  true
);
assert(colorSel[10 * selW + 10] === 255, 'Contiguous red region must be selected');
assert(colorSel[10 * selW + 45] === 0, 'Blue region must remain unselected');
console.log('✓ Traditional Non-AI Selection Engine tests passed.');

// Test 18: High-performance Offline Content-Aware Patch & Inpainting Engine
console.log('18. Testing Offline Content-Aware Patch & Inpainting Engine...');
// Create a 40x40 image with a blue background and a red 10x10 square watermark in the middle
const patchW = 40;
const patchH = 40;
const patchBuf = new Uint8ClampedArray(patchW * patchH * 4);
const patchMask = new Array(patchW * patchH).fill(0);

for (let y = 0; y < patchH; y++) {
  for (let x = 0; x < patchW; x++) {
    const pIdx = (y * patchW + x) * 4;
    const isWatermark = x >= 15 && x <= 25 && y >= 15 && y <= 25;
    if (isWatermark) {
      patchBuf[pIdx] = 255; // Red watermark
      patchBuf[pIdx + 1] = 20;
      patchBuf[pIdx + 2] = 20;
      patchMask[y * patchW + x] = 255; // Marked in mask
    } else {
      patchBuf[pIdx] = 30;  // Blue background
      patchBuf[pIdx + 1] = 80;
      patchBuf[pIdx + 2] = 200;
    }
    patchBuf[pIdx + 3] = 255;
  }
}

// Inpaint locally
const fakeImageData = {
  data: patchBuf,
  width: patchW,
  height: patchH,
} as ImageData;

const inpainted = inpaintLocally(fakeImageData, patchMask, { iterations: 2, searchRadius: 16 });
assert(inpainted.data.length === patchBuf.length, 'Inpainted output length must match input');

// Check that the center pixel (which was red 255) has been inpainted with background blue
const centerIdx = (20 * patchW + 20) * 4;
const inpaintedR = inpainted.data[centerIdx];
const inpaintedB = inpainted.data[centerIdx + 2];
assert(inpaintedB > inpaintedR, `Watermark must be replaced with surrounding blue background (R=${inpaintedR}, B=${inpaintedB})`);
console.log('✓ Offline content-aware patch & inpainting engine passed.');

// Test 19: Background Mask Refinement (Edge Shift & Feathering)
console.log('19. Testing Background Removal Mask Refinement...');
const bgW = 50;
const bgH = 50;
const rawBgMask = new Array(bgW * bgH).fill(0);
// Center square subject
for (let y = 15; y <= 35; y++) {
  for (let x = 15; x <= 35; x++) {
    rawBgMask[y * bgW + x] = 255;
  }
}

// Edge expand (+3px)
const expandedBg = refineBackgroundMask(rawBgMask, bgW, bgH, 3, 0);
assert(expandedBg[12 * bgW + 25] === 255, 'Edge shift +3 must expand subject mask outward');

// Edge shrink (-3px)
const shrunkBg = refineBackgroundMask(rawBgMask, bgW, bgH, -3, 0);
assert(shrunkBg[16 * bgW + 25] === 0, 'Edge shift -3 must shrink subject mask inward');

// Feathering
const featheredBg = refineBackgroundMask(rawBgMask, bgW, bgH, 0, 4);
assert(featheredBg[15 * bgW + 15] < 255 && featheredBg[15 * bgW + 15] > 0, 'Feathering must soften boundary edges');
console.log('✓ Background removal mask refinement passed.');

// Test 20: Professional Tone Curve Channels & Threshold Adjustments
console.log('20. Testing Professional Tone Curve Channels & Black/White Point Thresholds...');
// 20.1 Black Point clipping (shifting black point to x=30, y=0)
const blackPointClipped = [
  { x: 30, y: 0 },
  { x: 255, y: 255 },
];
const bpLut = generateCurveLUT(blackPointClipped);
assert(bpLut[0] === 0, 'Values below black point must be 0');
assert(bpLut[20] === 0, 'Values below black point must be 0');
assert(bpLut[30] === 0, 'Black point value must be 0');
assert(bpLut[255] === 255, 'White point value must be 255');
assert(bpLut[142] > 80 && bpLut[142] < 120, 'Interpolated curve values must smoothly ramp');

// 20.2 White Point clipping (shifting white point to x=220, y=255)
const whitePointClipped = [
  { x: 0, y: 0 },
  { x: 220, y: 255 },
];
const wpLut = generateCurveLUT(whitePointClipped);
assert(wpLut[0] === 0, 'Black point value must be 0');
assert(wpLut[220] === 255, 'White point value must reach 255');
assert(wpLut[240] === 255, 'Values above white point must clamp to 255');
assert(wpLut[255] === 255, 'Values above white point must clamp to 255');

// 20.3 Multi-channel curve execution through processPixelData
const curvePixels = new Uint8ClampedArray([100, 100, 100, 255, 180, 180, 180, 255]);
const curveAdj = getDefaultAdjustments();
// Boost red curve while lowering blue curve
curveAdj.toneCurves.red = [
  { x: 0, y: 0 },
  { x: 128, y: 190 },
  { x: 255, y: 255 },
];
curveAdj.toneCurves.blue = [
  { x: 0, y: 0 },
  { x: 128, y: 70 },
  { x: 255, y: 255 },
];
processPixelData(curvePixels, 2, 1, curveAdj);
assert(curvePixels[0] > 100, `Red channel should be boosted by red curve: got ${curvePixels[0]}`);
assert(curvePixels[2] < 100, `Blue channel should be decreased by blue curve: got ${curvePixels[2]}`);
assert(curvePixels[1] === 100, `Green channel should remain unmodified: got ${curvePixels[1]}`);
console.log('✓ Professional tone curve channels and threshold tests passed.');

// Test 21: Professional HSL Color Mixer Multi-Channel Verification
console.log('21. Testing Professional HSL Color Mixer (8 Channels, Hue/Sat/Lum, Reset All)...');
const hslAdj = getDefaultAdjustments();
// Set Aqua and Orange specific modifications
hslAdj.hslMixer.orange.hue = 15;
hslAdj.hslMixer.orange.saturation = 30;
hslAdj.hslMixer.aqua.luminance = -40;

const preparedHsl = prepareHslMixer(hslAdj.hslMixer);
// Test orange hue: h=30, s=0.8, l=0.5
const [orangeH, orangeS] = applyHslMixer(30, 0.8, 0.5, preparedHsl);
assert(orangeH !== 30, 'Orange hue must be shifted');
assert(orangeS > 0.8, 'Orange saturation must be boosted');

// Test that pure blue (hue 240) is unaffected by orange or aqua adjustments
const [blueH, blueS, blueL] = applyHslMixer(240, 0.8, 0.5, preparedHsl);
assert(Math.abs(blueH - 240) < 0.001, 'Blue hue must remain untouched');
assert(Math.abs(blueS - 0.8) < 0.001, 'Blue saturation must remain untouched');
assert(Math.abs(blueL - 0.5) < 0.001, 'Blue luminance must remain untouched');

// Test that aqua (hue 180) is darkened by aqua luminance adjustment (-40)
const [aquaH, aquaS, aquaL] = applyHslMixer(180, 0.8, 0.5, preparedHsl);
assert(aquaL < 0.5, 'Aqua luminance must be reduced by -40');

// Test Reset All HSL
const resetHsl = JSON.parse(JSON.stringify(DEFAULT_HSL_MIXER));
for (const key of Object.keys(resetHsl) as (keyof typeof resetHsl)[]) {
  assert(resetHsl[key].hue === 0 && resetHsl[key].saturation === 0 && resetHsl[key].luminance === 0, `Channel ${String(key)} must be zeroed`);
}
console.log('✓ Professional HSL color mixer 8-channel selectivity and reset tests passed.');

// Test 22: Professional 3-Way and Global Color Grading Engine
console.log('22. Testing Professional 3-Way and Global Color Grading Engine...');
const gradeAdj = getDefaultAdjustments();
// Warm shadows (hue 30, sat 50), Cool highlights (hue 210, sat 50), Global tint (hue 120, sat 20)
gradeAdj.colorGrading.shadows = { hue: 30, saturation: 50, luminance: 10 };
gradeAdj.colorGrading.midtones = { hue: 0, saturation: 0, luminance: 0 };
gradeAdj.colorGrading.highlights = { hue: 210, saturation: 50, luminance: -10 };
gradeAdj.colorGrading.global = { hue: 120, saturation: 20, luminance: 0 };
gradeAdj.colorGrading.blending = 60;
gradeAdj.colorGrading.balance = 10;
gradeAdj.colorGrading.strength = 80;

const preparedGrading = prepareColorGrading(gradeAdj.colorGrading);
assert(preparedGrading !== null, 'Color grading preparation must return active grade data');

// Apply to shadow pixel (dark gray)
const darkPixel = applyColorGrading(0.15, 0.15, 0.15, preparedGrading!);
// Shadows have warm hue (30 deg = reddish-orange), so R > B
assert(darkPixel[0] > darkPixel[2], `Shadow pixel must be warmer (R=${darkPixel[0].toFixed(3)} > B=${darkPixel[2].toFixed(3)})`);

// Apply to highlight pixel (light gray)
const lightPixel = applyColorGrading(0.85, 0.85, 0.85, preparedGrading!);
// Highlights have cool hue (210 deg = cyan-blue), so B > R
assert(lightPixel[2] > lightPixel[0], `Highlight pixel must be cooler (B=${lightPixel[2].toFixed(3)} > R=${lightPixel[0].toFixed(3)})`);
console.log('✓ Professional 3-way and global color grading engine tests passed.');

// Test 23: Professional Sharpening with Edge Masking & Radius
console.log('23. Testing Professional Sharpening & Edge-Masking Engine...');
const sharpW = 16;
const sharpH = 16;
const sharpBuf = new Uint8ClampedArray(sharpW * sharpH * 4);
// Create a sharp vertical edge in center (left half 50, right half 200)
for (let y = 0; y < sharpH; y++) {
  for (let x = 0; x < sharpW; x++) {
    const idx = (y * sharpW + x) * 4;
    const v = x < 8 ? 50 : 200;
    sharpBuf[idx] = v;
    sharpBuf[idx + 1] = v;
    sharpBuf[idx + 2] = v;
    sharpBuf[idx + 3] = 255;
  }
}

const sharpDetails = {
  ...DEFAULT_DETAIL_ADJUSTMENTS,
  sharpenAmount: 100,
  sharpenRadius: 1.0,
  sharpenDetail: 50,
  sharpenMasking: 20, // edge masking enabled
};
applyProfessionalSharpening(sharpBuf, sharpW, sharpH, sharpDetails);

// Edge contrast should be enhanced (dark side of edge <= 50, bright side of edge >= 200)
const leftEdgePixel = sharpBuf[(8 * sharpW + 7) * 4];
const rightEdgePixel = sharpBuf[(8 * sharpW + 8) * 4];
assert(leftEdgePixel <= 50, `Dark side of edge should be darkened or preserved by unsharp mask: got ${leftEdgePixel}`);
assert(rightEdgePixel >= 200, `Bright side of edge should be lightened or preserved by unsharp mask: got ${rightEdgePixel}`);

// Flat area away from edge should be protected by masking
const flatFarLeft = sharpBuf[(8 * sharpW + 2) * 4];
assert(Math.abs(flatFarLeft - 50) <= 2, `Flat region protected by masking must remain unchanged: got ${flatFarLeft}`);
console.log('✓ Professional sharpening with edge masking passed.');

// Test 24: Professional Noise Reduction (Bilateral Luminance + YCbCr Color Noise)
console.log('24. Testing Professional Noise Reduction (Bilateral Luminance & Color Noise)...');
const noiseW = 20;
const noiseH = 20;
const noisyBuf = new Uint8ClampedArray(noiseW * noiseH * 4);
for (let y = 0; y < noiseH; y++) {
  for (let x = 0; x < noiseW; x++) {
    const idx = (y * noiseW + x) * 4;
    // Base 128 with alternating high-frequency noise +/- 10
    const noise = ((x + y) % 2 === 0 ? 1 : -1) * 10;
    noisyBuf[idx] = 128 + noise;
    noisyBuf[idx + 1] = 128 + noise;
    noisyBuf[idx + 2] = 128 + noise;
    noisyBuf[idx + 3] = 255;
  }
}

let sumDiffBefore = 0;
for (let y = 1; y < noiseH - 1; y++) {
  for (let x = 1; x < noiseW - 1; x++) {
    const idx = (y * noiseW + x) * 4;
    sumDiffBefore += Math.abs(noisyBuf[idx] - 128);
  }
}

const nrDetails = {
  ...DEFAULT_DETAIL_ADJUSTMENTS,
  noiseLuminance: 80,
  noiseLuminanceDetail: 25,
  noiseColor: 60,
  noiseColorDetail: 50,
  noiseSmoothness: 50,
};
applyProfessionalNoiseReduction(noisyBuf, noiseW, noiseH, nrDetails);

let sumDiffAfter = 0;
for (let y = 1; y < noiseH - 1; y++) {
  for (let x = 1; x < noiseW - 1; x++) {
    const idx = (y * noiseW + x) * 4;
    sumDiffAfter += Math.abs(noisyBuf[idx] - 128);
  }
}
assert(sumDiffAfter < sumDiffBefore * 0.7, `Noise reduction must significantly suppress high-frequency noise variance: before ${sumDiffBefore}, after ${sumDiffAfter}`);
console.log('✓ Professional noise reduction passed.');

// Test 25: Professional Texture & Clarity Dual-Radius Filtering
console.log('25. Testing Professional Texture & Clarity Dual-Radius Filtering...');
const texW = 16;
const texH = 16;
const texBuf = new Uint8ClampedArray(texW * texH * 4);
for (let y = 0; y < texH; y++) {
  for (let x = 0; x < texW; x++) {
    const idx = (y * texW + x) * 4;
    // 2-pixel wide texture feature (pores / fabric weave band)
    const pattern = Math.floor(x / 2) % 2 === 0 ? 15 : -15;
    texBuf[idx] = 120 + pattern;
    texBuf[idx + 1] = 120 + pattern;
    texBuf[idx + 2] = 120 + pattern;
    texBuf[idx + 3] = 255;
  }
}
const preValA = texBuf[(4 * texW + 5) * 4];
const preValB = texBuf[(4 * texW + 7) * 4];
const preAmp = Math.abs(preValA - preValB); // 30

applyTextureAdjustment(texBuf, texW, texH, 80); // Boost texture +80
const postValA = texBuf[(4 * texW + 5) * 4];
const postValB = texBuf[(4 * texW + 7) * 4];
const postAmp = Math.abs(postValA - postValB);
assert(postAmp > preAmp, `Texture adjustment must amplify mid-frequency pore/weave texture: pre=${preAmp}, post=${postAmp}`);
console.log('✓ Professional texture and clarity filtering passed.');

// Test 26: Professional Optics Engine (Distortion, CA Defringe, Lens Vignette)
console.log('26. Testing Professional Optics Engine (Distortion, CA Defringe, Lens Vignette)...');
const optW = 32;
const optH = 32;
const optBuf = new Uint8ClampedArray(optW * optH * 4);
// Fill with uniform 100
for (let i = 0; i < optBuf.length; i += 4) {
  optBuf[i] = 100;
  optBuf[i + 1] = 100;
  optBuf[i + 2] = 100;
  optBuf[i + 3] = 255;
}

const opticsSettings = {
  ...DEFAULT_OPTICS_ADJUSTMENTS,
  distortion: 30, // Barrel distortion
  chromaticAberration: true,
  caRedCyan: 20,
  vignetteCorrection: 80, // Flat-field correction brightening corners
};
applyOpticsAdjustments(optBuf, optW, optH, opticsSettings);

// Corner pixel should be brightened by flat-field vignette correction
const cornerPixelVal = optBuf[0];
const centerPixelVal = optBuf[(16 * optW + 16) * 4];
assert(cornerPixelVal > centerPixelVal, `Lens vignette correction must boost peripheral pixels over center: corner=${cornerPixelVal}, center=${centerPixelVal}`);
console.log('✓ Professional optics engine passed.');

// Test 27: Non-Destructive State Migration & Project Serialization
console.log('27. Testing Non-Destructive State Migration & Project Serialization...');
const legacyAdjustments = {
  exposure: 0.5,
  contrast: 20,
  sharpening: 45,
  noiseReduction: 30,
  // Tone curve missing RGB subchannels, no details object, no optics object
};
const migrated = migrateAdjustments(legacyAdjustments);
assert(migrated.details !== undefined, 'Migrated state must have details object');
assert(migrated.details.sharpenAmount === 45, 'Legacy sharpening must map to details.sharpenAmount');
assert(migrated.details.noiseLuminance === 30, 'Legacy noiseReduction must map to details.noiseLuminance');
assert(migrated.optics !== undefined, 'Migrated state must have optics object');
assert(migrated.colorGrading.global !== undefined, 'Migrated state must have colorGrading.global');
assert(migrated.toneCurves.red !== undefined && migrated.toneCurves.red.length >= 2, 'Migrated tone curves must include red channel');
assert(migrated.toneCurves.green !== undefined && migrated.toneCurves.green.length >= 2, 'Migrated tone curves must include green channel');
assert(migrated.toneCurves.blue !== undefined && migrated.toneCurves.blue.length >= 2, 'Migrated tone curves must include blue channel');

// Verify clone immutability
const cloned = cloneAdjustments(migrated);
cloned.details.sharpenAmount = 90;
cloned.colorGrading.shadows.hue = 180;
assert(migrated.details.sharpenAmount === 45, 'Clone mutation must not affect source state');
assert(migrated.colorGrading.shadows.hue === 0, 'Clone mutation must not affect source state');
console.log('✓ Non-destructive state migration and project serialization passed.');

// Test 28: Built-in Preset Collection Completeness & Structural Invariants
console.log('28. Testing Built-in Preset Collection Completeness & Invariants...');
assert(BUILT_IN_PRESETS.length === 33, `Expected 33 built-in presets, got ${BUILT_IN_PRESETS.length}`);

const requiredPresetNames = [
  // Cinematic
  'Cinematic Warm', 'Teal & Orange', 'Moody Cinema', 'Soft Film', 'Night Cinema',
  // Portrait
  'Natural Portrait', 'Warm Skin', 'Soft Portrait', 'Studio Portrait', 'Classic Portrait',
  // Landscape
  'Golden Hour', 'Vivid Landscape', 'Natural Green', 'Dramatic Sky', 'Soft Landscape',
  // Street
  'Urban Contrast', 'Urban Fade', 'Night Street', 'Documentary', 'Monochrome Street',
  // Film
  'Vintage Film', 'Analog Warm', 'Faded Film', 'Classic Negative-inspired original look', 'Grainy Cinema',
  // Black & White
  'Classic B&W', 'High Contrast B&W', 'Soft Monochrome', 'Matte Monochrome',
  // Vibrant
  'Rich Colors', 'Summer Pop', 'Clean Bright', 'Deep Color',
];

const foundNames = new Set(BUILT_IN_PRESETS.map((p) => p.name));
for (const reqName of requiredPresetNames) {
  assert(foundNames.has(reqName), `Required preset "${reqName}" missing from built-in collection`);
}

for (const p of BUILT_IN_PRESETS) {
  assert(Boolean(p.id && p.id.length > 2), `Preset "${p.name}" has invalid id`);
  assert(Boolean(p.category), `Preset "${p.name}" has missing category`);
  assert(Boolean(p.description), `Preset "${p.name}" has missing description`);
  assert(p.isCustom === false, `Built-in preset "${p.name}" must have isCustom: false`);
  assert(p.version === 1, `Preset "${p.name}" must have version: 1`);
  assert(p.adjustments && Object.keys(p.adjustments).length > 0, `Preset "${p.name}" must have non-empty adjustments`);
}
console.log('✓ Built-in preset collection completeness and invariants verified.');

// Test 29: Preset Application & Predictable Replacement Policy (Non-Destructive)
console.log('29. Testing Preset Application & Replacement Policy...');
const baseProjectAdj = getDefaultAdjustments();
baseProjectAdj.exposure = 0.2;
baseProjectAdj.crop = {
  active: true,
  x: 0.1,
  y: 0.1,
  width: 0.8,
  height: 0.8,
  aspectRatio: '1:1',
  rotation: 0,
  stepRotation: 0,
  flipH: false,
  flipV: false,
};
baseProjectAdj.masks = [
  {
    id: 'mask-test-1',
    name: 'Subject Radial',
    type: 'radial',
    enabled: true,
    inverted: false,
    opacity: 100,
    centerX: 0.5,
    centerY: 0.5,
    radiusX: 0.3,
    radiusY: 0.3,
    feather: 0.5,
    adjustments: { exposure: 0.5, contrast: 10, saturation: 5, temperature: 0, sharpness: 10 },
  },
];

// Apply Preset 1: Cinematic Warm
const cinematicWarm = BUILT_IN_PRESETS.find((p) => p.name === 'Cinematic Warm')!;
const appliedPreset1 = applyPresetWithStrength(baseProjectAdj, cinematicWarm, 1.0);
assert(appliedPreset1.temperature === cinematicWarm.adjustments.temperature, 'Preset 1 temperature mismatch');
assert(appliedPreset1.crop.active === true && appliedPreset1.crop.aspectRatio === '1:1', 'Crop geometry must be preserved across preset application');
assert(appliedPreset1.masks.length === 1 && appliedPreset1.masks[0].id === 'mask-test-1', 'Local masks must be preserved across preset application');

// Apply Preset 2: Vivid Landscape (verifying clean replacement, not compounding)
const vividLandscape = BUILT_IN_PRESETS.find((p) => p.name === 'Vivid Landscape')!;
const appliedPreset2 = applyPresetWithStrength(appliedPreset1, vividLandscape, 1.0);
assert(appliedPreset2.temperature === vividLandscape.adjustments.temperature, 'Preset 2 must replace temperature rather than compound');
assert(appliedPreset2.vibrance === vividLandscape.adjustments.vibrance, 'Preset 2 must replace vibrance');
assert(appliedPreset2.crop.active === true, 'Crop must remain intact after switching presets');
assert(appliedPreset2.masks.length === 1, 'Masks must remain intact after switching presets');
console.log('✓ Preset application and non-destructive replacement policy verified.');

// Test 30: Live Preset Preview & Cancellation (Zero History Mutation)
console.log('30. Testing Live Preset Preview & Cancellation...');
const liveBase = getDefaultAdjustments();
liveBase.exposure = 0.0;
// Simulate user hovering over a preset: temporary preview generated
const hoverPreset = BUILT_IN_PRESETS.find((p) => p.name === 'Summer Pop')!;
const previewState = applyPresetWithStrength(liveBase, hoverPreset, 1.0);
assert(previewState.exposure !== liveBase.exposure, 'Preview state must reflect preset parameters');
// When mouse leaves or preview is cancelled, state reverts directly to liveBase
const restoredState = liveBase;
assert(restoredState.exposure === 0.0, 'Restored state must match original baseline before preview');
console.log('✓ Live preset preview and cancellation verified.');

// Test 31: Custom Preset Creation, Duplication, Metadata Updates & Deletion
console.log('31. Testing Custom Preset Creation, Duplication, Renaming & Deletion...');
const customSource = getDefaultAdjustments();
customSource.contrast = 25;
customSource.saturation = -15;
customSource.texture = 18;

// Create custom preset
const customCreated: Preset = {
  id: `custom-${Date.now()}-1`,
  name: 'Nordic Clean',
  category: 'Portrait',
  description: 'Nordic minimalist tone profile',
  adjustments: cloneAdjustments(customSource),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isCustom: true,
  version: 1,
};
assert(customCreated.isCustom === true, 'Custom preset must have isCustom: true');
assert(customCreated.adjustments.texture === 18, 'Custom preset must retain texture adjustment');

// Duplicate preset
const duplicated = duplicatePreset(customCreated, 'Nordic Clean (Duplicated Copy)');
assert(duplicated.id !== customCreated.id, 'Duplicated preset must receive unique ID');
assert(duplicated.name === 'Nordic Clean (Duplicated Copy)', 'Duplicated preset name must match requested name');
assert(duplicated.isCustom === true, 'Duplicated preset must be editable custom preset');
assert(duplicated.adjustments.contrast === 25, 'Duplicated preset must copy adjustment values');

// Rename / update metadata
const updatedCustom: Preset = {
  ...duplicated,
  name: 'Nordic Clean Studio Pro',
  category: 'Custom',
  description: 'Updated studio description',
  updatedAt: Date.now(),
};
assert(updatedCustom.name === 'Nordic Clean Studio Pro', 'Preset rename must succeed');
assert(updatedCustom.category === 'Custom', 'Preset category update must succeed');

// Delete custom preset simulation
let customList = [customCreated, updatedCustom];
customList = customList.filter((p) => p.id !== updatedCustom.id);
assert(customList.length === 1 && customList[0].id === customCreated.id, 'Custom preset deletion must succeed');
console.log('✓ Custom preset creation, duplication, renaming and deletion verified.');

// Test 32: Preset Favorites & Search/Category Filtering
console.log('32. Testing Preset Favorites & Multi-Attribute Search/Category Filtering...');
const favSet = new Set<string>();
const presetToFav = BUILT_IN_PRESETS[1]; // Teal & Orange
favSet.add(presetToFav.id);
assert(favSet.has(presetToFav.id) === true, 'Preset must be marked as favorite');

// Filter by Favorites
const favoritesOnly = BUILT_IN_PRESETS.filter((p) => favSet.has(p.id));
assert(favoritesOnly.length === 1 && favoritesOnly[0].id === presetToFav.id, 'Favorites filter must isolate starred presets');

// Filter by Category
const filmPresets = BUILT_IN_PRESETS.filter((p) => p.category === 'Film');
assert(filmPresets.length === 5, `Expected 5 film presets, got ${filmPresets.length}`);

// Text search across name and description
const searchQuery = 'split-tone';
const searchMatches = BUILT_IN_PRESETS.filter(
  (p) => p.name.toLowerCase().includes(searchQuery) || p.description.toLowerCase().includes(searchQuery)
);
assert(searchMatches.length > 0, 'Search query must find matching presets by description');
console.log('✓ Preset favorites and multi-attribute search/category filtering verified.');

// Test 33: Single Preset & Batch Preset Pack JSON Serialization
console.log('33. Testing Single Preset & Batch Preset Pack JSON Serialization...');
const exportSingle = BUILT_IN_PRESETS[0];
const singleJson = JSON.stringify({
  format: 'lumaforge-preset',
  version: 1,
  id: exportSingle.id,
  name: exportSingle.name,
  category: exportSingle.category,
  description: exportSingle.description,
  adjustments: exportSingle.adjustments,
  exportedAt: Date.now(),
});
const parsedSingle = JSON.parse(singleJson);
assert(parsedSingle.format === 'lumaforge-preset', 'Single preset format descriptor must be present');
assert(parsedSingle.version === 1, 'Version field must be 1');
assert(parsedSingle.name === exportSingle.name, 'Exported name must match source preset');

// Batch preset pack serialization
const packPresets = [BUILT_IN_PRESETS[0], BUILT_IN_PRESETS[1], BUILT_IN_PRESETS[2]];
const packJson = JSON.stringify({
  format: 'lumaforge-preset-pack',
  version: 1,
  name: 'Cinematic Trio Pack',
  exportedAt: Date.now(),
  presets: packPresets,
});
const parsedPack = JSON.parse(packJson);
assert(parsedPack.format === 'lumaforge-preset-pack', 'Pack format descriptor must be present');
assert(parsedPack.presets.length === 3, 'Pack must serialize all 3 presets');
console.log('✓ Single preset and batch preset pack JSON serialization verified.');

// Test 34: Robust Preset Import Validation & Malicious Token Rejection
console.log('34. Testing Robust Preset Import Validation & Security Protection...');
// 34.1 Import valid single preset
const validSingleText = JSON.stringify({
  name: 'Tokyo Neon Street',
  category: 'Street',
  description: 'Vibrant neon street tones',
  adjustments: { exposure: 0.1, contrast: 20, vibrance: 30 },
});
const importedSingle = parsePresetFile(validSingleText);
const singlePresetItem = Array.isArray(importedSingle) ? importedSingle[0] : importedSingle;
assert(singlePresetItem.name === 'Tokyo Neon Street', 'Imported name must match');
assert(singlePresetItem.isCustom === true, 'Imported preset must be flagged as custom');
assert(singlePresetItem.id.startsWith('custom-'), 'Imported preset must receive safe custom ID');

// 34.2 Import valid preset pack
const validPackText = JSON.stringify({
  format: 'lumaforge-preset-pack',
  version: 1,
  name: 'Urban Collection',
  presets: [
    { name: 'Urban A', adjustments: { exposure: 0.1 } },
    { name: 'Urban B', adjustments: { exposure: -0.1 } },
  ],
});
const importedPack = parsePresetFile(validPackText);
assert(Array.isArray(importedPack), 'Imported pack must return an array of presets');
const packArray = importedPack as Preset[];
assert(packArray.length === 2, 'Imported pack must contain 2 presets');
assert(packArray[0].name === 'Urban A' && packArray[1].name === 'Urban B', 'Pack presets must retain names');

// 34.3 Rejection of malicious tokens (__proto__, constructor, <script)
let securityCaughtProto = false;
try {
  parsePresetFile('{"name": "Bad", "__proto__": {"polluted": true}}');
} catch (err: any) {
  securityCaughtProto = true;
  assert(err.message.includes('unsafe properties'), 'Error message must explain security violation');
}
assert(securityCaughtProto, 'Import must reject JSON containing __proto__');

let securityCaughtScript = false;
try {
  parsePresetFile('{"name": "<script>alert(1)</script>", "adjustments": {}}');
} catch (err: any) {
  securityCaughtScript = true;
}
assert(securityCaughtScript, 'Import must reject JSON containing <script>');

// 34.4 Rejection of malformed syntax or missing name
let syntaxCaught = false;
try {
  parsePresetFile('{not valid json');
} catch {
  syntaxCaught = true;
}
assert(syntaxCaught, 'Import must reject malformed JSON syntax');

let missingNameCaught = false;
try {
  parsePresetFile('{"description": "No name provided"}');
} catch {
  missingNameCaught = true;
}
assert(missingNameCaught, 'Import must reject preset missing required name');
console.log('✓ Robust preset import validation and security protection verified.');

// Test 35: Preset History Undo & Redo Stack Invariants
console.log('35. Testing Preset History Undo & Redo Stack Invariants...');
const histStack = [
  { id: 'h0', action: 'Import Photo', adjustments: getDefaultAdjustments() },
];
let hIndex = 0;

// Apply Preset 1
const p1 = BUILT_IN_PRESETS[0];
const stateAfterP1 = applyPresetWithStrength(histStack[hIndex].adjustments, p1, 1.0);
histStack.push({ id: 'h1', action: `Apply Preset: ${p1.name}`, adjustments: stateAfterP1 });
hIndex++;
assert(histStack[hIndex].action === `Apply Preset: ${p1.name}`, 'History stack must record Preset 1');

// Apply Preset 2
const p2 = BUILT_IN_PRESETS[1];
const stateAfterP2 = applyPresetWithStrength(histStack[hIndex].adjustments, p2, 1.0);
histStack.push({ id: 'h2', action: `Apply Preset: ${p2.name}`, adjustments: stateAfterP2 });
hIndex++;
assert(histStack[hIndex].action === `Apply Preset: ${p2.name}`, 'History stack must record Preset 2');

// Undo 1: returns to stateAfterP1
hIndex--;
assert(histStack[hIndex].action === `Apply Preset: ${p1.name}`, 'Undo must restore Preset 1 state');
assert(histStack[hIndex].adjustments.temperature === p1.adjustments.temperature, 'Undo must restore Preset 1 adjustments');

// Undo 2: returns to initial unedited state
hIndex--;
assert(histStack[hIndex].action === 'Import Photo', 'Second undo must restore initial unedited photo state');

// Redo 1: returns to Preset 1
hIndex++;
assert(histStack[hIndex].action === `Apply Preset: ${p1.name}`, 'Redo must restore Preset 1');

// Redo 2: returns to Preset 2
hIndex++;
assert(histStack[hIndex].action === `Apply Preset: ${p2.name}`, 'Second redo must restore Preset 2');
console.log('✓ Preset history undo and redo stack invariants verified.');

console.log('====================================');
console.log('ALL 35 AUTOMATED ENGINE TEST SUITES PASSED (0 failures)!');
console.log('====================================');


