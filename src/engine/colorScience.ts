import { CurvePoint, HSLMixer, HSLColorName, ColorGrading } from '../types/editor';

// LRU Cache for Monotone Cubic Spline LUT generation
const lutCache = new Map<string, Uint8Array>();
const MAX_LUT_CACHE_SIZE = 64;

/**
 * Checks if a curve represents default identity [(0,0), (255,255)]
 */
export function isCurveDefault(points: CurvePoint[]): boolean {
  if (!points || points.length === 0) return true;
  if (points.length === 2 && points[0].x === 0 && points[0].y === 0 && points[1].x === 255 && points[1].y === 255) {
    return true;
  }
  return false;
}

/**
 * Generates a 256-element LUT from control points using Fritsch-Carlson Monotone Cubic Spline
 */
export function generateCurveLUT(points: CurvePoint[]): Uint8Array {
  if (!points || points.length === 0) {
    const defaultLut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) defaultLut[i] = i;
    return defaultLut;
  }

  if (isCurveDefault(points)) {
    const defaultLut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) defaultLut[i] = i;
    return defaultLut;
  }

  // Create cache key from points
  const cacheKey = points.map((p) => `${p.x}:${p.y}`).join(',');
  const cached = lutCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const lut = new Uint8Array(256);

  // Sort points by x coordinate
  const sorted = [...points].sort((a, b) => a.x - b.x);

  // Ensure endpoints exist
  const pts: CurvePoint[] = [];
  if (sorted[0].x > 0) {
    pts.push({ x: 0, y: sorted[0].y });
  }
  for (const p of sorted) {
    pts.push(p);
  }
  if (pts[pts.length - 1].x < 255) {
    pts.push({ x: 255, y: pts[pts.length - 1].y });
  }

  const n = pts.length;
  if (n === 1) {
    const val = Math.max(0, Math.min(255, Math.round(pts[0].y)));
    lut.fill(val);
    if (lutCache.size >= MAX_LUT_CACHE_SIZE) lutCache.clear();
    lutCache.set(cacheKey, lut);
    return lut;
  }

  const dx: number[] = new Array(n - 1);
  const dy: number[] = new Array(n - 1);
  const m: number[] = new Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    dy[i] = pts[i + 1].y - pts[i].y;
    m[i] = dx[i] === 0 ? 0 : dy[i] / dx[i];
  }

  const tangents: number[] = new Array(n);
  tangents[0] = m[0];
  tangents[n - 1] = m[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      tangents[i] = 0;
    } else {
      tangents[i] = (m[i - 1] + m[i]) / 2;
    }
  }

  for (let i = 0; i < n - 1; i++) {
    if (dy[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const a = tangents[i] / m[i];
      const b = tangents[i + 1] / m[i];
      const h = Math.hypot(a, b);
      if (h > 3) {
        const t = 3 / h;
        tangents[i] = t * a * m[i];
        tangents[i + 1] = t * b * m[i];
      }
    }
  }

  // Sample along x = 0..255
  let segment = 0;
  for (let x = 0; x < 256; x++) {
    while (segment < n - 2 && x > pts[segment + 1].x) {
      segment++;
    }
    const x0 = pts[segment].x;
    const x1 = pts[segment + 1].x;
    const y0 = pts[segment].y;
    const y1 = pts[segment + 1].y;
    const h = x1 - x0;

    let y: number;
    if (h === 0) {
      y = y0;
    } else {
      const t = (x - x0) / h;
      const t2 = t * t;
      const t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;
      y = h00 * y0 + h10 * h * tangents[segment] + h01 * y1 + h11 * h * tangents[segment + 1];
    }
    lut[x] = Math.max(0, Math.min(255, Math.round(y)));
  }

  if (lutCache.size >= MAX_LUT_CACHE_SIZE) lutCache.clear();
  lutCache.set(cacheKey, lut);
  return lut;
}

/**
 * RGB to HSL (r, g, b in 0..1) -> [h (0..360), s (0..1), l (0..1)]
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }

  return [h, s, l];
}

/**
 * HSL to RGB (h 0..360, s 0..1, l 0..1) -> [r, g, b in 0..1]
 */
function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));

  if (s === 0) {
    return [l, l, l];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hNorm = h / 360;

  const r = hue2rgb(p, q, hNorm + 1 / 3);
  const g = hue2rgb(p, q, hNorm);
  const b = hue2rgb(p, q, hNorm - 1 / 3);

  return [r, g, b];
}

// Center hue for the 8 HSL channels
export const HSL_CENTERS: Record<HSLColorName, number> = {
  red: 0,
  orange: 30,
  yellow: 60,
  green: 120,
  aqua: 180,
  blue: 240,
  purple: 280,
  magenta: 320,
};

export const HSL_CHANNEL_KEYS: HSLColorName[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'aqua',
  'blue',
  'purple',
  'magenta',
];

export interface ActiveHslChannel {
  center: number;
  dHue: number;
  dSat: number;
  dLum: number;
}

/**
 * Precomputes non-zero HSL Mixer channels before rendering the pixel loop
 */
export function prepareHslMixer(mixer: HSLMixer): ActiveHslChannel[] {
  const active: ActiveHslChannel[] = [];
  for (let i = 0; i < HSL_CHANNEL_KEYS.length; i++) {
    const key = HSL_CHANNEL_KEYS[i];
    const ch = mixer[key];
    if (ch.hue !== 0 || ch.saturation !== 0 || ch.luminance !== 0) {
      active.push({
        center: HSL_CENTERS[key],
        dHue: ch.hue * 0.35,
        dSat: ch.saturation / 100,
        dLum: ch.luminance / 100,
      });
    }
  }
  return active;
}

/**
 * Calculates weights and applies HSL Mixer adjustments to a given [h, s, l]
 */
export function applyHslMixer(
  h: number,
  s: number,
  l: number,
  mixerOrActive: HSLMixer | ActiveHslChannel[]
): [number, number, number] {
  if (s < 0.03) return [h, s, l]; // don't shift achromatic grays

  const activeChannels = Array.isArray(mixerOrActive)
    ? mixerOrActive
    : prepareHslMixer(mixerOrActive);

  if (activeChannels.length === 0) return [h, s, l];

  let totalWeight = 0;
  let dHue = 0;
  let dSat = 0;
  let dLum = 0;

  for (let i = 0; i < activeChannels.length; i++) {
    const ch = activeChannels[i];
    let diff = Math.abs(h - ch.center);
    if (diff > 180) diff = 360 - diff;

    // Smooth Gaussian-like falloff (width ~ 32 degrees)
    if (diff < 45) {
      const weight = Math.cos((diff / 45) * (Math.PI / 2));
      const w2 = weight * weight;
      totalWeight += w2;
      dHue += ch.dHue * w2;
      dSat += ch.dSat * w2;
      dLum += ch.dLum * w2;
    }
  }

  if (totalWeight > 0) {
    dHue /= totalWeight;
    dSat /= totalWeight;
    dLum /= totalWeight;

    h = (h + dHue + 360) % 360;
    s = Math.max(0, Math.min(1, s * (1 + dSat)));
    l = Math.max(0, Math.min(1, l + dLum * 0.4));
  }

  return [h, s, l];
}

export interface PreparedColorGrading {
  isActive: boolean;
  midPoint: number;
  shadowSat: number;
  shadowR: number;
  shadowG: number;
  shadowB: number;
  midtoneSat: number;
  midtoneR: number;
  midtoneG: number;
  midtoneB: number;
  highlightSat: number;
  highlightR: number;
  highlightG: number;
  highlightB: number;
}

/**
 * Precomputes Color Grading RGB vectors before entering pixel loop
 */
export function prepareColorGrading(grading: ColorGrading): PreparedColorGrading {
  const bal = grading.balance / 100;
  const midPoint = 0.5 + bal * 0.25;

  const shadowSat = grading.shadows.saturation;
  let shadowR = 0, shadowG = 0, shadowB = 0;
  if (shadowSat > 0) {
    [shadowR, shadowG, shadowB] = hslToRgb(grading.shadows.hue, 1, 0.5);
  }

  const midtoneSat = grading.midtones.saturation;
  let midtoneR = 0, midtoneG = 0, midtoneB = 0;
  if (midtoneSat > 0) {
    [midtoneR, midtoneG, midtoneB] = hslToRgb(grading.midtones.hue, 1, 0.5);
  }

  const highlightSat = grading.highlights.saturation;
  let highlightR = 0, highlightG = 0, highlightB = 0;
  if (highlightSat > 0) {
    [highlightR, highlightG, highlightB] = hslToRgb(grading.highlights.hue, 1, 0.5);
  }

  const isActive = shadowSat > 0 || midtoneSat > 0 || highlightSat > 0;

  return {
    isActive,
    midPoint,
    shadowSat,
    shadowR,
    shadowG,
    shadowB,
    midtoneSat,
    midtoneR,
    midtoneG,
    midtoneB,
    highlightSat,
    highlightR,
    highlightG,
    highlightB,
  };
}

/**
 * Applies 3-way Color Grading / Split Toning
 */
export function applyColorGrading(
  r: number,
  g: number,
  b: number,
  gradingOrPrepared: ColorGrading | PreparedColorGrading
): [number, number, number] {
  const prep = 'isActive' in gradingOrPrepared
    ? gradingOrPrepared
    : prepareColorGrading(gradingOrPrepared);

  if (!prep.isActive) {
    return [r, g, b];
  }

  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const midPoint = prep.midPoint;

  const shadowWeight = Math.max(0, 1 - lum / midPoint);
  const highlightWeight = Math.max(0, (lum - midPoint) / (1 - midPoint));
  const midtoneWeight = Math.max(0, 1 - Math.abs(lum - midPoint) * 2);

  if (prep.shadowSat > 0 && shadowWeight > 0) {
    const amount = (prep.shadowSat / 100) * shadowWeight * 0.4;
    r = r * (1 - amount) + prep.shadowR * amount;
    g = g * (1 - amount) + prep.shadowG * amount;
    b = b * (1 - amount) + prep.shadowB * amount;
  }

  if (prep.midtoneSat > 0 && midtoneWeight > 0) {
    const amount = (prep.midtoneSat / 100) * midtoneWeight * 0.3;
    r = r * (1 - amount) + prep.midtoneR * amount;
    g = g * (1 - amount) + prep.midtoneG * amount;
    b = b * (1 - amount) + prep.midtoneB * amount;
  }

  if (prep.highlightSat > 0 && highlightWeight > 0) {
    const amount = (prep.highlightSat / 100) * highlightWeight * 0.4;
    r = r * (1 - amount) + prep.highlightR * amount;
    g = g * (1 - amount) + prep.highlightG * amount;
    b = b * (1 - amount) + prep.highlightB * amount;
  }

  return [
    Math.max(0, Math.min(1, r)),
    Math.max(0, Math.min(1, g)),
    Math.max(0, Math.min(1, b)),
  ];
}

