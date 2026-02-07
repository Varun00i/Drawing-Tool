import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { computeScore } from '../scoring/engine';
import type { Difficulty } from '../types';

export const scoringRouter = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(__dirname, '..', '..', 'uploads', 'submissions');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// POST /api/scoring/compute
// Body: multipart with "sketch" file, "referenceUrl" field, "difficulty" field
scoringRouter.post('/compute', upload.single('sketch'), async (req, res) => {
  try {
    const { referenceUrl, difficulty } = req.body;
    const sketchFile = req.file;

    if (!sketchFile) {
      return res.status(400).json({ error: 'No sketch file uploaded' });
    }
    if (!referenceUrl) {
      return res.status(400).json({ error: 'No reference URL provided' });
    }

    const diff = (difficulty as Difficulty) || 'medium';
    const result = await computeScore(sketchFile.path, referenceUrl, diff);
    res.json(result);
  } catch (err: any) {
    console.error('Scoring error:', err);
    res.status(500).json({ error: 'Scoring failed', details: err.message });
  }
});

// POST /api/scoring/compute-base64
// Body JSON: { sketch: base64, referenceUrl: string, difficulty: string }
scoringRouter.post('/compute-base64', async (req, res) => {
  try {
    const { sketch, referenceUrl, difficulty } = req.body;
    if (!sketch || !referenceUrl) {
      return res.status(400).json({ error: 'Missing sketch or referenceUrl' });
    }

    // Save base64 to temp file
    const dir = path.join(__dirname, '..', '..', 'uploads', 'submissions');
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    const filepath = path.join(dir, filename);

    const base64Data = sketch.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));

    const diff = (difficulty as Difficulty) || 'medium';
    const result = await computeScore(filepath, referenceUrl, diff);
    res.json(result);
  } catch (err: any) {
    console.error('Scoring error:', err);
    res.status(500).json({ error: 'Scoring failed', details: err.message });
  }
});
