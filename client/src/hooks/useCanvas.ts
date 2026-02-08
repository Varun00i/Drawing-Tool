import { useRef, useEffect, useCallback, useState } from 'react';
import type { DrawingTool } from '../types';

interface CanvasOptions {
  tool: DrawingTool;
  brushSize: number;
  brushColor: string;
  opacity: number;
}

interface CanvasState {
  undoStack: ImageData[];
  redoStack: ImageData[];
}

interface Point {
  x: number;
  y: number;
  time: number;
}

// ── Velocity-based dynamic width ──
// Maps stroke velocity to a width multiplier for natural pen feel.
// Slow strokes → full width, fast strokes → thinner (down to 40%).
function velocityWidth(baseSize: number, prev: Point, curr: Point): number {
  const dx = curr.x - prev.x;
  const dy = curr.y - prev.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const dt = Math.max(1, curr.time - prev.time);
  const velocity = dist / dt; // px/ms

  // Map velocity to multiplier: 0 velocity → 1.15x, high velocity → 0.4x
  const factor = Math.max(0.4, Math.min(1.15, 1.15 - velocity * 0.12));
  return baseSize * factor;
}

/**
 * Professional drawing hook with:
 * - Continuous line rendering (no gaps even at high speed)
 * - Velocity-based dynamic stroke width
 * - Quadratic Bezier smoothing for curves
 * - Proper anti-aliasing
 */
export function useCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: CanvasOptions
) {
  const isDrawing = useRef(false);
  const lastPoint = useRef<Point | null>(null);
  const startPoint = useRef<Point | null>(null);
  const preShapeSnapshot = useRef<ImageData | null>(null);
  const stateRef = useRef<CanvasState>({ undoStack: [], redoStack: [] });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // For smooth quadratic Bezier: track the last 3 points
  const prevPrevPoint = useRef<Point | null>(null);
  // Track last rendered width for smooth transitions
  const lastWidth = useRef<number>(0);

  const getCtx = useCallback(() => {
    return canvasRef.current?.getContext('2d') ?? null;
  }, [canvasRef]);

  const saveState = useCallback(() => {
    const ctx = getCtx();
    if (!ctx || !canvasRef.current) return;
    const data = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    stateRef.current.undoStack.push(data);
    if (stateRef.current.undoStack.length > 50) {
      stateRef.current.undoStack.shift();
    }
    stateRef.current.redoStack = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [getCtx, canvasRef]);

  const undo = useCallback(() => {
    const ctx = getCtx();
    if (!ctx || !canvasRef.current || stateRef.current.undoStack.length === 0) return;

    const current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    stateRef.current.redoStack.push(current);

    const prev = stateRef.current.undoStack.pop()!;
    ctx.putImageData(prev, 0, 0);

    setCanUndo(stateRef.current.undoStack.length > 0);
    setCanRedo(true);
  }, [getCtx, canvasRef]);

  const redo = useCallback(() => {
    const ctx = getCtx();
    if (!ctx || !canvasRef.current || stateRef.current.redoStack.length === 0) return;

    const current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    stateRef.current.undoStack.push(current);

    const next = stateRef.current.redoStack.pop()!;
    ctx.putImageData(next, 0, 0);

    setCanUndo(true);
    setCanRedo(stateRef.current.redoStack.length > 0);
  }, [getCtx, canvasRef]);

  const clearCanvas = useCallback(() => {
    const ctx = getCtx();
    if (!ctx || !canvasRef.current) return;
    saveState();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, [getCtx, canvasRef, saveState]);

  const getPoint = useCallback((e: MouseEvent | TouchEvent): Point | null => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
        time: Date.now(),
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      time: Date.now(),
    };
  }, [canvasRef]);

  const getStrokeColor = useCallback(() => {
    const hex = options.brushColor;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${options.opacity})`;
  }, [options.brushColor, options.opacity]);

  /**
   * Core drawing function: draws a smooth segment from prev→curr point.
   * Uses quadratic Bezier curves when 3+ points are available.
   * Applies velocity-based dynamic width for natural pen feel.
   */
  const drawSegment = useCallback((prev: Point, curr: Point, prevPrev: Point | null) => {
    const ctx = getCtx();
    if (!ctx) return;

    const isEraser = options.tool === 'eraser';
    const baseSize = isEraser ? options.brushSize * 3 : options.brushSize;

    // Calculate dynamic width from velocity
    const targetWidth = velocityWidth(baseSize, prev, curr);
    // Smooth width transitions (lerp toward target)
    const smoothedWidth = lastWidth.current === 0
      ? targetWidth
      : lastWidth.current * 0.6 + targetWidth * 0.4;
    lastWidth.current = smoothedWidth;

    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = smoothedWidth;

    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(255,255,255,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = getStrokeColor();
    }

    if (prevPrev) {
      // Quadratic Bezier: use the previous point as control point,
      // draw from midpoint(prevPrev, prev) to midpoint(prev, curr)
      const mid0x = (prevPrev.x + prev.x) / 2;
      const mid0y = (prevPrev.y + prev.y) / 2;
      const mid1x = (prev.x + curr.x) / 2;
      const mid1y = (prev.y + curr.y) / 2;

      ctx.moveTo(mid0x, mid0y);
      ctx.quadraticCurveTo(prev.x, prev.y, mid1x, mid1y);
    } else {
      // Only 2 points: simple line
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
    }

    ctx.stroke();
  }, [getCtx, options.tool, options.brushSize, getStrokeColor]);

  const floodFill = useCallback((startX: number, startY: number) => {
    const ctx = getCtx();
    if (!ctx || !canvasRef.current) return;

    const w = canvasRef.current.width;
    const h = canvasRef.current.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    const sx = Math.floor(startX);
    const sy = Math.floor(startY);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;

    const idx = (sy * w + sx) * 4;
    const targetR = data[idx];
    const targetG = data[idx + 1];
    const targetB = data[idx + 2];
    const targetA = data[idx + 3];

    const hex = options.brushColor;
    const fillR = parseInt(hex.slice(1, 3), 16);
    const fillG = parseInt(hex.slice(3, 5), 16);
    const fillB = parseInt(hex.slice(5, 7), 16);
    const fillA = Math.round(options.opacity * 255);

    if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) return;

    const tolerance = 30;
    const matches = (i: number) => {
      return Math.abs(data[i] - targetR) <= tolerance &&
             Math.abs(data[i + 1] - targetG) <= tolerance &&
             Math.abs(data[i + 2] - targetB) <= tolerance &&
             Math.abs(data[i + 3] - targetA) <= tolerance;
    };

    const stack: number[] = [sx, sy];
    const visited = new Uint8Array(w * h);

    while (stack.length > 0) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      const key = y * w + x;

      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (visited[key]) continue;

      const pi = key * 4;
      if (!matches(pi)) continue;

      visited[key] = 1;
      data[pi] = fillR;
      data[pi + 1] = fillG;
      data[pi + 2] = fillB;
      data[pi + 3] = fillA;

      stack.push(x + 1, y);
      stack.push(x - 1, y);
      stack.push(x, y + 1);
      stack.push(x, y - 1);
    }

    ctx.putImageData(imageData, 0, 0);
  }, [getCtx, canvasRef, options.brushColor, options.opacity]);

  const drawShapePreview = useCallback((from: Point, to: Point) => {
    const ctx = getCtx();
    if (!ctx || !canvasRef.current || !preShapeSnapshot.current) return;

    ctx.putImageData(preShapeSnapshot.current, 0, 0);

    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = getStrokeColor();
    ctx.lineWidth = options.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    if (options.tool === 'line') {
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
    } else if (options.tool === 'rectangle') {
      const w = to.x - from.x;
      const h = to.y - from.y;
      ctx.rect(from.x, from.y, w, h);
    } else if (options.tool === 'circle') {
      const rx = Math.abs(to.x - from.x) / 2;
      const ry = Math.abs(to.y - from.y) / 2;
      const cx = (from.x + to.x) / 2;
      const cy = (from.y + to.y) / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    }

    ctx.stroke();
  }, [getCtx, canvasRef, options.tool, options.brushSize, getStrokeColor]);

  const startDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    const point = getPoint(e);
    if (!point) return;

    const ctx = getCtx();
    if (!ctx || !canvasRef.current) return;

    saveState();

    if (options.tool === 'fill') {
      floodFill(point.x, point.y);
      return;
    }

    isDrawing.current = true;
    lastPoint.current = point;
    startPoint.current = point;
    prevPrevPoint.current = null;
    lastWidth.current = 0;

    if (options.tool === 'line' || options.tool === 'rectangle' || options.tool === 'circle') {
      preShapeSnapshot.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    } else {
      // Draw a dot at the start point for single click/tap
      const isEraser = options.tool === 'eraser';
      ctx.beginPath();
      if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(255,255,255,1)';
        ctx.arc(point.x, point.y, (options.brushSize * 3) / 2, 0, Math.PI * 2);
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = getStrokeColor();
        ctx.arc(point.x, point.y, options.brushSize / 2, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }, [getPoint, saveState, floodFill, getCtx, canvasRef, options.tool, options.brushSize, getStrokeColor]);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;

    const point = getPoint(e);
    if (!point || !lastPoint.current) return;

    if (options.tool === 'line' || options.tool === 'rectangle' || options.tool === 'circle') {
      if (startPoint.current) {
        drawShapePreview(startPoint.current, point);
      }
      return;
    }

    // ── Freehand drawing ──
    // Skip if the mouse hasn't moved enough (prevents jitter)
    const dx = point.x - lastPoint.current.x;
    const dy = point.y - lastPoint.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1.5) return;

    // Draw smooth segment with velocity-based width
    drawSegment(lastPoint.current, point, prevPrevPoint.current);

    // Shift point history
    prevPrevPoint.current = lastPoint.current;
    lastPoint.current = point;
  }, [getPoint, drawShapePreview, drawSegment, options.tool]);

  const stopDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;

    if ((options.tool === 'line' || options.tool === 'rectangle' || options.tool === 'circle') && startPoint.current) {
      const point = getPoint(e);
      if (point) {
        drawShapePreview(startPoint.current, point);
      }
    } else if (lastPoint.current && prevPrevPoint.current) {
      // Draw final segment to the endpoint to close cleanly
      const point = getPoint(e);
      if (point) {
        drawSegment(lastPoint.current, point, prevPrevPoint.current);
      }
    }

    isDrawing.current = false;
    lastPoint.current = null;
    startPoint.current = null;
    prevPrevPoint.current = null;
    preShapeSnapshot.current = null;
    lastWidth.current = 0;
  }, [getPoint, drawShapePreview, drawSegment, options.tool]);

  // Dynamic cursor
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isLight = (hex: string): boolean => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.7;
    };

    if (options.tool === 'eraser') {
      const size = Math.max(8, options.brushSize * 3);
      const svgSize = size + 6;
      const half = svgSize / 2;
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${svgSize}' height='${svgSize}'><circle cx='${half}' cy='${half}' r='${size / 2}' fill='white' stroke='%23666' stroke-width='1.5'/><line x1='${half - 3}' y1='${half}' x2='${half + 3}' y2='${half}' stroke='%23999' stroke-width='1'/><line x1='${half}' y1='${half - 3}' x2='${half}' y2='${half + 3}' stroke='%23999' stroke-width='1'/></svg>`;
      canvas.style.cursor = `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${half} ${half}, auto`;
    } else if (options.tool === 'fill') {
      canvas.style.cursor = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2'><path d='m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z'/><path d='m5 2 5 5'/><path d='M2 13h15'/><path d='M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z'/></svg>`)}") 2 22, auto`;
    } else if (options.tool === 'line' || options.tool === 'rectangle' || options.tool === 'circle') {
      canvas.style.cursor = 'crosshair';
    } else {
      const size = Math.max(6, options.brushSize + 2);
      const svgSize = size + 6;
      const half = svgSize / 2;
      const r = size / 2;
      const color = encodeURIComponent(options.brushColor);
      const outlineColor = isLight(options.brushColor) ? '%23333' : '%23DDD';
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${svgSize}' height='${svgSize}'><circle cx='${half}' cy='${half}' r='${r + 1.5}' fill='none' stroke='${outlineColor}' stroke-width='1'/><circle cx='${half}' cy='${half}' r='${r}' fill='${color}' opacity='0.85'/></svg>`;
      canvas.style.cursor = `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${half} ${half}, crosshair`;
    }
  }, [canvasRef, options.tool, options.brushSize, options.brushColor]);

  // Attach event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [canvasRef, startDrawing, draw, stopDrawing]);

  // Initialize canvas with white background
  useEffect(() => {
    const ctx = getCtx();
    if (!ctx || !canvasRef.current) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, [getCtx, canvasRef]);

  const getImageData = useCallback((): string => {
    return canvasRef.current?.toDataURL('image/png') || '';
  }, [canvasRef]);

  return { undo, redo, clearCanvas, canUndo, canRedo, getImageData };
}
