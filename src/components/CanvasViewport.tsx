import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Hand,
  Brush,
  SplitSquareVertical,
  Check,
} from 'lucide-react';
import { Adjustments, LocalMask, BrushPoint } from '../types/editor';
import { renderImageAdjustments } from '../engine/pipeline';
import { getDefaultAdjustments } from '../engine/defaultAdjustments';

interface CanvasViewportProps {
  sourceImage: HTMLImageElement | null;
  adjustments: Adjustments;
  onChangeAdjustments: (newAdj: Adjustments, action: string) => void;
  comparisonMode: 'off' | 'split' | 'side-by-side';
  isHoldingCompare: boolean;
  onCanvasRendered: (canvas: HTMLCanvasElement) => void;
  activeMaskId: string | null;
}

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  sourceImage,
  adjustments,
  onChangeAdjustments,
  comparisonMode,
  isHoldingCompare,
  onCanvasRendered,
  activeMaskId,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Zoom and pan state
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Split-screen divider position (0.0 to 1.0, default 0.5)
  const [splitPos, setSplitPos] = useState<number>(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  // Crop interaction state
  const [cropDraggingHandle, setCropDraggingHandle] = useState<string | null>(null);
  const [cropStart, setCropStart] = useState<{ mx: number; my: number; x: number; y: number; w: number; h: number } | null>(null);

  // Brush painting & refinement state
  const [isBrushing, setIsBrushing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeMask = adjustments.masks.find((m) => m.id === activeMaskId);

  const animFrameId = useRef<number | null>(null);

  // Re-render pipeline whenever adjustments, sourceImage, or hold state change (with rAF frame-skipping)
  useEffect(() => {
    if (!sourceImage || !canvasRef.current) return;

    if (animFrameId.current !== null) {
      cancelAnimationFrame(animFrameId.current);
    }

    animFrameId.current = requestAnimationFrame(() => {
      animFrameId.current = null;
      if (!sourceImage || !canvasRef.current) return;

      const target = canvasRef.current;
      const adjToRender = isHoldingCompare ? getDefaultAdjustments() : adjustments;

      // Adaptive viewport resolution (max 1280px for responsive 60fps preview)
      const containerW = containerRef.current?.clientWidth || 1280;
      const maxDim = Math.min(1280, Math.max(800, containerW * (window.devicePixelRatio || 1)));

      renderImageAdjustments(sourceImage, target, adjToRender, { maxDimension: maxDim });
      onCanvasRendered(target);

      // If split or side-by-side mode is active, render original image into separate canvas
      if (comparisonMode !== 'off' && originalCanvasRef.current) {
        renderImageAdjustments(sourceImage, originalCanvasRef.current, getDefaultAdjustments(), {
          maxDimension: maxDim,
        });
      }
    });

    return () => {
      if (animFrameId.current !== null) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [sourceImage, adjustments, isHoldingCompare, comparisonMode, onCanvasRendered]);

  // Render Ruby Mask Overlay preview whenever activeMask changes
  useEffect(() => {
    if (!overlayCanvasRef.current || !canvasRef.current) return;
    const overlay = overlayCanvasRef.current;
    const target = canvasRef.current;
    overlay.width = target.width;
    overlay.height = target.height;
    const octx = overlay.getContext('2d');
    if (!octx) return;

    octx.clearRect(0, 0, overlay.width, overlay.height);

    if (!activeMask || activeMask.showOverlay === false || !activeMask.enabled) {
      return;
    }

    const ow = overlay.width;
    const oh = overlay.height;
    const imgData = octx.createImageData(ow, oh);
    const data = imgData.data;

    const mw = activeMask.maskWidth || 256;
    const mh = activeMask.maskHeight || 256;
    const bitmap = activeMask.maskBitmap;
    const refineStrokes = activeMask.refineStrokes || [];
    const shouldInvert = activeMask.inverted || activeMask.type === 'ai-background';

    if (bitmap && bitmap.length > 0) {
      for (let y = 0; y < oh; y++) {
        const ny = y / oh;
        const py = Math.max(0, Math.min(mh - 1, Math.round(ny * (mh - 1))));
        for (let x = 0; x < ow; x++) {
          const nx = x / ow;
          const px = Math.max(0, Math.min(mw - 1, Math.round(nx * (mw - 1))));
          let val = (bitmap[py * mw + px] ?? 0) / 255.0;

          // Apply refine strokes
          if (refineStrokes.length > 0) {
            for (const stroke of refineStrokes) {
              const dist = Math.hypot(nx - stroke.x, ny - stroke.y);
              const rad = stroke.radius || 0.06;
              if (dist <= rad) {
                const inf = Math.cos((dist / rad) * (Math.PI / 2));
                if (stroke.mode === 'add') val = Math.min(1.0, val + inf * 0.9);
                else if (stroke.mode === 'erase') val = Math.max(0.0, val - inf * 0.9);
              }
            }
          }

          if (shouldInvert) val = 1.0 - val;

          if (val > 0.05) {
            const idx = (y * ow + x) * 4;
            // Ruby Red / Rose overlay (244, 63, 94) at ~45% max opacity
            data[idx] = 244;
            data[idx + 1] = 63;
            data[idx + 2] = 94;
            data[idx + 3] = Math.round(val * 115);
          }
        }
      }
      octx.putImageData(imgData, 0, 0);
    }
  }, [activeMask]);

  // Fit to screen helper
  const handleFit = useCallback(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const iw = canvasRef.current.width || 800;
    const ih = canvasRef.current.height || 600;

    const scale = Math.min((cw - 48) / iw, (ch - 48) / ih, 1.0);
    setZoom(Math.max(0.1, scale));
    setPan({ x: 0, y: 0 });
  }, []);

  // Set initial fit on image load
  useEffect(() => {
    if (sourceImage) {
      handleFit();
    }
  }, [sourceImage, handleFit]);

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.88;
    setZoom((prev) => Math.max(0.1, Math.min(5.0, prev * factor)));
  };

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // If clicking split divider
    if (e.target && (e.target as HTMLElement).classList.contains('split-divider-handle')) {
      setIsDraggingSplit(true);
      return;
    }

    // Check if mask refine mode is active
    if (e.button === 0 && activeMask && (activeMask.refineMode === 'add' || activeMask.refineMode === 'erase')) {
      setIsRefining(true);
      addRefineStroke(e);
      return;
    }

    // If space pressed or middle click or pan mode
    if (e.button === 1 || e.button === 0) {
      // Check if brush mask is active and painting
      if (activeMask && activeMask.type === 'brush' && !e.altKey && !e.shiftKey) {
        setIsBrushing(true);
        addBrushPoint(e);
        return;
      }

      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const addBrushPoint = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (!activeMask || activeMask.type !== 'brush') return;

    const newPoints = [...(activeMask.points || []), { x: nx, y: ny }];
    const newMasks = adjustments.masks.map((m) =>
      m.id === activeMaskId ? { ...m, points: newPoints } : m
    );
    onChangeAdjustments({ ...adjustments, masks: newMasks }, 'Brush Stroke');
  };

  const addRefineStroke = (e: React.MouseEvent) => {
    if (!canvasRef.current || !activeMask) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (activeMask.refineMode !== 'add' && activeMask.refineMode !== 'erase') return;
    const mode: 'add' | 'erase' = activeMask.refineMode;
    const radius = activeMask.refineRadius || 0.06;
    const newStrokes = [...(activeMask.refineStrokes || []), { x: nx, y: ny, mode, radius }];

    const newMasks = adjustments.masks.map((m) =>
      m.id === activeMaskId ? { ...m, refineStrokes: newStrokes } : m
    );
    onChangeAdjustments({ ...adjustments, masks: newMasks }, `Refine Mask (${mode})`);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingSplit && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const pos = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
      setSplitPos(pos);
      return;
    }

    if (isRefining) {
      addRefineStroke(e);
      return;
    }

    if (isBrushing) {
      addBrushPoint(e);
      return;
    }

    if (isPanning) {
      setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setIsDraggingSplit(false);
    setIsBrushing(false);
    setIsRefining(false);
  };

  // Crop handles logic
  const crop = adjustments.crop;
  const isCropping = crop.active;

  if (!sourceImage) {
    return (
      <main className="flex-1 h-[calc(100vh-3rem)] bg-[#07090d] flex items-center justify-center p-6 select-none relative">
        <div className="max-w-md text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-[#141824] border border-[#232a3b] mx-auto flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth="1.5" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
              <path d="M21 15l-5-5L5 21" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-slate-200">
            Welcome to LumaForge
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Import your own photo or pick one of the sample shots in the Library sidebar to start non-destructive editing.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className="flex-1 h-[calc(100vh-3rem)] bg-[#07090d] relative overflow-hidden flex items-center justify-center select-none cursor-default"
    >
      {/* Canvas Workspace Wrapper with Zoom & Pan */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isPanning ? 'none' : 'transform 0.08s ease-out',
        }}
        className="relative flex items-center justify-center"
      >
        {/* SIDE-BY-SIDE MODE */}
        {comparisonMode === 'side-by-side' ? (
          <div className="flex items-center gap-4">
            <div className="relative shadow-2xl rounded border border-[#202738] overflow-hidden bg-black">
              <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-black/70 text-[10px] font-semibold text-slate-300 backdrop-blur-sm">
                Original (Before)
              </div>
              <canvas ref={originalCanvasRef} className="block max-h-[85vh] max-w-[42vw] object-contain" />
            </div>

            <div className="relative shadow-2xl rounded border border-[#202738] overflow-hidden bg-black">
              <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-violet-950/80 text-[10px] font-semibold text-violet-300 border border-violet-700/50 backdrop-blur-sm">
                Edited (After)
              </div>
              <canvas ref={canvasRef} className="block max-h-[85vh] max-w-[42vw] object-contain" />
            </div>
          </div>
        ) : comparisonMode === 'split' ? (
          /* SPLIT-SCREEN COMPARISON MODE */
          <div className="relative shadow-2xl rounded border border-[#202738] overflow-hidden bg-black">
            {/* Edited canvas underneath */}
            <canvas ref={canvasRef} className="block max-h-[85vh] max-w-[85vw] object-contain" />

            {/* Original canvas clipped to splitPos */}
            <div
              style={{
                clipPath: `polygon(0 0, ${splitPos * 100}% 0, ${splitPos * 100}% 100%, 0 100%)`,
              }}
              className="absolute inset-0 pointer-events-none"
            >
              <canvas ref={originalCanvasRef} className="w-full h-full object-contain" />
            </div>

            {/* Draggable Divider Line */}
            <div
              style={{ left: `${splitPos * 100}%` }}
              className="absolute inset-y-0 w-0.5 bg-violet-400 shadow-md cursor-ew-resize z-20"
            >
              <div
                className="split-divider-handle absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-violet-600 border-2 border-white flex items-center justify-center shadow-lg text-white text-[10px]"
                title="Drag to compare before/after"
              >
                <SplitSquareVertical className="w-3.5 h-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Labels */}
            <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-black/70 text-[10px] font-semibold text-slate-300 backdrop-blur-sm pointer-events-none">
              Before
            </div>
            <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded bg-violet-950/80 text-[10px] font-semibold text-violet-300 border border-violet-700/50 backdrop-blur-sm pointer-events-none">
              After
            </div>
          </div>
        ) : (
          /* STANDARD SINGLE CANVAS VIEW */
          <div className="relative shadow-2xl rounded border border-[#202738] overflow-hidden bg-black">
            <canvas ref={canvasRef} className="block max-h-[85vh] max-w-[85vw] object-contain" />

            {/* Mask Ruby Red / Rose Preview Overlay */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 pointer-events-none w-full h-full object-contain"
            />

            {/* Active Refinement Badge */}
            {activeMask && activeMask.refineMode && activeMask.refineMode !== 'none' && (
              <div className="absolute top-2 left-2 z-20 px-2.5 py-1 rounded bg-black/80 border border-violet-500/60 text-white text-[11px] flex items-center gap-1.5 shadow-lg backdrop-blur-sm pointer-events-none">
                <span className={`w-2 h-2 rounded-full ${activeMask.refineMode === 'add' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span>
                  Brush Refine: <strong>{activeMask.refineMode.toUpperCase()}</strong> (Paint on photo)
                </span>
              </div>
            )}

            {/* Crop Overlay when Crop is active */}
            {isCropping && (
              <div className="absolute inset-0 pointer-events-auto border-2 border-dashed border-violet-400 bg-violet-950/10">
                {/* 3x3 Rule of thirds grid lines */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="border border-white/25" />
                  ))}
                </div>
                <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded text-[11px] text-white flex items-center gap-1.5 backdrop-blur-sm">
                  <span>Aspect: {crop.aspectRatio.toUpperCase()}</span>
                  <button
                    onClick={() =>
                      onChangeAdjustments(
                        { ...adjustments, crop: { ...crop, active: false } },
                        'Close Crop'
                      )
                    }
                    className="p-1 hover:bg-violet-600 rounded text-violet-300 hover:text-white"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Bottom Toolbar: Zoom & Viewport Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#121622]/90 backdrop-blur-md border border-[#232a3b] px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-2 text-xs text-slate-300 z-30">
        <button
          onClick={() => setZoom((prev) => Math.max(0.1, prev * 0.85))}
          title="Zoom Out"
          className="p-1 hover:text-white hover:bg-[#1f2638] rounded-full transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <span className="font-mono text-[11px] w-12 text-center tabular-nums text-slate-200">
          {Math.round(zoom * 100)}%
        </span>

        <button
          onClick={() => setZoom((prev) => Math.min(5.0, prev * 1.15))}
          title="Zoom In"
          className="p-1 hover:text-white hover:bg-[#1f2638] rounded-full transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-3.5 bg-slate-700 mx-0.5" />

        <button
          onClick={handleFit}
          title="Fit to Screen"
          className="flex items-center gap-1 px-2 py-0.5 hover:text-white hover:bg-[#1f2638] rounded-full transition-colors text-[11px]"
        >
          <Maximize2 className="w-3 h-3" />
          <span>Fit</span>
        </button>

        <button
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 0, y: 0 });
          }}
          title="Actual Size (100%)"
          className="px-2 py-0.5 hover:text-white hover:bg-[#1f2638] rounded-full transition-colors text-[11px]"
        >
          1:1
        </button>
      </div>
    </main>
  );
};
