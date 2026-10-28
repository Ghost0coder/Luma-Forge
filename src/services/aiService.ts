import { AIAnalysisResult } from '../types/editor';
import { computeAutoEnhance } from '../engine/localEnhance';

/**
 * Requests photographic analysis & AI suggestions
 * Seamlessly falls back to client-side heuristic engine if API is unavailable
 */
export async function analyzePhoto(canvas: HTMLCanvasElement): Promise<AIAnalysisResult> {
  // Create a downscaled preview (max 512px) for fast transfer and minimal bandwidth
  const maxDim = 512;
  let w = canvas.width;
  let h = canvas.height;
  if (w > maxDim || h > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const ctx = tempCanvas.getContext('2d');

  if (ctx) {
    ctx.drawImage(canvas, 0, 0, w, h);
  }

  const base64 = tempCanvas.toDataURL('image/jpeg', 0.85);

  try {
    const res = await fetch('/api/ai/analyze-photo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: base64,
        mimeType: 'image/jpeg',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.suggestedAdjustments) {
        return {
          sceneSummary: data.sceneSummary || 'Analyzed photographic scene.',
          lightingDiagnosis: data.lightingDiagnosis || 'Dynamic range and tonal balance adjusted.',
          colorHarmony: data.colorHarmony || 'Balanced temperature and skin tones.',
          suggestedAdjustments: data.suggestedAdjustments,
          confidence: data.confidence || 0.92,
        };
      }
    }
  } catch (err) {
    console.warn('AI backend unavailable, utilizing local photographic engine:', err);
  }

  // Local fallback heuristic
  const localSuggestions = computeAutoEnhance(canvas);
  return {
    sceneSummary: 'Local photographic engine analysis.',
    lightingDiagnosis: 'Histogram equalized with highlight protection and shadow detail expansion.',
    colorHarmony: 'Calculated neutral white point using gray-world tonal balancing.',
    suggestedAdjustments: localSuggestions,
    confidence: 0.88,
  };
}
