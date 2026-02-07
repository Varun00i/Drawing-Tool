/**
 * Image generation service using Pollinations.ai (free, no API key needed).
 * Falls back to Jimp placeholder if Pollinations is unreachable.
 * Supports both preset difficulty-based prompts and custom user prompts.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Difficulty, PROMPT_TEMPLATES } from '../types';

const CACHE_DIR = path.join(__dirname, '..', '..', 'generated-images', 'cache');

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
 * Generate a reference image using Pollinations.ai (free, no API key).
 * Supports:
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
    ? `${customPrompt}, pencil sketch style, white background, clean line art`
    : getPrompt(difficulty, seed);

  const cacheKey = getCacheKey(prompt);
  const id = cacheKey;

  // Check cache first
  const cachedUrl = getCachedImage(cacheKey);
  if (cachedUrl) {
    console.log(`[ImageGen] Cache hit for prompt: "${prompt.slice(0, 60)}..."`);
    return { id, url: cachedUrl, prompt, cached: true };
  }

  // ── Try Pollinations.ai (free, no API key) ──
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&seed=${Date.now()}`;

    console.log(`[ImageGen] Requesting from Pollinations.ai: "${prompt.slice(0, 60)}..."`);

    const response = await fetch(pollinationsUrl, {
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      // Verify we got an actual image (check for PNG/JPEG header)
      if (buffer.length > 1000 && (
        (buffer[0] === 0x89 && buffer[1] === 0x50) || // PNG
        (buffer[0] === 0xFF && buffer[1] === 0xD8)     // JPEG
      )) {
        const localUrl = await saveToCache(cacheKey, buffer);
        console.log(`[ImageGen] Success from Pollinations.ai, saved to cache`);
        return { id, url: localUrl, prompt, cached: false };
      } else {
        console.warn(`[ImageGen] Pollinations returned non-image data (${buffer.length} bytes)`);
      }
    } else {
      console.warn(`[ImageGen] Pollinations returned status ${response.status}`);
    }
  } catch (error: any) {
    console.warn(`[ImageGen] Pollinations.ai failed:`, error.message || error);
  }

  // ── Fallback: Jimp placeholder ──
  console.warn('[ImageGen] All sources failed, using placeholder');
  return generatePlaceholderImage(difficulty, prompt, cacheKey);
}

// Placeholder image for fallback mode
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
    const cx = size / 2, cy = size / 2, r = 120;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (Math.abs(d - r) < 3) {
          img.setPixelColor(Jimp.rgbaToInt(40, 40, 40, 255), x, y);
        }
      }
    }
    for (let y = cy - r - 25; y < cy - r; y++) {
      for (let x = cx - 2; x <= cx + 2; x++) {
        if (y >= 0) img.setPixelColor(Jimp.rgbaToInt(40, 40, 40, 255), x, y);
      }
    }
  } else if (difficulty === 'medium') {
    const cx = size / 2;
    for (let y = size * 0.55; y < size * 0.85; y++) {
      for (let x = cx - 12; x < cx + 12; x++) {
        img.setPixelColor(Jimp.rgbaToInt(60, 40, 20, 255), Math.floor(x), Math.floor(y));
      }
    }
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
    const cx = size / 2, cy = size / 2;
    for (let a = 0; a < Math.PI * 2; a += 0.002) {
      const x = Math.round(cx + 130 * Math.cos(a));
      const y = Math.round(cy + 170 * Math.sin(a));
      if (x >= 0 && x < size && y >= 0 && y < size) {
        img.setPixelColor(Jimp.rgbaToInt(40, 40, 40, 255), x, y);
      }
    }
    for (const ex of [cx - 45, cx + 45]) {
      for (let a = 0; a < Math.PI * 2; a += 0.01) {
        const x = Math.round(ex + 18 * Math.cos(a));
        const y = Math.round((cy - 30) + 12 * Math.sin(a));
        if (x >= 0 && x < size && y >= 0 && y < size) {
          img.setPixelColor(Jimp.rgbaToInt(40, 40, 40, 255), x, y);
        }
      }
    }
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
