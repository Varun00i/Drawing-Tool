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

export function useCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: CanvasOptions
) {
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const preShapeSnapshot = useRef<ImageData | null>(null);
  const stateRef = useRef<CanvasState>({ undoStack: [], redoStack: [] });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

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

  const getPoint = useCallback((e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, [canvasRef]);

  const getStrokeColor = useCallback(() => {
    const hex = options.brushColor;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${options.opacity})`;
  }, [options.brushColor, options.opacity]);

  const drawLine = useCallback((
    from: { x: number; y: number },
    to: { x: number; y: number }
  ) => {
    const ctx = getCtx();
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);

    if (options.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(255,255,255,1)';
      ctx.lineWidth = options.brushSize * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = getStrokeColor();
      ctx.lineWidth = options.brushSize;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
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

  const drawShapePreview = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
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

    if (options.tool === 'line' || options.tool === 'rectangle' || options.tool === 'circle') {
      preShapeSnapshot.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    } else {
      drawLine(point, point);
    }
  }, [getPoint, saveState, drawLine, floodFill, getCtx, canvasRef, options.tool]);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;

    const point = getPoint(e);
    if (!point) return;

    if (options.tool === 'line' || options.tool === 'rectangle' || options.tool === 'circle') {
      if (startPoint.current) {
        drawShapePreview(startPoint.current, point);
      }
    } else {
      if (lastPoint.current) {
        drawLine(lastPoint.current, point);
      }
      lastPoint.current = point;
    }
  }, [getPoint, drawLine, drawShapePreview, options.tool]);

  const stopDrawing = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;

    if ((options.tool === 'line' || options.tool === 'rectangle' || options.tool === 'circle') && startPoint.current) {
      const point = getPoint(e);
      if (point) {
        drawShapePreview(startPoint.current, point);
      }
    }

    isDrawing.current = false;
    lastPoint.current = null;
    startPoint.current = null;
    preShapeSnapshot.current = null;
  }, [getPoint, drawShapePreview, options.tool]);

  // Dynamic cursor
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (options.tool === 'eraser') {
      const size = Math.max(8, options.brushSize * 3);
      const half = (size + 4) / 2;
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size + 4}' height='${size + 4}'><circle cx='${half}' cy='${half}' r='${size / 2}' fill='white' stroke='%23999' stroke-width='1.5'/></svg>`;
      canvas.style.cursor = `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${half} ${half}, auto`;
    } else if (options.tool === 'fill') {
      canvas.style.cursor = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2'><path d='m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z'/><path d='m5 2 5 5'/><path d='M2 13h15'/><path d='M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z'/></svg>`)}") 2 22, auto`;
    } else if (options.tool === 'line' || options.tool === 'rectangle' || options.tool === 'circle') {
      canvas.style.cursor = 'crosshair';
    } else {
      // Pencil cursor - circle matching brush size
      const size = Math.max(6, options.brushSize + 2);
      const half = (size + 4) / 2;
      const color = encodeURIComponent(options.brushColor);
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size + 4}' height='${size + 4}'><circle cx='${half}' cy='${half}' r='${size / 2}' fill='${color}' opacity='0.7'/><circle cx='${half}' cy='${half}' r='${(size / 2) + 1}' fill='none' stroke='%23555' stroke-width='0.5'/></svg>`;
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
