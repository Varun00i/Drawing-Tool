/**
 * Image generation service using OpenRouter chat/completions API.
 * Uses sourceful/riverflow-v2-pro model with modalities: ["image"].
 * Returns base64 image data, cached locally for performance.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Difficulty, PROMPT_TEMPLATES } from '../types';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = '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';
const OPENROUTER_MODEL = 'sourceful/riverflow-v2-pro';

const CACHE_DIR = path.join(__dirname, '..', '..', 'generated-images', 'cache');

// Sketch-style suffix appended to every prompt
const SKETCH_SUFFIX = ', simple pencil sketch style, black and white line art on clean white background, not too complex, easy to draw by hand, minimal shading, clear outlines only';

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  cached: boolean;
}

function getPrompt(difficulty: Difficulty, seed?: number): string {
  const templates = PROMPT_TEMPLATES.find(t => t.difficulty === difficulty);
  if (!templates) throw new Error(`No templates for difficulty: ${difficulty}`);

  const index = seed !== undefined
    ? seed % templates.prompts.length
    : Math.floor(Math.random() * templates.prompts.length);

  return templates.prompts[index];
}

function getCacheKey(prompt: string): string {
  return crypto.createHash('md5').update(prompt).digest('hex');
}

function getCachedImage(cacheKey: string): string | null {
  const filePath = path.join(CACHE_DIR, `${cacheKey}.png`);
  if (fs.existsSync(filePath)) {
    return `/generated-images/cache/${cacheKey}.png`;
  }
  return null;
}

async function saveToCache(cacheKey: string, imageData: Buffer): Promise<string> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const filePath = path.join(CACHE_DIR, `${cacheKey}.png`);
  fs.writeFileSync(filePath, imageData);
  return `/generated-images/cache/${cacheKey}.png`;
}

/**
 * Generate a reference image via OpenRouter chat/completions API.
 * Uses modalities: ["image"] to get base64 image back.
 */
export async function generateReferenceImage(
  difficulty: Difficulty,
  seed?: number,
  customPrompt?: string
): Promise<GeneratedImage> {
  // Build prompt: user prompt or preset + sketch suffix
  const basePrompt = customPrompt
    ? customPrompt
    : getPrompt(difficulty, seed);
  const prompt = basePrompt + SKETCH_SUFFIX;

  const cacheKey = getCacheKey(prompt);
  const id = cacheKey;

  // Check cache first
  const cachedUrl = getCachedImage(cacheKey);
  if (cachedUrl) {
    console.log(`[ImageGen] Cache hit for: "${basePrompt.slice(0, 60)}"`);
    return { id, url: cachedUrl, prompt: basePrompt, cached: true };
  }

  // ── Call OpenRouter API ──
  console.log(`[ImageGen] Calling OpenRouter (${OPENROUTER_MODEL}): "${basePrompt.slice(0, 80)}"`);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://accuracy-sketch-ai.onrender.com',
        'X-Title': 'Accuracy Sketch AI',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        modalities: ['image'],
      }),
      signal: AbortSignal.timeout(60000), // 60s timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'no body');
      console.error(`[ImageGen] OpenRouter returned ${response.status}: ${errorText.slice(0, 500)}`);
      throw new Error(`OpenRouter API returned ${response.status}`);
    }

    const data = await response.json() as any;
    console.log(`[ImageGen] OpenRouter response received, parsing...`);

    // Extract base64 image from response
    // Format: choices[0].message.images[0].image_url.url = "data:image/png;base64,..."
    const images = data?.choices?.[0]?.message?.images;
    if (images && images.length > 0) {
      const dataUrl: string = images[0]?.image_url?.url || '';
      if (dataUrl.startsWith('data:image/')) {
        // Extract raw base64
        const base64Data = dataUrl.split(',')[1];
        if (base64Data) {
          const imgBuffer = Buffer.from(base64Data, 'base64');
          const localUrl = await saveToCache(cacheKey, imgBuffer);
          console.log(`[ImageGen] Success! Saved ${imgBuffer.length} bytes to cache`);
          return { id, url: localUrl, prompt: basePrompt, cached: false };
        }
      }
      // Might be a direct URL instead of data URI
      const directUrl: string = images[0]?.image_url?.url || '';
      if (directUrl.startsWith('http')) {
        const imgResp = await fetch(directUrl);
        const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
        const localUrl = await saveToCache(cacheKey, imgBuffer);
        console.log(`[ImageGen] Success from direct URL! Saved ${imgBuffer.length} bytes`);
        return { id, url: localUrl, prompt: basePrompt, cached: false };
      }
    }

    // Fallback: check if content itself contains base64
    const content = data?.choices?.[0]?.message?.content || '';
    if (content.startsWith('data:image/')) {
      const base64Data = content.split(',')[1];
      if (base64Data) {
        const imgBuffer = Buffer.from(base64Data, 'base64');
        const localUrl = await saveToCache(cacheKey, imgBuffer);
        console.log(`[ImageGen] Success from content field!`);
        return { id, url: localUrl, prompt: basePrompt, cached: false };
      }
    }

    console.error(`[ImageGen] Unexpected response structure:`, JSON.stringify(data).slice(0, 500));
    throw new Error('No image found in OpenRouter response');
  } catch (error: any) {
    console.error(`[ImageGen] OpenRouter failed:`, error.message || error);
    throw new Error(`Image generation failed: ${error.message}`);
  }
}
