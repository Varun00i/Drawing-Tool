interface GridOverlayProps {
  gridOption: string;
  width: number;
  height: number;
}

export function GridOverlay({ gridOption, width, height }: GridOverlayProps) {
  if (gridOption === 'none') return null;

  const parts = gridOption.split('x').map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return null;

  const [cols, rows] = parts;
  const lines: JSX.Element[] = [];

  // Vertical lines
  for (let i = 1; i < cols; i++) {
    const x = (width / cols) * i;
    lines.push(
      <line key={`v-${i}`} x1={x} y1={0} x2={x} y2={height} />
    );
  }

  // Horizontal lines
  for (let i = 1; i < rows; i++) {
    const y = (height / rows) * i;
    lines.push(
      <line key={`h-${i}`} x1={0} y1={y} x2={width} y2={y} />
    );
  }

  return (
    <svg className="grid-overlay" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {lines}
    </svg>
  );
}
