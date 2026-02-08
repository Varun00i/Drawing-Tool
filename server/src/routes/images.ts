import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { generateReferenceImage } from '../services/openrouter';
import type { Difficulty } from '../types';

export const imageRouter = Router();

// POST /api/images/generate
// Body: { difficulty: string, seed?: number, prompt?: string }
imageRouter.post('/generate', async (req, res) => {
  try {
    const { difficulty, seed, prompt } = req.body;
    if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({ error: 'Invalid difficulty' });
    }

    const result = await generateReferenceImage(
      difficulty as Difficulty,
      seed,
      prompt || undefined
    );
    res.json(result);
  } catch (err: any) {
    console.error('Image generation error:', err);
    res.status(500).json({ error: 'Image generation failed', details: err.message });
  }
});

// GET /api/images/curated/:difficulty
