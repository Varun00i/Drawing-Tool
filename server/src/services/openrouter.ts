/**
 * Image generation service using Pollinations.ai (free, no API key).
 * Generates sketch-style reference images for the drawing game.
 * Falls back gracefully with retries.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { Difficulty, PROMPT_TEMPLATES } from '../types';

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
  // Always convert to PNG for consistent format (Jimp compatibility)
  const pngBuffer = await sharp(imageData).png().toBuffer();
  const filePath = path.join(CACHE_DIR, `${cacheKey}.png`);
  fs.writeFileSync(filePath, pngBuffer);
  return `/generated-images/cache/${cacheKey}.png`;
}

/**
 * Generate a reference image via Pollinations.ai (free, no API key needed).
 * Uses the flux model for high-quality image generation.
 */
export async function generateReferenceImage(
  difficulty: Difficulty,
  seed?: number,
  customPrompt?: string
): Promise<GeneratedImage> {
  // Build prompt
  const basePrompt = customPrompt || getPrompt(difficulty, seed);
  const prompt = basePrompt + SKETCH_SUFFIX;

  const cacheKey = getCacheKey(prompt);
  const id = cacheKey;

  // Check cache
  const cachedUrl = getCachedImage(cacheKey);
  if (cachedUrl) {
    console.log(`[ImageGen] Cache hit for: "${basePrompt.slice(0, 60)}"`);
    return { id, url: cachedUrl, prompt: basePrompt, cached: true };
  }

  // ── Pollinations.ai (free, no key required) ──
  const pollinationsSeed = Math.floor(Math.random() * 999999);
  const encodedPrompt = encodeURIComponent(prompt);
  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&seed=${pollinationsSeed}&model=flux`;

  console.log(`[ImageGen] Calling Pollinations.ai: "${basePrompt.slice(0, 80)}"`);

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(pollinationsUrl, {
        signal: AbortSignal.timeout(60000), // 60s timeout
        headers: {
          'Accept': 'image/*',
          'User-Agent': 'AccuracySketchAI/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Pollinations returned ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('image')) {
        throw new Error(`Unexpected content-type: ${contentType}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const imgBuffer = Buffer.from(arrayBuffer);

      if (imgBuffer.length < 1000) {
        throw new Error(`Image too small (${imgBuffer.length} bytes), likely an error`);
      }

      // Save to cache (converts to PNG automatically via Sharp)
      const localUrl = await saveToCache(cacheKey, imgBuffer);
      console.log(`[ImageGen] Success! Saved ${imgBuffer.length} bytes to cache (attempt ${attempt})`);
      return { id, url: localUrl, prompt: basePrompt, cached: false };

    } catch (error: any) {
      lastError = error;
      console.warn(`[ImageGen] Attempt ${attempt}/${maxRetries} failed:`, error.message);

      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }

  console.error(`[ImageGen] All ${maxRetries} attempts failed`);
  throw new Error(`Image generation failed after ${maxRetries} attempts: ${lastError?.message}`);
}
