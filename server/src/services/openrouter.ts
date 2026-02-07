/**
 * OpenRouter Text-to-Image integration with caching.
 * Supports both preset difficulty-based prompts and custom user prompts.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Difficulty, PROMPT_TEMPLATES } from '../types';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/images/generations';
const CACHE_DIR = path.join(__dirname, '..', '..', 'generated-images', 'cache');

// Free/cheap models available on OpenRouter for image generation
const FREE_MODELS = [
  'stabilityai/stable-diffusion-xl-base-1.0',
  'black-forest-labs/flux-1-schnell',
];

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
 * Generate a reference image. Supports:
 * - Preset prompts by difficulty + seed
 * - Custom user prompts
 */
export async function generateReferenceImage(
  difficulty: Difficulty,
  seed?: number,
  customPrompt?: string
): Promise<GeneratedImage> {
  // Use custom prompt if provided, otherwise use preset templates
  const prompt = customPrompt
    ? `${customPrompt}, pencil sketch style, white background, clean line art, 1024x1024`
    : getPrompt(difficulty, seed);

  const cacheKey = getCacheKey(prompt);
  const id = cacheKey;

  // Check cache first
  const cachedUrl = getCachedImage(cacheKey);
  if (cachedUrl) {
    return { id, url: cachedUrl, prompt, cached: true };
  }

  // Call OpenRouter API
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    // Demo mode: generate a placeholder image using Jimp
    return generatePlaceholderImage(difficulty, prompt, cacheKey);
  }

  // Try each model in order until one works
  const models = [
    process.env.OPENROUTER_MODEL,
    ...FREE_MODELS,
  ].filter(Boolean) as string[];

  for (const model of models) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://accuracy-sketch-ai.app',
          'X-Title': 'Accuracy Sketch AI',
        },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          size: '1024x1024',
        }),
      });

      if (!response.ok) {
        console.warn(`OpenRouter model ${model} returned ${response.status}, trying next...`);
        continue;
      }

      const data = await response.json() as any;
      const imageUrl = data?.data?.[0]?.url;

      if (imageUrl) {
        const imgResponse = await fetch(imageUrl);
        const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
        const localUrl = await saveToCache(cacheKey, imgBuffer);
        return { id, url: localUrl, prompt, cached: false };
      }

      const b64 = data?.data?.[0]?.b64_json;
      if (b64) {
        const imgBuffer = Buffer.from(b64, 'base64');
        const localUrl = await saveToCache(cacheKey, imgBuffer);
        return { id, url: localUrl, prompt, cached: false };
      }
    } catch (error) {
      console.warn(`OpenRouter model ${model} failed:`, error);
      continue;
    }
  }

  // All models failed, use placeholder
  console.warn('All OpenRouter models failed, using placeholder');
  return generatePlaceholderImage(difficulty, prompt, cacheKey);
}

// Placeholder image for demo/dev mode
async function generatePlaceholderImage(
  difficulty: Difficulty,
  prompt: string,
  cacheKey: string
): Promise<GeneratedImage> {
  const Jimp = require('jimp');

  const size = 512;
  const img = new Jimp(size, size, 0xffffffff);
  const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);

  // Draw simple shapes based on difficulty
  if (difficulty === 'easy') {
    // Draw a circle (apple-like)
    const cx = size / 2, cy = size / 2, r = 120;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (Math.abs(d - r) < 3) {
          img.setPixelColor(Jimp.rgbaToInt(40, 40, 40, 255), x, y);
        }
      }
    }
    // Small stem
    for (let y = cy - r - 25; y < cy - r; y++) {
      for (let x = cx - 2; x <= cx + 2; x++) {
        if (y >= 0) img.setPixelColor(Jimp.rgbaToInt(40, 40, 40, 255), x, y);
      }
    }
  } else if (difficulty === 'medium') {
    // Draw a simple tree
    const cx = size / 2;
    // Trunk
    for (let y = size * 0.55; y < size * 0.85; y++) {
      for (let x = cx - 12; x < cx + 12; x++) {
        img.setPixelColor(Jimp.rgbaToInt(60, 40, 20, 255), Math.floor(x), Math.floor(y));
      }
    }
    // Canopy circle
    const cr = 100;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.sqrt((x - cx) ** 2 + (y - size * 0.38) ** 2);
        if (Math.abs(d - cr) < 3) {
          img.setPixelColor(Jimp.rgbaToInt(40, 40, 40, 255), x, y);
        }
      }
    }
  } else {
    // Hard: simple face outline
    const cx = size / 2, cy = size / 2;
    // Head oval
    for (let a = 0; a < Math.PI * 2; a += 0.002) {
      const x = Math.round(cx + 130 * Math.cos(a));
      const y = Math.round(cy + 170 * Math.sin(a));
      if (x >= 0 && x < size && y >= 0 && y < size) {
        img.setPixelColor(Jimp.rgbaToInt(40, 40, 40, 255), x, y);
      }
    }
    // Eyes
    for (const ex of [cx - 45, cx + 45]) {
      for (let a = 0; a < Math.PI * 2; a += 0.01) {
        const x = Math.round(ex + 18 * Math.cos(a));
        const y = Math.round((cy - 30) + 12 * Math.sin(a));
        if (x >= 0 && x < size && y >= 0 && y < size) {
          img.setPixelColor(Jimp.rgbaToInt(40, 40, 40, 255), x, y);
        }
      }
    }
    // Mouth
    for (let a = 0.2; a < Math.PI - 0.2; a += 0.01) {
      const x = Math.round(cx + 50 * Math.cos(a));
      const y = Math.round((cy + 60) + 20 * Math.sin(a));
      if (x >= 0 && x < size && y >= 0 && y < size) {
        img.setPixelColor(Jimp.rgbaToInt(40, 40, 40, 255), x, y);
      }
    }
  }

  img.print(font, 20, size - 40, `${difficulty.toUpperCase()} reference`);

  const buffer = await img.getBufferAsync(Jimp.MIME_PNG);
  const url = await saveToCache(cacheKey, buffer);

  return { id: cacheKey, url, prompt, cached: false };
}
