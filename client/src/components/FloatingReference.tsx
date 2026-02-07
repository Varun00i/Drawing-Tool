import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Move } from 'lucide-react';
import { GridOverlay } from './GridOverlay';

interface FloatingReferenceProps {
  imageUrl: string;
  onClose: () => void;
  gridOption?: string;
}

export function FloatingReference({ imageUrl, onClose, gridOption = 'none' }: FloatingReferenceProps) {
  const [position, setPosition] = useState({ x: 40, y: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const [opacity, setOpacity] = useState(0.9);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Track actual container size via ResizeObserver for accurate grid overlay
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      // Force a re-render so the grid overlay recalculates
      // The grid overlay uses CSS inset:0, so it auto-fits
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
        opacity,
        zIndex: 50,
        width: 300,
        minWidth: 150,
        minHeight: 150,
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
      <div ref={contentRef} className="relative">
        <img
          src={imageUrl}
          alt="Reference"
          className="w-full h-auto object-contain bg-white"
          draggable={false}
        />
        {gridOption !== 'none' && (
          <GridOverlay gridOption={gridOption} />
        )}
      </div>
    </div>
  );
}
