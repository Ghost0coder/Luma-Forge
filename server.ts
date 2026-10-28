import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parser for JSON (images are downsampled to small previews before sending to API)
app.use(express.json({ limit: '15mb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'LumaForge Backend',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: Date.now(),
  });
});

// AI Photographic Analysis & Enhancement Endpoint
app.post('/api/ai/analyze-photo', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'Gemini API Key not configured',
        fallback: true,
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Clean base64 string if it contains data URI prefix
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `You are a master digital photography colorist and Lightroom development expert for LumaForge.
Analyze this photograph meticulously and provide expert photographic guidance and optimal non-destructive development parameters.

Evaluate:
1. Scene composition and subject matter.
2. Exposure balance, histogram distribution, and dynamic range (highlight recovery vs shadow details).
3. White balance, color temperature cast, and chromatic harmony.
4. Optimal development parameters to make this photograph look breathtaking, natural, and professionally graded.

Return exact numeric adjustment values suitable for Lightroom/LumaForge:
- exposure: float from -2.0 to +2.0 (0 is neutral)
- contrast: integer from -50 to +50 (0 is neutral)
- highlights: integer from -100 to +100 (-30 means recover highlights)
- shadows: integer from -100 to +100 (+25 means open up shadows)
- whites: integer from -50 to +50
- blacks: integer from -50 to +50
- temperature: integer from -40 to +40 (negative is cool, positive is warm)
- tint: integer from -30 to +30 (negative is green, positive is magenta)
- vibrance: integer from -30 to +50
- clarity: integer from -20 to +40
- sharpening: integer from 0 to 50`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sceneSummary: {
              type: Type.STRING,
              description: 'Concise 1-sentence summary of the subject and photographic style.',
            },
            lightingDiagnosis: {
              type: Type.STRING,
              description: 'Expert critique of the lighting, exposure distribution, and tonal dynamic range.',
            },
            colorHarmony: {
              type: Type.STRING,
              description: 'Critique of color temperature, skin tones, and palette balance.',
            },
            suggestedAdjustments: {
              type: Type.OBJECT,
              properties: {
                exposure: { type: Type.NUMBER },
                contrast: { type: Type.INTEGER },
                highlights: { type: Type.INTEGER },
                shadows: { type: Type.INTEGER },
                whites: { type: Type.INTEGER },
                blacks: { type: Type.INTEGER },
                temperature: { type: Type.INTEGER },
                tint: { type: Type.INTEGER },
                vibrance: { type: Type.INTEGER },
                clarity: { type: Type.INTEGER },
                sharpening: { type: Type.INTEGER },
              },
              required: ['exposure', 'contrast', 'highlights', 'shadows'],
            },
            confidence: {
              type: Type.NUMBER,
              description: 'Confidence score between 0.8 and 1.0',
            },
          },
          required: ['sceneSummary', 'lightingDiagnosis', 'colorHarmony', 'suggestedAdjustments'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response received from Gemini');
    }

    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (error: any) {
    console.error('Gemini photographic analysis failed:', error);
    return res.status(500).json({
      error: error?.message || 'AI photo analysis error',
      fallback: true,
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // Vite middleware for lightning fast development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving
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
