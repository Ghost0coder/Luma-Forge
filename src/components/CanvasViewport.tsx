import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  SplitSquareVertical,
  Check,
  RotateCcw,
} from 'lucide-react';
import { Adjustments } from '../types/editor';
import { renderImageAdjustments } from '../engine/pipeline';
import { getDefaultAdjustments } from '../engine/defaultAdjustments';
import { workerManager } from '../engine/workerManager';
import { CROP_ASPECT_RATIOS } from '../engine/cropUtils';

interface CanvasViewportProps {
  sourceImage: HTMLImageElement | null;
  adjustments: Adjustments;
  onChangeAdjustments: (newAdj: Adjustments, action: string) => void;
  comparisonMode: 'off' | 'split' | 'side-by-side';
  isHoldingCompare: boolean;
  onCanvasRendered: (canvas: HTMLCanvasElement) => void;
  activeMaskId: string | null;
  zoom: number;
  onSetZoom: (zoom: number) => void;
  zoomMode?: 'fit' | '100%' | '200%' | 'custom';
  onSetZoomMode?: (mode: 'fit' | '100%' | '200%' | 'custom') => void;
}

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  sourceImage,
  adjustments,
  onChangeAdjustments,
  comparisonMode,
  isHoldingCompare,
  onCanvasRendered,
  activeMaskId,
  zoom,
  onSetZoom,
  zoomMode = 'fit',
  onSetZoomMode,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pan state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Split-screen divider position (0.0 to 1.0, default 0.5)
  const [splitPos, setSplitPos] = useState<number>(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  // Crop drag/reposition state
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [cropDragStart, setCropDragStart] = useState<{
    mx: number;
    my: number;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  // Brush painting & refinement state
  const [isBrushing, setIsBrushing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeMask = adjustments.masks.find((m) => m.id === activeMaskId);
  const animFrameId = useRef<number | null>(null);

  // Fit to screen helper: calculates scale = min(availableWidth / imageWidth, availableHeight / imageHeight)
  const handleFit = useCallback(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const iw = canvasRef.current.width || 1200;
    const ih = canvasRef.current.height || 800;

    const availableWidth = Math.max(100, cw - 48);
    const availableHeight = Math.max(100, ch - 48);

    const scale = Math.min(availableWidth / iw, availableHeight / ih);
    onSetZoom(Math.max(0.05, Math.min(5.0, scale)));
    onSetZoomMode?.('fit');
    setPan({ x: 0, y: 0 });
  }, [onSetZoom, onSetZoomMode]);

  // Recalculate Fit when the workspace container resizes
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (zoomMode === 'fit') {
        handleFit();
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [zoomMode, handleFit]);

  // Set initial fit on image load
  useEffect(() => {
    if (sourceImage) {
      handleFit();
    }
  }, [sourceImage, handleFit]);

  // Render loop using Web Worker with main-thread fallback
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

      workerManager.requestRender(
        sourceImage,
        target,
        adjToRender,
        { maxDimension: maxDim },
        (targetCanvas) => {
          onCanvasRendered(targetCanvas);
          if (zoomMode === 'fit') {
            handleFit();
          }
        }
      );

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
  }, [sourceImage, adjustments, isHoldingCompare, comparisonMode, onCanvasRendered, zoomMode, handleFit]);

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

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    onSetZoomMode?.('custom');
    const factor = e.deltaY < 0 ? 1.12 : 0.88;
    onSetZoom(Math.max(0.05, Math.min(6.0, zoom * factor)));
  };

  // Pan & crop drag handlers
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

    // Check if brush mask is active
    if (e.button === 0 && activeMask && activeMask.type === 'brush' && !e.altKey && !e.shiftKey) {
      setIsBrushing(true);
      addBrushPoint(e);
      return;
    }

    // Check if clicking inside crop overlay to drag/reposition crop window
    if (
      e.button === 0 &&
      adjustments.crop.active &&
      (adjustments.crop.width < 0.999 || adjustments.crop.height < 0.999) &&
      !e.altKey &&
      !e.shiftKey
    ) {
      const targetEl = e.target as HTMLElement;
      if (targetEl.closest('.crop-drag-surface')) {
        setIsDraggingCrop(true);
        setCropDragStart({
          mx: e.clientX,
          my: e.clientY,
          x: adjustments.crop.x,
          y: adjustments.crop.y,
          w: adjustments.crop.width,
          h: adjustments.crop.height,
        });
        return;
      }
    }

    // Default to workspace canvas panning
    if (e.button === 1 || e.button === 0) {
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

    // Reposition crop window inside source bounds
    if (isDraggingCrop && cropDragStart && canvasRef.current) {
      const targetW = canvasRef.current.width || 1200;
      const targetH = canvasRef.current.height || 800;
      const dx = (e.clientX - cropDragStart.mx) / (targetW * zoom);
      const dy = (e.clientY - cropDragStart.my) / (targetH * zoom);

      const maxMoveX = 1 - cropDragStart.w;
      const maxMoveY = 1 - cropDragStart.h;

      const newX = Math.max(0, Math.min(maxMoveX, cropDragStart.x - dx));
      const newY = Math.max(0, Math.min(maxMoveY, cropDragStart.y - dy));

      onChangeAdjustments(
        {
          ...adjustments,
          crop: {
            ...adjustments.crop,
            x: newX,
            y: newY,
          },
        },
        'Reposition Crop'
      );
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
    setIsDraggingCrop(false);
    setCropDragStart(null);
  };

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

  const activeRatioOption = CROP_ASPECT_RATIOS.find((r) => r.key === crop.aspectRatio);

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
          transition: isPanning || isDraggingCrop ? 'none' : 'transform 0.08s ease-out',
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
              <canvas ref={originalCanvasRef} className="block object-contain" />
            </div>

            <div className="relative shadow-2xl rounded border border-[#202738] overflow-hidden bg-black">
              <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-violet-950/80 text-[10px] font-semibold text-violet-300 border border-violet-700/50 backdrop-blur-sm">
                Edited (After)
              </div>
              <canvas ref={canvasRef} className="block object-contain" />
            </div>
          </div>
        ) : comparisonMode === 'split' ? (
          /* SPLIT-SCREEN COMPARISON MODE */
          <div className="relative shadow-2xl rounded border border-[#202738] overflow-hidden bg-black">
            {/* Edited canvas underneath */}
            <canvas ref={canvasRef} className="block object-contain" />

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
            <canvas ref={canvasRef} className="block object-contain" />

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
              <div className="crop-drag-surface absolute inset-0 pointer-events-auto border-2 border-dashed border-violet-400 bg-violet-950/15 cursor-move">
                {/* 3x3 Rule of thirds grid lines */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="border border-white/20" />
                  ))}
                </div>

                {/* Floating Aspect Ratio Badge & Actions */}
                <div className="absolute top-2 right-2 bg-black/85 px-2.5 py-1 rounded-md text-[11px] text-white flex items-center gap-2 backdrop-blur-sm border border-[#2b3348] shadow-lg pointer-events-auto">
                  <span className="font-semibold text-violet-300">
                    Ratio: {activeRatioOption?.label || crop.aspectRatio.toUpperCase()}
                  </span>
                  <button
                    onClick={() =>
                      onChangeAdjustments(
                        {
                          ...adjustments,
                          crop: {
                            ...crop,
                            active: false,
                            aspectRatio: 'original',
                            x: 0,
                            y: 0,
                            width: 1,
                            height: 1,
                          },
                        },
                        'Reset Crop'
                      )
                    }
                    className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-red-950/60 hover:text-red-300 text-slate-400 rounded text-[10px] transition-colors cursor-pointer"
                    title="Reset crop to full original photo"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Reset</span>
                  </button>
                  <button
                    onClick={() =>
                      onChangeAdjustments(
                        { ...adjustments, crop: { ...crop } },
                        'Apply Crop'
                      )
                    }
                    className="p-1 bg-violet-600 hover:bg-violet-500 rounded text-white shadow-sm transition-colors cursor-pointer"
                    title="Commit Crop"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Bottom Toolbar: Zoom & Viewport Controls (Separated from Crop) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#121622]/90 backdrop-blur-md border border-[#232a3b] px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-2 text-xs text-slate-300 z-30">
        <button
          onClick={() => {
            onSetZoomMode?.('custom');
            onSetZoom(Math.max(0.05, zoom * 0.85));
          }}
          title="Zoom Out (-)"
          className="p-1 hover:text-white hover:bg-[#1f2638] rounded-full transition-colors cursor-pointer"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <span className="font-mono text-[11px] w-12 text-center tabular-nums text-slate-200">
          {Math.round(zoom * 100)}%
        </span>

        <button
          onClick={() => {
            onSetZoomMode?.('custom');
            onSetZoom(Math.min(5.0, zoom * 1.15));
          }}
          title="Zoom In (+)"
          className="p-1 hover:text-white hover:bg-[#1f2638] rounded-full transition-colors cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-3.5 bg-slate-700 mx-0.5" />

        <button
          onClick={handleFit}
          title="Fit entire image in workspace without cropping"
          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full transition-colors text-[11px] cursor-pointer ${
            zoomMode === 'fit' ? 'bg-violet-600 text-white font-medium' : 'hover:text-white hover:bg-[#1f2638]'
          }`}
        >
          <Maximize2 className="w-3 h-3" />
          <span>Fit</span>
        </button>

        <button
          onClick={() => {
            onSetZoom(1.0);
            onSetZoomMode?.('100%');
            setPan({ x: 0, y: 0 });
          }}
          title="Actual Size (100% / 1:1 pixel scale)"
          className={`px-2.5 py-0.5 rounded-full transition-colors text-[11px] cursor-pointer ${
            zoomMode === '100%' || Math.abs(zoom - 1.0) < 0.01
              ? 'bg-violet-600 text-white font-medium'
              : 'hover:text-white hover:bg-[#1f2638]'
          }`}
        >
          100%
        </button>

        <button
          onClick={() => {
            onSetZoom(2.0);
            onSetZoomMode?.('200%');
            setPan({ x: 0, y: 0 });
          }}
          title="Double Magnification (200% / 2:1 zoom magnification)"
          className={`px-2.5 py-0.5 rounded-full transition-colors text-[11px] cursor-pointer ${
            zoomMode === '200%' || Math.abs(zoom - 2.0) < 0.01
              ? 'bg-violet-600 text-white font-medium'
              : 'hover:text-white hover:bg-[#1f2638]'
          }`}
        >
          200%
        </button>
      </div>
    </main>
  );
};
