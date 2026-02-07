/**
 * Scoring Engine – server-side accuracy computation.
 *
 * Pipeline:
 *   1. Normalize canvas sizes to 512×512 grayscale
 *   2. Extract binary edge maps (Sobel-like)
 *   3. Compute Contour Precision, Recall, and F1 score
 *   4. Compute Keypoint matching (corner detection)
 *   5. Compute Local similarity (patch SSIM-like)
 *   6. Apply ink density penalty (prevents all-black cheating)
 *   7. Weighted composite by difficulty
 *   8. Generate heatmap overlay
 */

import Jimp from 'jimp';
import path from 'path';
import fs from 'fs';
import { Difficulty, DIFFICULTY_WEIGHTS, ScoreBreakdown } from '../types';

const TARGET_SIZE = 512;

interface ScoringResult {
  score: number;
  breakdown: ScoreBreakdown;
  heatmapUrl: string;
  comparisonUrl: string;
  overlayUrl: string;
  referenceBase64: string;
  sketchBase64: string;
}

// ── Helpers ──

function toGrayscaleBuffer(image: Jimp): number[][] {
  const w = image.getWidth();
  const h = image.getHeight();
  const buf: number[][] = [];
  for (let y = 0; y < h; y++) {
    buf[y] = [];
    for (let x = 0; x < w; x++) {
      const { r, g, b } = Jimp.intToRGBA(image.getPixelColor(x, y));
      buf[y][x] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }
  return buf;
}

function sobelEdge(gray: number[][]): number[][] {
  const h = gray.length;
  const w = gray[0].length;
  const edges: number[][] = Array.from({ length: h }, () => new Array(w).fill(0));

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const gx =
        -gray[y - 1][x - 1] + gray[y - 1][x + 1] +
        -2 * gray[y][x - 1] + 2 * gray[y][x + 1] +
        -gray[y + 1][x - 1] + gray[y + 1][x + 1];
      const gy =
        -gray[y - 1][x - 1] - 2 * gray[y - 1][x] - gray[y - 1][x + 1] +
        gray[y + 1][x - 1] + 2 * gray[y + 1][x] + gray[y + 1][x + 1];
      edges[y][x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }
  return edges;
}

function binarize(data: number[][], threshold = 30): boolean[][] {
  return data.map(row => row.map(v => v > threshold));
}

/**
 * Compute precision, recall, and F1 score for edge matching.
 * Precision: how much of the sketch's edges match the reference (penalizes extra ink).
 * Recall: how much of the reference's edges are captured in the sketch.
 * F1: harmonic mean — balances both.
 */
function contourF1(refBin: boolean[][], sketchBin: boolean[][], tolerance = 3): {
  precision: number; recall: number; f1: number;
} {
  const h = refBin.length;
  const w = refBin[0].length;

  // Build distance transform for reference edges (for each pixel, nearest ref edge within tolerance)
  // Simplified: for each sketch edge pixel, check if any ref edge pixel is within tolerance
  let refEdgeCount = 0;
  let sketchEdgeCount = 0;
  let sketchMatchCount = 0;
  let refMatchCount = 0;

  // Collect ref edge positions for fast lookup
  const refEdgeSet = new Set<string>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (refBin[y][x]) {
        refEdgeCount++;
        refEdgeSet.add(`${x},${y}`);
      }
    }
  }

  // For each sketch edge, check if there's a ref edge nearby
  const matchedRef = new Set<string>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!sketchBin[y][x]) continue;
      sketchEdgeCount++;

      let found = false;
      for (let dy = -tolerance; dy <= tolerance && !found; dy++) {
        for (let dx = -tolerance; dx <= tolerance && !found; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w && refBin[ny][nx]) {
            found = true;
            matchedRef.add(`${nx},${ny}`);
          }
        }
      }
      if (found) sketchMatchCount++;
    }
  }

  refMatchCount = matchedRef.size;

  const precision = sketchEdgeCount === 0 ? 0 : sketchMatchCount / sketchEdgeCount;
  const recall = refEdgeCount === 0 ? 1 : refMatchCount / refEdgeCount;
  const f1 = (precision + recall) === 0 ? 0 : 2 * precision * recall / (precision + recall);

  return { precision, recall, f1 };
}

/**
 * Compute ink density penalty.
 * Penalizes sketches that have significantly more ink than the reference.
 * Also penalizes extraneous drawing in regions where the reference has nothing.
 */
function inkDensityPenalty(refGray: number[][], sketchGray: number[][]): number {
  const h = refGray.length;
  const w = refGray[0].length;
  const total = h * w;

  let refDark = 0;
  let sketchDark = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (refGray[y][x] < 200) refDark++;
      if (sketchGray[y][x] < 200) sketchDark++;
    }
  }

  const refRatio = refDark / total;
  const sketchRatio = sketchDark / total;

  // If sketch has only slightly more ink, no penalty
  if (sketchRatio <= refRatio * 1.2) return 1.0;

  // Harsh penalties for excessive coverage
  if (sketchRatio > 0.6) return 0.05;
  if (sketchRatio > 0.4) return 0.15;
  if (sketchRatio > 0.3) return 0.3;

  // Gradual penalty for excess ink
  const excessRatio = sketchRatio / Math.max(refRatio, 0.01);
  if (excessRatio > 5) return 0.15;
  if (excessRatio > 3) return 0.35;
  if (excessRatio > 2) return 0.55;
  return Math.max(0.4, 1 - (excessRatio - 1.2) * 0.4);
}

/**
 * Spatial extra-ink penalty: penalizes drawing in regions where reference has no content.
 * Divides the canvas into patches; for each patch where sketch has ink but reference doesn't,
 * applies a deduction.
 */
function spatialExtraPenalty(refGray: number[][], sketchGray: number[][], patchSize = 32): number {
  const h = refGray.length;
  const w = refGray[0].length;
  let totalPatches = 0;
  let extraPatches = 0;

  for (let y = 0; y + patchSize <= h; y += patchSize) {
    for (let x = 0; x + patchSize <= w; x += patchSize) {
      totalPatches++;
      let refInk = 0;
      let sketchInk = 0;
      const n = patchSize * patchSize;

      for (let dy = 0; dy < patchSize; dy++) {
        for (let dx = 0; dx < patchSize; dx++) {
          if (refGray[y + dy][x + dx] < 200) refInk++;
          if (sketchGray[y + dy][x + dx] < 200) sketchInk++;
        }
      }

      // If reference patch is mostly empty but sketch patch has significant ink
      const refInkRatio = refInk / n;
      const sketchInkRatio = sketchInk / n;
      if (refInkRatio < 0.02 && sketchInkRatio > 0.05) {
        extraPatches++;
      }
    }
  }

  if (totalPatches === 0) return 1.0;
  const extraRatio = extraPatches / totalPatches;
  // Penalize: up to 30% deduction for lots of extra drawing in empty areas
  return Math.max(0.7, 1 - extraRatio * 1.5);
}

// Simple corner detection (Harris-like response)
function detectKeypoints(gray: number[][], maxPoints = 200): Array<[number, number]> {
  const h = gray.length;
  const w = gray[0].length;
  const responses: Array<{ x: number; y: number; r: number }> = [];

  for (let y = 2; y < h - 2; y += 3) {
    for (let x = 2; x < w - 2; x += 3) {
      let Ixx = 0, Iyy = 0, Ixy = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ix = gray[y + dy][x + dx + 1] - gray[y + dy][x + dx - 1];
          const iy = gray[y + dy + 1][x + dx] - gray[y + dy - 1][x + dx];
          Ixx += ix * ix;
          Iyy += iy * iy;
          Ixy += ix * iy;
        }
      }
      const det = Ixx * Iyy - Ixy * Ixy;
      const trace = Ixx + Iyy;
      const r = det - 0.04 * trace * trace;
      if (r > 1000) {
        responses.push({ x, y, r });
      }
    }
  }

  responses.sort((a, b) => b.r - a.r);
  return responses.slice(0, maxPoints).map(p => [p.x, p.y]);
}

function keypointMatchScore(
  kpRef: Array<[number, number]>,
  kpSketch: Array<[number, number]>,
  size: number
): number {
  if (kpRef.length === 0) return 0.5;

  const maxDist = size * 0.05; // 5% tolerance
  let matched = 0;

  for (const [rx, ry] of kpRef) {
    let best = Infinity;
    for (const [sx, sy] of kpSketch) {
      const d = Math.sqrt((rx - sx) ** 2 + (ry - sy) ** 2);
      if (d < best) best = d;
    }
    if (best <= maxDist) matched++;
  }

  return kpRef.length === 0 ? 0 : matched / kpRef.length;
}

// Patch-based SSIM-like metric
function localSimilarity(refGray: number[][], sketchGray: number[][], patchSize = 16): number {
  const h = refGray.length;
  const w = refGray[0].length;
  let totalSim = 0;
  let count = 0;

  for (let y = 0; y + patchSize < h; y += patchSize) {
    for (let x = 0; x + patchSize < w; x += patchSize) {
      let meanR = 0, meanS = 0;
      const n = patchSize * patchSize;

      for (let dy = 0; dy < patchSize; dy++) {
        for (let dx = 0; dx < patchSize; dx++) {
          meanR += refGray[y + dy][x + dx];
          meanS += sketchGray[y + dy][x + dx];
        }
      }
      meanR /= n;
      meanS /= n;

      let varR = 0, varS = 0, cov = 0;
      for (let dy = 0; dy < patchSize; dy++) {
        for (let dx = 0; dx < patchSize; dx++) {
          const dr = refGray[y + dy][x + dx] - meanR;
          const ds = sketchGray[y + dy][x + dx] - meanS;
          varR += dr * dr;
          varS += ds * ds;
          cov += dr * ds;
        }
      }
      varR /= n;
      varS /= n;
      cov /= n;

      const C1 = 6.5025; // (0.01*255)^2
      const C2 = 58.5225; // (0.03*255)^2
      const ssim = ((2 * meanR * meanS + C1) * (2 * cov + C2)) /
                   ((meanR * meanR + meanS * meanS + C1) * (varR + varS + C2));

      totalSim += Math.max(0, ssim);
      count++;
    }
  }

  return count === 0 ? 0 : totalSim / count;
}

// Generate heatmap showing match/miss regions
async function generateHeatmap(
  refEdge: boolean[][],
  sketchEdge: boolean[][],
  outputPath: string
): Promise<void> {
  const h = refEdge.length;
  const w = refEdge[0].length;

  const img = new Jimp(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rVal = refEdge[y][x];
      const sVal = sketchEdge[y][x];

      if (rVal && sVal) {
        // Match – green
        img.setPixelColor(Jimp.rgbaToInt(0, 200, 80, 200), x, y);
      } else if (rVal && !sVal) {
        // Missed (in reference but not sketch) – red
        img.setPixelColor(Jimp.rgbaToInt(220, 40, 40, 180), x, y);
      } else if (!rVal && sVal) {
        // Extra (in sketch but not reference) – yellow
        img.setPixelColor(Jimp.rgbaToInt(240, 200, 40, 120), x, y);
      } else {
        // Both empty – transparent
        img.setPixelColor(Jimp.rgbaToInt(255, 255, 255, 0), x, y);
      }
    }
  }

  await img.writeAsync(outputPath);
}

// Generate side-by-side comparison
async function generateComparison(
  refPath: string,
  sketchPath: string,
  outputPath: string
): Promise<void> {
  const ref = (await Jimp.read(refPath)).resize(TARGET_SIZE, TARGET_SIZE);
  const sketch = (await Jimp.read(sketchPath)).resize(TARGET_SIZE, TARGET_SIZE);

  const combined = new Jimp(TARGET_SIZE * 2 + 20, TARGET_SIZE);
  combined.composite(ref, 0, 0);
  combined.composite(sketch, TARGET_SIZE + 20, 0);
  await combined.writeAsync(outputPath);
}

// Generate overlay comparison (sketch semi-transparent over reference)
async function generateOverlay(
  refPath: string,
  sketchPath: string,
  outputPath: string
): Promise<void> {
  const ref = (await Jimp.read(refPath)).resize(TARGET_SIZE, TARGET_SIZE);
  const sketch = (await Jimp.read(sketchPath)).resize(TARGET_SIZE, TARGET_SIZE).opacity(0.5);

  const combined = ref.clone();
  combined.composite(sketch, 0, 0);
  await combined.writeAsync(outputPath);
}

// ── Main scoring function ──

export async function computeScore(
  sketchPath: string,
  referencePath: string,
  difficulty: Difficulty
): Promise<ScoringResult> {
  // Resolve reference path
  let refAbsPath = referencePath;
  if (referencePath.startsWith('/')) {
    refAbsPath = path.join(__dirname, '..', '..', referencePath);
  }

  // If reference doesn't exist locally, create a placeholder score
  if (!fs.existsSync(refAbsPath)) {
    refAbsPath = sketchPath;
  }

  // Load and normalize images
  const refImg = (await Jimp.read(refAbsPath)).resize(TARGET_SIZE, TARGET_SIZE);
  const sketchImg = (await Jimp.read(sketchPath)).resize(TARGET_SIZE, TARGET_SIZE);

  // Convert to grayscale
  const refGray = toGrayscaleBuffer(refImg);
  const sketchGray = toGrayscaleBuffer(sketchImg);

  // Edge detection
  const refEdges = sobelEdge(refGray);
  const sketchEdges = sobelEdge(sketchGray);

  // Binarize edges
  const refBin = binarize(refEdges);
  const sketchBin = binarize(sketchEdges);

  // 1. Contour F1 (replaces IoU to prevent all-black cheating)
  const { f1: contourScore } = contourF1(refBin, sketchBin, 3);

  // 2. Keypoint matching
  const refKP = detectKeypoints(refGray);
  const sketchKP = detectKeypoints(sketchGray);
  const kpScore = keypointMatchScore(refKP, sketchKP, TARGET_SIZE);

  // 3. Local similarity
  const localScore = localSimilarity(refGray, sketchGray);

  // 4. Ink density penalty
  const inkPenalty = inkDensityPenalty(refGray, sketchGray);

  // 5. Spatial extra-ink penalty (penalizes drawing in empty areas)
  const spatialPenalty = spatialExtraPenalty(refGray, sketchGray);

  // 6. Composite with both penalties applied
  const weights = DIFFICULTY_WEIGHTS[difficulty];
  const rawComposite = (
    weights.contour * contourScore +
    weights.keypoints * kpScore +
    weights.local * localScore
  );

  const composite = rawComposite * inkPenalty * spatialPenalty;
  const percentage = Math.round(Math.min(100, composite * 100) * 100) / 100;

  // Generate output images
  const outputDir = path.join(__dirname, '..', '..', 'uploads', 'results');
  fs.mkdirSync(outputDir, { recursive: true });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const heatmapPath = path.join(outputDir, `heatmap-${id}.png`);
  const comparisonPath = path.join(outputDir, `comparison-${id}.png`);
  const overlayPath = path.join(outputDir, `overlay-${id}.png`);

  await generateHeatmap(refBin, sketchBin, heatmapPath);
  await generateComparison(refAbsPath, sketchPath, comparisonPath);
  await generateOverlay(refAbsPath, sketchPath, overlayPath);

  // Convert generated images to base64 data URIs for reliable delivery (no filesystem dependency)
  const heatmapBase64 = `data:image/png;base64,${fs.readFileSync(heatmapPath).toString('base64')}`;
  const comparisonBase64 = `data:image/png;base64,${fs.readFileSync(comparisonPath).toString('base64')}`;
  const overlayBase64 = `data:image/png;base64,${fs.readFileSync(overlayPath).toString('base64')}`;

  // Also provide separate reference and sketch as base64 for flicker mode
  const refBuffer = await refImg.getBufferAsync(Jimp.MIME_PNG);
  const sketchBuffer = await sketchImg.getBufferAsync(Jimp.MIME_PNG);
  const referenceBase64 = `data:image/png;base64,${refBuffer.toString('base64')}`;
  const sketchBase64 = `data:image/png;base64,${sketchBuffer.toString('base64')}`;

  // Clean up temp files (best effort)
  try { fs.unlinkSync(heatmapPath); } catch {}
  try { fs.unlinkSync(comparisonPath); } catch {}
  try { fs.unlinkSync(overlayPath); } catch {}

  return {
    score: percentage,
    breakdown: {
      contourIoU: Math.round(contourScore * 10000) / 100,
      keypointMatch: Math.round(kpScore * 10000) / 100,
      localSimilarity: Math.round(localScore * 10000) / 100,
      composite: percentage,
    },
    heatmapUrl: heatmapBase64,
    comparisonUrl: comparisonBase64,
    overlayUrl: overlayBase64,
    referenceBase64,
    sketchBase64,
  };
}
