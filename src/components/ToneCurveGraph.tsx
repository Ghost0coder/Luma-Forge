import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
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
  const grabOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const wasDraggingJustEndedRef = useRef<boolean>(false);

  const points = curves[activeChannel] || [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ];

  // Precompute LUT and construct SVG path
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

  // Accurate SVG coordinate calculation supporting browser zoom, high DPI, responsive scaling & CTM
  const getSvgCoordinates = useCallback((e: React.PointerEvent | React.MouseEvent | MouseEvent | PointerEvent): { x: number; y: number } | null => {
    if (!svgRef.current) return null;

    // Standard SVG Matrix Transform (Accurate across all browser zoom levels, page scroll, and CSS transforms)
    if (svgRef.current.getScreenCTM) {
      const ctm = svgRef.current.getScreenCTM();
      if (ctm) {
        const svgPt = svgRef.current.createSVGPoint();
        svgPt.x = e.clientX;
        svgPt.y = e.clientY;
        const transformed = svgPt.matrixTransform(ctm.inverse());
        const x = Math.max(0, Math.min(255, Math.round(transformed.x)));
        const y = Math.max(0, Math.min(255, Math.round(255 - transformed.y)));
        return { x, y };
      }
    }

    // Fallback: Client Bounding Rect
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const x = Math.max(0, Math.min(255, Math.round(((e.clientX - rect.left) / rect.width) * 255)));
    const y = Math.max(0, Math.min(255, Math.round((1 - (e.clientY - rect.top) / rect.height) * 255)));

    return { x, y };
  }, []);

  const handlePointerDownPoint = (idx: number, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const coords = getSvgCoordinates(e);
    if (!coords) return;

    const pt = points[idx];
    grabOffsetRef.current = {
      x: coords.x - pt.x,
      y: coords.y - pt.y,
    };

    isDraggingRef.current = true;
    wasDraggingJustEndedRef.current = false;
    setDraggingIdx(idx);

    if ('setPointerCapture' in e.currentTarget) {
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        // Fallback for browsers that restrict pointer capture
      }
    }
  };

  const updatePointPosition = useCallback((coords: { x: number; y: number }, targetIdx: number) => {
    const isFirst = targetIdx === 0;
    const isLast = targetIdx === points.length - 1;

    // Strict bounds to prevent point crossing or duplicate X values
    const minX = isFirst ? 0 : isLast ? 255 : points[targetIdx - 1].x + 1;
    const maxX = isFirst ? 0 : isLast ? 255 : points[targetIdx + 1].x - 1;

    const rawTargetX = coords.x - grabOffsetRef.current.x;
    const rawTargetY = coords.y - grabOffsetRef.current.y;

    const targetX = Math.max(minX, Math.min(maxX, Math.round(rawTargetX)));
    const targetY = Math.max(0, Math.min(255, Math.round(rawTargetY)));

    const newPts = [...points];
    newPts[targetIdx] = { x: targetX, y: targetY };

    onChange({
      ...curves,
      [activeChannel]: newPts,
    });
  }, [points, activeChannel, curves, onChange]);

  const handlePointerMovePoint = (e: React.PointerEvent) => {
    if (draggingIdx === null) return;
    const coords = getSvgCoordinates(e);
    if (!coords) return;
    updatePointPosition(coords, draggingIdx);
  };

  const handlePointerUpPoint = (e: React.PointerEvent) => {
    if ('releasePointerCapture' in e.currentTarget && e.currentTarget.hasPointerCapture(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore release errors
      }
    }
    isDraggingRef.current = false;
    wasDraggingJustEndedRef.current = true;
    setTimeout(() => {
      wasDraggingJustEndedRef.current = false;
    }, 100);
    setDraggingIdx(null);
  };

  // Window-level fallback pointer listeners when dragging
  useEffect(() => {
    if (draggingIdx === null) return;

    const handleWindowPointerMove = (e: PointerEvent) => {
      const coords = getSvgCoordinates(e);
      if (coords) {
        updatePointPosition(coords, draggingIdx);
      }
    };

    const handleWindowPointerUp = () => {
      isDraggingRef.current = false;
      wasDraggingJustEndedRef.current = true;
      setTimeout(() => {
        wasDraggingJustEndedRef.current = false;
      }, 100);
      setDraggingIdx(null);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerUp);
    };
  }, [draggingIdx, getSvgCoordinates, updatePointPosition]);

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    // Ignore click if a drag was active or just finished
    if (draggingIdx !== null || isDraggingRef.current || wasDraggingJustEndedRef.current) {
      return;
    }

    const coords = getSvgCoordinates(e);
    if (!coords) return;

    // Do not add point if clicked close to an existing point
    const threshold = 16;
    for (let i = 0; i < points.length; i++) {
      if (Math.hypot(points[i].x - coords.x, points[i].y - coords.y) < threshold) {
        return;
      }
    }

    if (points.length >= 8) return; // Max 8 control points per curve

    const newPts = [...points, { x: coords.x, y: coords.y }].sort((a, b) => a.x - b.x);
    onChange({
      ...curves,
      [activeChannel]: newPts,
    });
  };

  const handleRemovePoint = (idx: number, e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (points.length <= 2) return; // Minimum 2 endpoints

    const newPts = points.filter((_, i) => i !== idx);
    onChange({
      ...curves,
      [activeChannel]: newPts,
    });
  };

  const handleChannelChange = (ch: ChannelKey) => {
    setActiveChannel(ch);
    setDraggingIdx(null);
    isDraggingRef.current = false;
    wasDraggingJustEndedRef.current = false;
  };

  const handleResetChannel = () => {
    setDraggingIdx(null);
    isDraggingRef.current = false;
    wasDraggingJustEndedRef.current = false;
    onChange({
      ...curves,
      [activeChannel]: [
        { x: 0, y: 0 },
        { x: 255, y: 255 },
      ],
    });
  };

  return (
    <div className="space-y-2 select-none">
      {/* Channel Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-[#141822] p-0.5 rounded-md border border-[#202738] text-[11px]">
          {(['rgb', 'red', 'green', 'blue'] as ChannelKey[]).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => handleChannelChange(ch)}
              className={`px-2 py-0.5 rounded font-medium transition-colors uppercase cursor-pointer ${
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
          type="button"
          onClick={handleResetChannel}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
        >
          Reset Curve
        </button>
      </div>

      {/* SVG Interactive Canvas */}
      <div className="relative w-full aspect-square bg-[#0b0d13] rounded-lg border border-[#202738] overflow-hidden cursor-crosshair touch-none select-none">
        {/* Grid lines */}
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
            <g key={`${activeChannel}-${idx}`}>
              {/* Invisible touch/mouse target wrapper */}
              <circle
                cx={pt.x}
                cy={255 - pt.y}
                r="14"
                fill="transparent"
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => handlePointerDownPoint(idx, e)}
                onPointerMove={handlePointerMovePoint}
                onPointerUp={handlePointerUpPoint}
                onPointerCancel={handlePointerUpPoint}
                onLostPointerCapture={() => setDraggingIdx(null)}
                onDoubleClick={(e) => handleRemovePoint(idx, e)}
                onContextMenu={(e) => handleRemovePoint(idx, e)}
              />
              {/* Visible control point dot */}
              <circle
                cx={pt.x}
                cy={255 - pt.y}
                r={draggingIdx === idx ? 7 : 5}
                fill="#ffffff"
                stroke={channelColors[activeChannel].stroke}
                strokeWidth="2"
                className="pointer-events-none transition-transform"
              />
            </g>
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



