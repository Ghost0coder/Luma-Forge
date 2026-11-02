import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '30mb' }));

// Serve MediaPipe assets locally with zero CDN dependency
app.use(
  '/mediapipe/selfie_segmentation',
  express.static(path.resolve(__dirname, 'node_modules/@mediapipe/selfie_segmentation'))
);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'LumaForge Backend',
    timestamp: Date.now(),
  });
});

// AI Configuration & Status endpoint
app.get('/api/ai/status', (_req, res) => {
  const isConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  res.json({
    configured: isConfigured,
    model: 'gemini-3.1-flash-lite-image',
    provider: 'Google Gemini',
  });
});

// Server-side Gemini AI inpainting endpoint for Watermark / Object removal
app.post('/api/ai/inpaint', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim().length === 0) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY_NOT_CONFIGURED',
      message: 'Gemini API key is not configured in server environment. Switching to high-fidelity offline local inpainting.',
    });
  }

  const { image, mask, prompt } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'IMAGE_REQUIRED', message: 'Base image is required for inpainting.' });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Helper to strip data URL prefix and determine mime type
    const parseDataUrl = (dataUrl: string, defaultMime = 'image/png') => {
      const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        return { mimeType: match[1], base64: match[2] };
      }
      return { mimeType: defaultMime, base64: dataUrl };
    };

    const parsedImage = parseDataUrl(image, 'image/jpeg');
    const parts: any[] = [
      {
        inlineData: {
          mimeType: parsedImage.mimeType,
          data: parsedImage.base64,
        },
      },
    ];

    if (mask) {
      const parsedMask = parseDataUrl(mask, 'image/png');
      parts.push({
        inlineData: {
          mimeType: parsedMask.mimeType,
          data: parsedMask.base64,
        },
      });
    }

    const defaultPrompt =
      'Professional photo editing: remove the object, watermark, blemish, or artifact indicated by the mask. Seamlessly inpaint and reconstruct the background textures, grain, lighting, and detail so no trace remains. Preserve original photography quality.';

    parts.push({
      text: prompt && prompt.trim().length > 0 ? prompt : defaultPrompt,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: { parts },
    });

    let resultImageUrl: string | null = null;
    let textResponse = '';

    const candidates = response.candidates;
    if (candidates && candidates.length > 0 && candidates[0].content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          resultImageUrl = `data:${mime};base64,${part.inlineData.data}`;
          break;
        } else if (part.text) {
          textResponse += part.text;
        }
      }
    }

    if (!resultImageUrl) {
      return res.status(502).json({
        error: 'NO_IMAGE_RETURNED',
        message: textResponse || 'AI model completed but did not return an updated image buffer.',
      });
    }

    return res.json({
      success: true,
      image: resultImageUrl,
      info: 'Image inpainted successfully with Gemini.',
    });
  } catch (err: any) {
    console.error('Error during Gemini inpaint call:', err);
    return res.status(500).json({
      error: 'INPAINT_ERROR',
      message: err.message || 'An error occurred during AI inpainting.',
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LumaForge professional photo editor running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
