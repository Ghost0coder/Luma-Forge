import { AIAnalysisResult } from '../types/editor';
import { computeAutoEnhance } from '../engine/localEnhance';
import { inpaintLocally } from '../engine/retouch/localPatch';

/**
 * Computes deterministic photographic analysis & auto-enhance parameters
 * Executes 100% locally in browser using histogram and color statistics rules.
 */
export async function analyzePhoto(canvas: HTMLCanvasElement): Promise<AIAnalysisResult> {
  const localSuggestions = computeAutoEnhance(canvas);

  return {
    sceneSummary: 'Histogram & dynamic range analysis complete.',
    lightingDiagnosis: 'Exposure and contrast balanced via percentile luminance evaluation.',
    colorHarmony: 'White point and color balance estimated via gray-world statistics.',
    suggestedAdjustments: localSuggestions,
    confidence: 0.95,
  };
}

export interface AIStatus {
  configured: boolean;
  model: string;
  provider: string;
}

/**
 * Checks server-side Gemini AI readiness
 */
export async function checkAIStatus(): Promise<AIStatus> {
  try {
    const res = await fetch('/api/ai/status');
    if (!res.ok) throw new Error('Status check failed');
    return await res.json();
  } catch {
    return {
      configured: false,
      model: 'local-patch-engine',
      provider: 'Offline Local Engine',
    };
  }
}

export interface InpaintResult {
  success: boolean;
  image: string; // full resolution data URL
  method: 'gemini' | 'local';
  message: string;
}

/**
 * Performs watermark / object removal via Gemini API if configured,
 * or via local content-aware patch engine.
 * Truthfully reports errors without pretending an unconfigured model succeeded.
 */
export async function removeObjectOrWatermark(
  source: HTMLCanvasElement | HTMLImageElement,
  maskBitmap: number[],
  maskW: number,
  maskH: number,
  algorithm: 'ai' | 'local' = 'ai'
): Promise<InpaintResult> {
  const fullWidth = 'naturalWidth' in source ? source.naturalWidth || source.width : source.width;
  const fullHeight = 'naturalHeight' in source ? source.naturalHeight || source.height : source.height;

  // Render full-resolution base image onto offscreen canvas
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = fullWidth;
  fullCanvas.height = fullHeight;
  const fCtx = fullCanvas.getContext('2d', { willReadFrequently: true });
  if (!fCtx) {
    throw new Error('Canvas 2D context unavailable');
  }
  fCtx.drawImage(source, 0, 0, fullWidth, fullHeight);

  // 1. Remote AI Model (Google Gemini)
  if (algorithm === 'ai') {
    const status = await checkAIStatus();
    if (!status.configured) {
      return {
        success: false,
        image: '',
        method: 'gemini',
        message:
          'Gemini AI Inpainting requires an active GEMINI_API_KEY configured in server environment. Your selection has been preserved so you can configure the key, or switch to Manual Clone/Patch Retouch.',
      };
    }

    try {
      // Scale down image for API transport if extremely large (> 1600px)
      const maxApiDim = 1536;
      let apiWidth = fullWidth;
      let apiHeight = fullHeight;
      let scale = 1.0;

      if (Math.max(fullWidth, fullHeight) > maxApiDim) {
        scale = maxApiDim / Math.max(fullWidth, fullHeight);
        apiWidth = Math.round(fullWidth * scale);
        apiHeight = Math.round(fullHeight * scale);
      }

      const apiCanvas = document.createElement('canvas');
      apiCanvas.width = apiWidth;
      apiCanvas.height = apiHeight;
      const apiCtx = apiCanvas.getContext('2d');
      if (!apiCtx) throw new Error('API Canvas unavailable');
      apiCtx.drawImage(source, 0, 0, apiWidth, apiHeight);

      // Create aligned mask canvas
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = apiWidth;
      maskCanvas.height = apiHeight;
      const mCtx = maskCanvas.getContext('2d');
      if (!mCtx) throw new Error('Mask Canvas unavailable');

      const mImgData = mCtx.createImageData(apiWidth, apiHeight);
      const md = mImgData.data;
      const scaleX = maskW / apiWidth;
      const scaleY = maskH / apiHeight;

      for (let y = 0; y < apiHeight; y++) {
        const my = Math.min(maskH - 1, Math.floor(y * scaleY));
        for (let x = 0; x < apiWidth; x++) {
          const mx = Math.min(maskW - 1, Math.floor(x * scaleX));
          const val = maskBitmap[my * maskW + mx] || 0;
          const idx = (y * apiWidth + x) * 4;
          md[idx] = val;     // R
          md[idx + 1] = val; // G
          md[idx + 2] = val; // B
          md[idx + 3] = 255; // A
        }
      }
      mCtx.putImageData(mImgData, 0, 0);

      const imageDataUrl = apiCanvas.toDataURL('image/jpeg', 0.92);
      const maskDataUrl = maskCanvas.toDataURL('image/png');

      const response = await fetch('/api/ai/inpaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageDataUrl,
          mask: maskDataUrl,
          prompt:
            'Professional inpainting: remove the selected person or object indicated in the mask. Seamlessly reconstruct the background textures, grain, and lighting naturally.',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return {
          success: false,
          image: '',
          method: 'gemini',
          message: errData.message || 'AI Inpainting service error. Selection preserved.',
        };
      }

      const data = await response.json();
      if (!data.image) {
        return {
          success: false,
          image: '',
          method: 'gemini',
          message: 'AI provider did not return an inpainted image buffer. Selection preserved.',
        };
      }

      // Load returned inpainted image and composite strictly into the masked region
      const inpaintedImg = new Image();
      await new Promise<void>((resolve, reject) => {
        inpaintedImg.onload = () => resolve();
        inpaintedImg.onerror = () => reject(new Error('Failed to load inpainted image returned by AI'));
        inpaintedImg.src = data.image;
      });

      // Composite inpainted result onto fullCanvas strictly inside the mask
      const compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = fullWidth;
      compositeCanvas.height = fullHeight;
      const cCtx = compositeCanvas.getContext('2d');
      if (cCtx) {
        cCtx.drawImage(inpaintedImg, 0, 0, fullWidth, fullHeight);
        const compData = cCtx.getImageData(0, 0, fullWidth, fullHeight).data;
        const fullImgData = fCtx.getImageData(0, 0, fullWidth, fullHeight);
        const fd = fullImgData.data;

        const fScaleX = maskW / fullWidth;
        const fScaleY = maskH / fullHeight;

        for (let y = 0; y < fullHeight; y++) {
          const my = Math.min(maskH - 1, Math.floor(y * fScaleY));
          for (let x = 0; x < fullWidth; x++) {
            const mx = Math.min(maskW - 1, Math.floor(x * fScaleX));
            const maskAlpha = (maskBitmap[my * maskW + mx] || 0) / 255;
            if (maskAlpha > 0.01) {
              const pIdx = (y * fullWidth + x) * 4;
              fd[pIdx] = Math.round(fd[pIdx] * (1 - maskAlpha) + compData[pIdx] * maskAlpha);
              fd[pIdx + 1] = Math.round(fd[pIdx + 1] * (1 - maskAlpha) + compData[pIdx + 1] * maskAlpha);
              fd[pIdx + 2] = Math.round(fd[pIdx + 2] * (1 - maskAlpha) + compData[pIdx + 2] * maskAlpha);
            }
          }
        }
        fCtx.putImageData(fullImgData, 0, 0);
      }

      return {
        success: true,
        image: fullCanvas.toDataURL('image/jpeg', 0.98),
        method: 'gemini',
        message: 'Object / person removed seamlessly with Gemini 3.1 Flash Lite.',
      };
    } catch (err: any) {
      return {
        success: false,
        image: '',
        method: 'gemini',
        message: err.message || 'Error occurred during AI inpainting. Selection preserved.',
      };
    }
  }

  // 2. Manual Clone / Patch Retouch Engine (100% Offline)
  return removeObjectLocally(fullCanvas, maskBitmap, maskW, maskH);
}

/**
 * Runs 100% offline local content-aware patch removal on the image canvas
 */
export function removeObjectLocally(
  canvas: HTMLCanvasElement,
  maskBitmap: number[],
  maskW: number,
  maskH: number
): InpaintResult {
  const width = canvas.width;
  const height = canvas.height;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  ctx.drawImage(canvas, 0, 0);
  const srcImgData = ctx.getImageData(0, 0, width, height);

  // Resample maskBitmap to match canvas resolution
  let fullMask: number[];
  if (maskW === width && maskH === height) {
    fullMask = maskBitmap;
  } else {
    fullMask = new Array(width * height);
    const scaleX = maskW / width;
    const scaleY = maskH / height;
    for (let y = 0; y < height; y++) {
      const my = Math.min(maskH - 1, Math.floor(y * scaleY));
      for (let x = 0; x < width; x++) {
        const mx = Math.min(maskW - 1, Math.floor(x * scaleX));
        fullMask[y * width + x] = maskBitmap[my * maskW + mx] || 0;
      }
    }
  }

  const inpaintedImgData = inpaintLocally(srcImgData, fullMask);
  ctx.putImageData(inpaintedImgData, 0, 0);

  return {
    success: true,
    image: tempCanvas.toDataURL('image/jpeg', 0.98),
    method: 'local',
    message: 'Object removed using Manual Retouch (Local Content-Aware Patch Engine).',
  };
}
