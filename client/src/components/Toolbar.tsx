import { useGameStore } from '../store';
import { useState, useRef } from 'react';
import type { DrawingTool } from '../types';
import {
  Pencil, Eraser, Undo2, Redo2, Trash2,
  Minus, Plus, Eye, EyeOff, Grid3x3,
  Minus as LineIcon, Square, Circle, PaintBucket,
} from 'lucide-react';

interface ToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const TOOL_CONFIG: { tool: DrawingTool; label: string; Icon: typeof Pencil }[] = [
  { tool: 'pencil', label: 'Pencil', Icon: Pencil },
  { tool: 'eraser', label: 'Eraser', Icon: Eraser },
  { tool: 'line', label: 'Line', Icon: LineIcon },
  { tool: 'rectangle', label: 'Rect', Icon: Square },
  { tool: 'circle', label: 'Circle', Icon: Circle },
  { tool: 'fill', label: 'Fill', Icon: PaintBucket },
];

const PRESET_COLORS = [
  '#1E1E1E', '#FF3B30', '#FF9500', '#FFCC00', '#34C759',
  '#007AFF', '#5856D6', '#AF52DE', '#8E8E93', '#FFFFFF',
];

export function Toolbar({ onUndo, onRedo, onClear, canUndo, canRedo }: ToolbarProps) {
  const {
    currentTool, setCurrentTool,
    brushSize, setBrushSize,
    brushColor, setBrushColor,
    opacity, setOpacity,
    referenceVisible, setReferenceVisible,
    gridVisible, setGridVisible,
    soloGrid,
  } = useGameStore();

  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const brushSizes = [1, 3, 5, 8, 12];

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white rounded-apple-lg border border-[#E5E5EA] shadow-apple">
      {/* Drawing Tools */}
      {TOOL_CONFIG.map(({ tool, label, Icon }) => (
        <button
          key={tool}
          onClick={() => setCurrentTool(tool)}
          className={`tool-btn ${currentTool === tool ? 'active' : ''}`}
          aria-label={`${label} tool`}
          title={label}
        >
          <Icon size={18} />
          <span className="text-[10px] mt-0.5 font-medium">{label}</span>
        </button>
      ))}

      {/* Divider */}
      <div className="w-px h-10 bg-[#E5E5EA] mx-1" />

      {/* Color Picker */}
      <div className="relative">
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="tool-btn !min-w-[56px] !min-h-[56px] flex flex-col items-center justify-center"
          aria-label="Color picker"
          title="Color"
        >
          <div
            className="w-6 h-6 rounded-full border-2 border-[#E5E5EA] shadow-sm"
            style={{ backgroundColor: brushColor }}
          />
          <span className="text-[10px] mt-0.5 font-medium">Color</span>
        </button>

        {showColorPicker && (
          <div className="absolute bottom-full left-0 mb-2 p-3 bg-white rounded-apple-lg border border-[#E5E5EA] shadow-apple-lg z-50 min-w-[180px]">
            <div className="grid grid-cols-5 gap-2 mb-3">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => { setBrushColor(color); setShowColorPicker(false); }}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    brushColor === color ? 'border-[#007AFF] scale-110' : 'border-[#E5E5EA]'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#86868B]">Custom:</label>
              <input
                ref={colorInputRef}
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-8 h-8 rounded border-0 cursor-pointer"
              />
              <span className="text-xs text-[#86868B] font-mono">{brushColor}</span>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-10 bg-[#E5E5EA] mx-1" />

      {/* Brush Size */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setBrushSize(Math.max(1, brushSize - 1))}
          className="tool-btn !min-w-[32px] !min-h-[32px]"
          aria-label="Decrease brush size"
        >
          <Minus size={14} />
        </button>
        <div className="flex items-center gap-1 px-1">
          {brushSizes.map((size) => (
            <button
              key={size}
              onClick={() => setBrushSize(size)}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all
                ${brushSize === size ? 'bg-[#007AFF]' : 'bg-[#F2F2F7] hover:bg-[#E5E5EA]'}`}
              aria-label={`Brush size ${size}`}
            >
              <div
                className={`rounded-full ${brushSize === size ? 'bg-white' : 'bg-[#1D1D1F]'}`}
                style={{ width: Math.max(3, size * 1.5), height: Math.max(3, size * 1.5) }}
              />
            </button>
          ))}
        </div>
        <button
          onClick={() => setBrushSize(Math.min(20, brushSize + 1))}
          className="tool-btn !min-w-[32px] !min-h-[32px]"
          aria-label="Increase brush size"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-10 bg-[#E5E5EA] mx-1" />

      {/* Opacity */}
      <div className="flex items-center gap-2 px-2">
        <span className="text-xs text-[#86868B] w-10">
          {Math.round(opacity * 100)}%
        </span>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          value={opacity}
          onChange={(e) => setOpacity(parseFloat(e.target.value))}
          className="w-20 h-1 accent-[#007AFF]"
          aria-label="Brush opacity"
        />
      </div>

      {/* Divider */}
      <div className="w-px h-10 bg-[#E5E5EA] mx-1" />

      {/* Undo / Redo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="tool-btn disabled:opacity-30"
        aria-label="Undo"
        title="Ctrl+Z"
      >
        <Undo2 size={18} />
        <span className="text-[10px] mt-0.5 font-medium">Undo</span>
      </button>

      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="tool-btn disabled:opacity-30"
        aria-label="Redo"
        title="Ctrl+Y"
      >
        <Redo2 size={18} />
        <span className="text-[10px] mt-0.5 font-medium">Redo</span>
      </button>

      {/* Clear */}
      <button
        onClick={onClear}
        className="tool-btn text-[#FF3B30] hover:bg-red-50"
        aria-label="Clear canvas"
        title="Clear"
      >
        <Trash2 size={18} />
        <span className="text-[10px] mt-0.5 font-medium">Clear</span>
      </button>

      {/* Divider */}
      <div className="w-px h-10 bg-[#E5E5EA] mx-1" />

      {/* Reference toggle */}
      <button
        onClick={() => setReferenceVisible(!referenceVisible)}
        className={`tool-btn ${referenceVisible ? '' : 'text-[#86868B]'}`}
        aria-label={referenceVisible ? 'Hide reference' : 'Show reference'}
        title="Toggle reference"
      >
        {referenceVisible ? <Eye size={18} /> : <EyeOff size={18} />}
        <span className="text-[10px] mt-0.5 font-medium">Ref</span>
      </button>

      {/* Grid toggle */}
      {soloGrid !== 'none' && (
        <button
          onClick={() => setGridVisible(!gridVisible)}
          className={`tool-btn ${gridVisible ? 'active' : ''}`}
          aria-label={gridVisible ? 'Hide grid' : 'Show grid'}
          title="Toggle grid"
        >
          <Grid3x3 size={18} />
          <span className="text-[10px] mt-0.5 font-medium">Grid</span>
        </button>
      )}
    </div>
  );
}
