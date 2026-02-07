interface GridOverlayProps {
  gridOption: string;
}

export function GridOverlay({ gridOption }: GridOverlayProps) {
  if (gridOption === 'none') return null;

  const parts = gridOption.split('x').map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return null;

  const [cols, rows] = parts;

  // Build percentage-based lines using CSS so the grid scales with container
  const vLines: JSX.Element[] = [];
  const hLines: JSX.Element[] = [];

  for (let i = 1; i < cols; i++) {
    const pct = (i / cols) * 100;
    vLines.push(
      <div
        key={`v-${i}`}
        className="grid-line-v"
        style={{ left: `${pct}%` }}
      />
    );
  }

  for (let i = 1; i < rows; i++) {
    const pct = (i / rows) * 100;
    hLines.push(
      <div
        key={`h-${i}`}
        className="grid-line-h"
        style={{ top: `${pct}%` }}
      />
    );
  }

  return (
    <div className="grid-overlay">
      {vLines}
      {hLines}
    </div>
  );
}
