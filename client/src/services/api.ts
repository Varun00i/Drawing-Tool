const API_BASE = import.meta.env.VITE_API_URL || '';

export async function generateImage(difficulty: string, seed?: number, prompt?: string) {
  const res = await fetch(`${API_BASE}/api/images/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ difficulty, seed, prompt }),
  });
  if (!res.ok) throw new Error('Failed to generate image');
  return res.json();
}

export async function getCuratedImages(difficulty: string) {
  const res = await fetch(`${API_BASE}/api/images/curated/${difficulty}`);
  if (!res.ok) throw new Error('Failed to get curated images');
  return res.json();
}

export async function submitSketchForScoring(
  sketchBase64: string,
  referenceUrl: string,
  difficulty: string
) {
  const res = await fetch(`${API_BASE}/api/scoring/compute-base64`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sketch: sketchBase64, referenceUrl, difficulty }),
  });
  if (!res.ok) throw new Error('Scoring request failed');
  return res.json();
}

export async function healthCheck() {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.json();
}
