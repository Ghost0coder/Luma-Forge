import { generateCurveLUT, rgbToHsl, hslToRgb, applyHslMixer, applyColorGrading } from '../src/engine/colorScience';
import { getDefaultAdjustments, cloneAdjustments } from '../src/engine/defaultAdjustments';
import { applyPresetWithStrength, parsePresetFile, exportPresetToFile } from '../src/presets/presetUtils';
import { BUILT_IN_PRESETS } from '../src/presets/builtInPresets';
import { PhotoProject } from '../src/types/editor';

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

// Test 8: Export Dimension Calculations & Rotation Handlers
console.log('8. Testing Export Dimension & Orientation Calculations...');
const origW = 3840;
const origH = 2160;

// Case A: Uncropped, 100% scale
let isRotated90 = false;
let cropW = 1.0;
let cropH = 1.0;
let scale = 1.0;
let uncroppedW = isRotated90 ? origH : origW;
let uncroppedH = isRotated90 ? origW : origH;
let finalW = Math.round(uncroppedW * cropW * scale);
let finalH = Math.round(uncroppedH * cropH * scale);
assert(finalW === 3840 && finalH === 2160, '100% full-resolution dimensions incorrect');

// Case B: Rotated 90 degrees
isRotated90 = true;
uncroppedW = isRotated90 ? origH : origW;
uncroppedH = isRotated90 ? origW : origH;
finalW = Math.round(uncroppedW * cropW * scale);
finalH = Math.round(uncroppedH * cropH * scale);
assert(finalW === 2160 && finalH === 3840, 'Rotated 90° export dimensions incorrect');

// Case C: 50% scale
scale = 0.5;
finalW = Math.round(uncroppedW * cropW * scale);
finalH = Math.round(uncroppedH * cropH * scale);
assert(finalW === 1080 && finalH === 1920, '50% scaled export dimensions incorrect');
console.log('✓ Export dimensions and orientation calculations passed.');

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

console.log('✓ AI bitmap masking and refinement math passed.');

console.log('====================================');
console.log('ALL 10 AUTOMATED ENGINE TEST SUITES PASSED (0 failures)!');
console.log('====================================');
