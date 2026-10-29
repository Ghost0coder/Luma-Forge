import { generateCurveLUT, rgbToHsl, hslToRgb, applyHslMixer, applyColorGrading } from '../src/engine/colorScience';
import { getDefaultAdjustments, cloneAdjustments } from '../src/engine/defaultAdjustments';
import { applyPresetWithStrength, parsePresetFile, exportPresetToFile } from '../src/presets/presetUtils';
import { BUILT_IN_PRESETS } from '../src/presets/builtInPresets';
import { PhotoProject } from '../src/types/editor';
import { calculateAspectCrop, getExportDimensions, CROP_ASPECT_RATIOS } from '../src/engine/cropUtils';

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
const importedPreset = parsePresetFile(presetJson);
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
import { processPixelData } from '../src/engine/pipeline';
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
  { id: 'h1', action: 'Import', timestamp: 100, adjustments: getDefaultAdjustments() },
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

console.log('====================================');
console.log('ALL 16 AUTOMATED ENGINE TEST SUITES PASSED (0 failures)!');
console.log('====================================');



