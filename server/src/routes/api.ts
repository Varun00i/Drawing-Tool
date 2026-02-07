import { Router } from 'express';

export const apiRouter = Router();

// ── Curated reference packs ──
const CURATED_REFS = {
  easy: [
    { id: 'easy-1', name: 'Apple', url: '/generated-images/curated/easy-apple.png' },
    { id: 'easy-2', name: 'Star', url: '/generated-images/curated/easy-star.png' },
    { id: 'easy-3', name: 'Cup', url: '/generated-images/curated/easy-cup.png' },
  ],
  medium: [
    { id: 'med-1', name: 'Oak Tree', url: '/generated-images/curated/medium-tree.png' },
    { id: 'med-2', name: 'Bicycle', url: '/generated-images/curated/medium-bicycle.png' },
    { id: 'med-3', name: 'Guitar', url: '/generated-images/curated/medium-guitar.png' },
  ],
  hard: [
    { id: 'hard-1', name: 'Portrait', url: '/generated-images/curated/hard-portrait.png' },
    { id: 'hard-2', name: 'Cat', url: '/generated-images/curated/hard-cat.png' },
    { id: 'hard-3', name: 'Rose', url: '/generated-images/curated/hard-rose.png' },
  ],
};

apiRouter.get('/references/:difficulty', (req, res) => {
  const { difficulty } = req.params;
  if (difficulty !== 'easy' && difficulty !== 'medium' && difficulty !== 'hard') {
    return res.status(400).json({ error: 'Invalid difficulty' });
  }
  res.json(CURATED_REFS[difficulty]);
});

apiRouter.get('/difficulties', (_req, res) => {
  res.json([
    { id: 'easy', label: 'Easy', description: 'Simple shapes and silhouettes' },
    { id: 'medium', label: 'Medium', description: 'Moderate detail objects' },
    { id: 'hard', label: 'Hard', description: 'Fine detail portraits and animals' },
  ]);
});
