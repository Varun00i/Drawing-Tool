import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Minimize2, Move } from 'lucide-react';
import { GridOverlay } from './GridOverlay';

interface FloatingReferenceProps {
  imageUrl: string;
  onClose: () => void;
  gridOption?: string;
}

export function FloatingReference({ imageUrl, onClose, gridOption = 'none' }: FloatingReferenceProps) {
  const [position, setPosition] = useState({ x: 40, y: 40 });
  const [size, setSize] = useState({ width: 300, height: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const [opacity, setOpacity] = useState(0.9);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };

    const onMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className="floating-ref"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height + 40,
        opacity,
        zIndex: 50,
      }}
    >
      <div className="floating-ref-header" onMouseDown={onMouseDown}>
        <div className="flex items-center gap-2">
          <Move size={14} />
          <span>Reference</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0.3"
            max="1"
            step="0.1"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="w-16 h-1 accent-[#007AFF]"
            title="Opacity"
          />
          <button onClick={onClose} className="hover:text-[#FF3B30] transition-colors" aria-label="Close">
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="relative" style={{ height: size.height }}>
        <img
          src={imageUrl}
          alt="Reference"
          className="w-full h-full object-contain bg-white"
          style={{ height: size.height }}
          draggable={false}
        />
        {gridOption !== 'none' && (
          <GridOverlay gridOption={gridOption} />
        )}
      </div>
    </div>
  );
}
