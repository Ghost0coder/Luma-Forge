import React, { useRef, useState, useCallback, useMemo } from 'react';
import { CurvePoint, ToneCurves } from '../types/editor';
import { generateCurveLUT } from '../engine/colorScience';

interface ToneCurveGraphProps {
  curves: ToneCurves;
  onChange: (curves: ToneCurves) => void;
  histogram?: number[];
}

type ChannelKey = 'rgb' | 'red' | 'green' | 'blue';

export const ToneCurveGraph: React.FC<ToneCurveGraphProps> = React.memo(({
  curves,
  onChange,
  histogram,
}) => {
  const [activeChannel, setActiveChannel] = useState<ChannelKey>('rgb');
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const points = curves[activeChannel];

  // Memoize LUT precomputation and SVG path construction
  const { lut, pathD } = useMemo(() => {
    const lut = generateCurveLUT(points);
    let pathD = `M 0 ${255 - lut[0]}`;
    for (let x = 1; x < 256; x++) {
      pathD += ` L ${x} ${255 - lut[x]}`;
    }
    return { lut, pathD };
  }, [points]);

  const channelColors: Record<ChannelKey, { stroke: string; fill: string; activeBtn: string }> = {
    rgb: { stroke: '#f1f5f9', fill: 'rgba(255,255,255,0.06)', activeBtn: 'bg-slate-200 text-slate-900' },
    red: { stroke: '#ef4444', fill: 'rgba(239,68,68,0.1)', activeBtn: 'bg-red-600 text-white' },
    green: { stroke: '#22c55e', fill: 'rgba(34,197,94,0.1)', activeBtn: 'bg-green-600 text-white' },
    blue: { stroke: '#38bdf8', fill: 'rgba(56,189,248,0.1)', activeBtn: 'bg-blue-600 text-white' },
  };

  const getSvgCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = Math.max(0, Math.min(255, Math.round(((clientX - rect.left) / rect.width) * 255)));
    const y = Math.max(0, Math.min(255, Math.round((1 - (clientY - rect.top) / rect.height) * 255)));

    return { x, y };
  }, []);

  const handlePointerDown = (idx: number, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setDraggingIdx(idx);
  };

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (draggingIdx === null) return;
      const coords = getSvgCoordinates(e);
      if (!coords) return;

      const newPts = [...points];
      // Keep first and last x anchored to 0 and 255 if they are endpoints
      const isFirst = draggingIdx === 0;
      const isLast = draggingIdx === points.length - 1;

      newPts[draggingIdx] = {
        x: isFirst ? 0 : isLast ? 255 : coords.x,
        y: coords.y,
      };

      // Sort points
      newPts.sort((a, b) => a.x - b.x);

      onChange({
        ...curves,
        [activeChannel]: newPts,
      });
    },
    [draggingIdx, points, curves, activeChannel, onChange, getSvgCoordinates]
  );

  const handlePointerUp = () => {
    setDraggingIdx(null);
  };

  const handleSvgClick = (e: React.MouseEvent) => {
    if (draggingIdx !== null) return;
    const coords = getSvgCoordinates(e);
    if (!coords) return;

    // Check if clicked close to an existing point
    const threshold = 15;
    for (let i = 0; i < points.length; i++) {
      if (Math.hypot(points[i].x - coords.x, points[i].y - coords.y) < threshold) {
        return;
      }
    }

    if (points.length >= 8) return; // max points

    // Add new point
    const newPts = [...points, { x: coords.x, y: coords.y }].sort((a, b) => a.x - b.x);
    onChange({
      ...curves,
      [activeChannel]: newPts,
    });
  };

  const handleResetChannel = () => {
    onChange({
      ...curves,
      [activeChannel]: [
        { x: 0, y: 0 },
        { x: 255, y: 255 },
      ],
    });
  };

  return (
    <div className="space-y-2">
      {/* Channel Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-[#141822] p-0.5 rounded-md border border-[#202738] text-[11px]">
          {(['rgb', 'red', 'green', 'blue'] as ChannelKey[]).map((ch) => (
            <button
              key={ch}
              onClick={() => setActiveChannel(ch)}
              className={`px-2 py-0.5 rounded font-medium transition-colors uppercase ${
                activeChannel === ch
                  ? channelColors[ch].activeBtn
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {ch}
            </button>
          ))}
        </div>

        <button
          onClick={handleResetChannel}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          Reset Curve
        </button>
      </div>

      {/* SVG Interactive Canvas */}
      <div
        className="relative w-full aspect-square bg-[#0b0d13] rounded-lg border border-[#202738] overflow-hidden cursor-crosshair"
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        {/* Subtle grid lines */}
        <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none opacity-20">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="border border-slate-700" />
          ))}
        </div>

        {/* Diagonal reference line */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 256 256"
        >
          <line
            x1="0"
            y1="256"
            x2="256"
            y2="0"
            stroke="#2d3748"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        </svg>

        {/* Interactive SVG */}
        <svg
          ref={svgRef}
          viewBox="0 0 256 256"
          className="relative w-full h-full select-none"
          onClick={handleSvgClick}
        >
          {/* Curve Path */}
          <path
            d={pathD}
            fill="none"
            stroke={channelColors[activeChannel].stroke}
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Control Points */}
          {points.map((pt, idx) => (
            <circle
              key={idx}
              cx={pt.x}
              cy={255 - pt.y}
              r={draggingIdx === idx ? 7 : 5}
              fill="#ffffff"
              stroke={channelColors[activeChannel].stroke}
              strokeWidth="2"
              className="cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
              onMouseDown={(e) => handlePointerDown(idx, e)}
              onTouchStart={(e) => handlePointerDown(idx, e)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (points.length > 2) {
                  const newPts = points.filter((_, i) => i !== idx);
                  onChange({ ...curves, [activeChannel]: newPts });
                }
              }}
            />
          ))}
        </svg>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500 px-0.5">
        <span>Shadows</span>
        <span>Midtones</span>
        <span>Highlights</span>
      </div>
    </div>
  );
});

