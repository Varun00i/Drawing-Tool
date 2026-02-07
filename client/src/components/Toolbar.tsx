import { useGameStore } from '../store';
import { useState, useRef, useEffect } from 'react';
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
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const colorBtnRef = useRef<HTMLButtonElement>(null);

  // Close color picker when clicking outside
  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e: MouseEvent) => {
      if (
        colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node) &&
        colorBtnRef.current && !colorBtnRef.current.contains(e.target as Node)
      ) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColorPicker]);

  const brushSizes = [1, 3, 5, 8, 12];

  return (
    <div className="toolbar-container">
      {/* Row 1: Drawing Tools + Color */}
      <div className="flex items-center gap-1 flex-wrap">
        {TOOL_CONFIG.map(({ tool, label, Icon }) => (
          <button
            key={tool}
            onClick={() => setCurrentTool(tool)}
            className={`toolbar-btn ${currentTool === tool ? 'active' : ''}`}
            aria-label={`${label} tool`}
            title={label}
          >
            <Icon size={16} />
            <span className="toolbar-label">{label}</span>
          </button>
        ))}

        {/* Color Picker */}
        <div className="relative">
          <button
            ref={colorBtnRef}
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="toolbar-btn"
            aria-label="Color picker"
            title="Color"
          >
            <div
              className="w-5 h-5 rounded-full border-2 border-[#E5E5EA] shadow-sm"
              style={{ backgroundColor: brushColor }}
            />
            <span className="toolbar-label">Color</span>
          </button>

          {showColorPicker && (
            <div
              ref={colorPickerRef}
              className="fixed sm:absolute z-[100] p-3 bg-white rounded-xl border border-[#E5E5EA] shadow-2xl"
              style={{
                // On mobile: center on screen; on desktop: position near button
                ...(window.innerWidth < 640
                  ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
                  : { bottom: '100%', left: '0', marginBottom: '8px' }
                ),
              }}
            >
              <div className="grid grid-cols-5 gap-2 mb-3">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => { setBrushColor(color); setShowColorPicker(false); }}
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      brushColor === color ? 'border-[#007AFF] scale-110 ring-2 ring-[#007AFF]/30' : 'border-[#E5E5EA]'
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
      </div>

      {/* Row 2: Brush Size + Opacity + Actions */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* Brush Size */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setBrushSize(Math.max(1, brushSize - 1))}
            className="toolbar-btn-sm"
            aria-label="Decrease brush size"
          >
            <Minus size={12} />
          </button>
          <div className="flex items-center gap-0.5 px-0.5">
            {brushSizes.map((size) => (
              <button
                key={size}
                onClick={() => setBrushSize(size)}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all
                  ${brushSize === size ? 'bg-[#007AFF]' : 'bg-[#F2F2F7] hover:bg-[#E5E5EA]'}`}
                aria-label={`Brush size ${size}`}
              >
                <div
                  className={`rounded-full ${brushSize === size ? 'bg-white' : 'bg-[#1D1D1F]'}`}
                  style={{ width: Math.max(3, size * 1.2), height: Math.max(3, size * 1.2) }}
                />
              </button>
            ))}
          </div>
          <button
            onClick={() => setBrushSize(Math.min(20, brushSize + 1))}
            className="toolbar-btn-sm"
            aria-label="Increase brush size"
          >
            <Plus size={12} />
          </button>
        </div>

        <div className="w-px h-6 bg-[#E5E5EA] mx-0.5 hidden sm:block" />

        {/* Opacity */}
        <div className="flex items-center gap-1 px-1">
          <span className="text-[10px] text-[#86868B] w-8 text-center">
            {Math.round(opacity * 100)}%
          </span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="w-16 h-1 accent-[#007AFF]"
            aria-label="Brush opacity"
          />
        </div>

        <div className="w-px h-6 bg-[#E5E5EA] mx-0.5 hidden sm:block" />

        {/* Undo / Redo / Clear */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="toolbar-btn-sm disabled:opacity-30"
            aria-label="Undo"
            title="Ctrl+Z"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="toolbar-btn-sm disabled:opacity-30"
            aria-label="Redo"
            title="Ctrl+Y"
          >
            <Redo2 size={14} />
          </button>
          <button
            onClick={onClear}
            className="toolbar-btn-sm text-[#FF3B30] hover:bg-red-50"
            aria-label="Clear canvas"
            title="Clear"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <div className="w-px h-6 bg-[#E5E5EA] mx-0.5 hidden sm:block" />

        {/* Toggles */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setReferenceVisible(!referenceVisible)}
            className={`toolbar-btn-sm ${referenceVisible ? '' : 'text-[#86868B]'}`}
            aria-label={referenceVisible ? 'Hide reference' : 'Show reference'}
            title="Toggle reference"
          >
            {referenceVisible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>

          {soloGrid !== 'none' && (
            <button
              onClick={() => setGridVisible(!gridVisible)}
              className={`toolbar-btn-sm ${gridVisible ? 'active' : ''}`}
              aria-label={gridVisible ? 'Hide grid' : 'Show grid'}
              title="Toggle grid"
            >
              <Grid3x3 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
