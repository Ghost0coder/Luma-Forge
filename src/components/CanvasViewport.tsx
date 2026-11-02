import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  SplitSquareVertical,
  Check,
  RotateCcw,
  Users,
  Eraser,
  X,
} from 'lucide-react';
import { Adjustments, WorkspaceMode, SelectionState, RetouchState, BackgroundRemovalState } from '../types/editor';
import { renderImageAdjustments } from '../engine/pipeline';
import { getDefaultAdjustments } from '../engine/defaultAdjustments';
import { workerManager } from '../engine/workerManager';
import { CROP_ASPECT_RATIOS } from '../engine/cropUtils';
import {
  applyBrushStrokeToSelection,
  applyPolygonToSelection,
  applyColorRangeToSelection,
  createEmptySelection,
  resampleMask,
} from '../engine/selection/selectionEngine';
import { renderCompositedBackground, refineBackgroundMask } from '../engine/segmentation/backgroundRemover';

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
  workspaceMode?: WorkspaceMode;
  selectionState?: SelectionState;
  onUpdateSelectionState?: (updates: Partial<SelectionState>) => void;
  retouchState?: RetouchState;
  onUpdateRetouchState?: (updates: Partial<RetouchState>) => void;
  backgroundState?: BackgroundRemovalState;
  onAcceptSelection?: () => void;
  onClearSelection?: () => void;
  onGoToRemove?: () => void;
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
  workspaceMode = 'develop',
  selectionState,
  onUpdateSelectionState,
  retouchState,
  onUpdateRetouchState,
  backgroundState,
  onAcceptSelection,
  onClearSelection,
  onGoToRemove,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pan state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false);

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
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);

  // Drawing state for Selection / Retouch tools
  const [isSelecting, setIsSelecting] = useState(false);
  const [isRetouching, setIsRetouching] = useState(false);

  // Visual brush cursor indicator
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; isInside: boolean } | null>(null);

  const activeMask = adjustments.masks.find((m) => m.id === activeMaskId);
  const animFrameId = useRef<number | null>(null);

  // Listen for Space bar for temporary panning tool
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

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

      // Adaptive viewport resolution (max 1440px for responsive 60fps preview)
      const containerW = containerRef.current?.clientWidth || 1280;
      const maxDim = Math.min(1440, Math.max(800, containerW * (window.devicePixelRatio || 1)));

      workerManager.requestRender(
        sourceImage,
        target,
        adjToRender,
        {
          maxDimension: maxDim,
          isCropEditing: Boolean(adjustments.crop.isEditing),
        },
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
          isCropEditing: Boolean(adjustments.crop.isEditing),
        });
      }
    });

    return () => {
      if (animFrameId.current !== null) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [sourceImage, adjustments, isHoldingCompare, comparisonMode, onCanvasRendered, zoomMode, handleFit]);

  // Render Background Removal Preview when in 'background' workspace
  useEffect(() => {
    if (
      workspaceMode !== 'background' ||
      !backgroundState?.maskBitmap ||
      !canvasRef.current ||
      !bgPreviewCanvasRef.current
    ) {
      return;
    }

    const source = canvasRef.current;
    const bgCanvas = bgPreviewCanvasRef.current;
    bgCanvas.width = source.width;
    bgCanvas.height = source.height;

    const ctx = bgCanvas.getContext('2d');
    if (!ctx) return;

    const refinedMask = refineBackgroundMask(
      backgroundState.maskBitmap,
      backgroundState.maskWidth,
      backgroundState.maskHeight,
      backgroundState.edgeShift,
      backgroundState.feather
    );

    let customImg: HTMLImageElement | null = null;
    if (backgroundState.mode === 'image' && backgroundState.customBgUrl) {
      customImg = new Image();
      customImg.src = backgroundState.customBgUrl;
    }

    renderCompositedBackground(
      ctx,
      source,
      refinedMask,
      backgroundState.maskWidth,
      backgroundState.maskHeight,
      source.width,
      source.height,
      {
        mode: backgroundState.mode,
        color: backgroundState.color,
        blurRadius: backgroundState.blurRadius,
        customBgImage: customImg,
        feather: backgroundState.feather,
        edgeShift: backgroundState.edgeShift,
      }
    );
  }, [workspaceMode, backgroundState, adjustments]);

  // Render Overlays: Selection, Retouch, and Develop Masks
  useEffect(() => {
    if (!overlayCanvasRef.current || !canvasRef.current) return;
    const overlay = overlayCanvasRef.current;
    const target = canvasRef.current;
    overlay.width = target.width;
    overlay.height = target.height;
    const octx = overlay.getContext('2d');
    if (!octx) return;

    octx.clearRect(0, 0, overlay.width, overlay.height);

    const ow = overlay.width;
    const oh = overlay.height;

    // 1. WORKSPACE: SELECT MODE OVERLAY
    if (workspaceMode === 'select' && selectionState) {
      if (selectionState.maskBitmap && selectionState.hasSelection) {
        const mw = selectionState.maskWidth;
        const mh = selectionState.maskHeight;
        const bitmap = selectionState.maskBitmap;
        const imgData = octx.createImageData(ow, oh);
        const data = imgData.data;

        for (let y = 0; y < oh; y++) {
          const my = Math.min(mh - 1, Math.floor((y / oh) * mh));
          for (let x = 0; x < ow; x++) {
            const mx = Math.min(mw - 1, Math.floor((x / ow) * mw));
            const val = (bitmap[my * mw + mx] || 0) / 255;
            if (val > 0.02) {
              const idx = (y * ow + x) * 4;
              // Radiant cyan-violet selection highlight with gentle alpha
              data[idx] = 168;     // R
              data[idx + 1] = 85;  // G
              data[idx + 2] = 247; // B
              data[idx + 3] = Math.round(val * 125);
            }
          }
        }
        octx.putImageData(imgData, 0, 0);
      }

      // Render polygon outline preview
      if (selectionState.mode === 'polygon' && selectionState.polygonPoints.length > 0) {
        octx.beginPath();
        selectionState.polygonPoints.forEach((pt, idx) => {
          const px = pt.x * ow;
          const py = pt.y * oh;
          if (idx === 0) octx.moveTo(px, py);
          else octx.lineTo(px, py);
        });
        octx.strokeStyle = '#c084fc';
        octx.lineWidth = 2;
        octx.setLineDash([4, 4]);
        octx.stroke();

        // Guide line from last vertex to current cursor position
        if (cursorPos && cursorPos.isInside && overlayCanvasRef.current) {
          const rect = overlayCanvasRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const curX = ((cursorPos.x - rect.left) / rect.width) * ow;
            const curY = ((cursorPos.y - rect.top) / rect.height) * oh;
            const lastPt = selectionState.polygonPoints[selectionState.polygonPoints.length - 1];
            octx.beginPath();
            octx.moveTo(lastPt.x * ow, lastPt.y * oh);
            octx.lineTo(curX, curY);
            octx.strokeStyle = '#e9d5ff';
            octx.lineWidth = 1.5;
            octx.setLineDash([3, 3]);
            octx.stroke();
          }
        }

        selectionState.polygonPoints.forEach((pt, idx) => {
          const px = pt.x * ow;
          const py = pt.y * oh;
          if (idx === 0 && selectionState.polygonPoints.length >= 3) {
            // First vertex highlighted as click-to-close origin
            octx.fillStyle = '#a855f7';
            octx.beginPath();
            octx.arc(px, py, 6, 0, Math.PI * 2);
            octx.fill();
            octx.strokeStyle = '#ffffff';
            octx.lineWidth = 2;
            octx.setLineDash([]);
            octx.stroke();
          } else {
            octx.fillStyle = '#ffffff';
            octx.beginPath();
            octx.arc(px, py, 4, 0, Math.PI * 2);
            octx.fill();
            octx.strokeStyle = '#7c3aed';
            octx.lineWidth = 1.5;
            octx.setLineDash([]);
            octx.stroke();
          }
        });
      }

      // Render lasso outline preview
      if (selectionState.mode === 'lasso' && selectionState.lassoPoints.length > 0) {
        octx.beginPath();
        selectionState.lassoPoints.forEach((pt, idx) => {
          const px = pt.x * ow;
          const py = pt.y * oh;
          if (idx === 0) octx.moveTo(px, py);
          else octx.lineTo(px, py);
        });
        octx.strokeStyle = '#a855f7';
        octx.lineWidth = 2;
        octx.setLineDash([3, 3]);
        octx.stroke();
      }

      return;
    }

    // 2. WORKSPACE: RETOUCH / REMOVE MODE OVERLAY
    if (workspaceMode === 'remove' && retouchState) {
      if (retouchState.maskBitmap && retouchState.hasMask) {
        const mw = retouchState.maskWidth;
        const mh = retouchState.maskHeight;
        const bitmap = retouchState.maskBitmap;
        const imgData = octx.createImageData(ow, oh);
        const data = imgData.data;

        for (let y = 0; y < oh; y++) {
          const my = Math.min(mh - 1, Math.floor((y / oh) * mh));
          for (let x = 0; x < ow; x++) {
            const mx = Math.min(mw - 1, Math.floor((x / ow) * mw));
            const val = (bitmap[my * mw + mx] || 0) / 255;
            if (val > 0.05) {
              const idx = (y * ow + x) * 4;
              // Ruby red removal mask
              data[idx] = 239;     // R
              data[idx + 1] = 68;  // G
              data[idx + 2] = 68;  // B
              data[idx + 3] = Math.round(val * 145);
            }
          }
        }
        octx.putImageData(imgData, 0, 0);
      }
      return;
    }

    // 3. WORKSPACE: DEVELOP MODE (Existing Local Mask Overlay)
    if (activeMask && activeMask.showOverlay !== false && activeMask.enabled) {
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
    }
  }, [workspaceMode, selectionState, retouchState, activeMask]);

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    onSetZoomMode?.('custom');
    const factor = e.deltaY < 0 ? 1.12 : 0.88;
    onSetZoom(Math.max(0.05, Math.min(6.0, zoom * factor)));
  };

  // Helper to convert client mouse event to canvas pixel coordinates
  const getCanvasPixelCoords = (e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0, nx: 0, ny: 0, width: 0, height: 0, isInside: false };
    const rect = canvasRef.current.getBoundingClientRect();
    const width = canvasRef.current.width || 1200;
    const height = canvasRef.current.height || 800;

    const isInside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const x = Math.round(nx * width);
    const y = Math.round(ny * height);
    return { x, y, nx, ny, width, height, isInside };
  };

  // Pan & crop drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // If clicking split divider
    if (e.target && (e.target as HTMLElement).classList.contains('split-divider-handle')) {
      setIsDraggingSplit(true);
      return;
    }

    const { x, y, nx, ny, width, height, isInside } = getCanvasPixelCoords(e);

    // If Space is pressed, or middle mouse, or user clicked outside photo area: PAN
    if (isSpacePressed || e.button === 1 || !isInside) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    // 1. SELECT MODE INTERACTION
    if (workspaceMode === 'select' && selectionState && onUpdateSelectionState) {
      const isAdd = selectionState.operation !== 'subtract';

      let currentMask = selectionState.maskBitmap;
      if (!currentMask) {
        currentMask = createEmptySelection(width, height);
      } else if (selectionState.maskWidth !== width || selectionState.maskHeight !== height) {
        currentMask = resampleMask(currentMask, selectionState.maskWidth, selectionState.maskHeight, width, height);
      }

      if (selectionState.mode === 'brush') {
        setIsSelecting(true);
        setLastPoint({ x, y });
        const updated = applyBrushStrokeToSelection(
          currentMask,
          width,
          height,
          x,
          y,
          x,
          y,
          selectionState.brushSize,
          selectionState.brushFeather,
          isAdd
        );
        onUpdateSelectionState({
          maskBitmap: updated,
          maskWidth: width,
          maskHeight: height,
          hasSelection: true,
        });
        return;
      }

      if (selectionState.mode === 'lasso') {
        setIsSelecting(true);
        onUpdateSelectionState({
          lassoPoints: [{ x: nx, y: ny }],
        });
        return;
      }

      if (selectionState.mode === 'polygon') {
        if (selectionState.polygonPoints.length >= 3) {
          const firstPt = selectionState.polygonPoints[0];
          const distPx = Math.hypot((nx - firstPt.x) * width, (ny - firstPt.y) * height);
          if (distPx <= 22) {
            // Clicked origin node to close and finalize polygon
            const updated = applyPolygonToSelection(
              currentMask,
              width,
              height,
              selectionState.polygonPoints,
              isAdd
            );
            onUpdateSelectionState({
              maskBitmap: updated,
              maskWidth: width,
              maskHeight: height,
              hasSelection: true,
              polygonPoints: [],
            });
            return;
          }
        }
        const newPts = [...selectionState.polygonPoints, { x: nx, y: ny }];
        onUpdateSelectionState({ polygonPoints: newPts });
        return;
      }

      if (selectionState.mode === 'color-range') {
        const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const imgData = ctx.getImageData(0, 0, width, height);
          const pIdx = (y * width + x) * 4;
          const seedR = imgData.data[pIdx];
          const seedG = imgData.data[pIdx + 1];
          const seedB = imgData.data[pIdx + 2];

          const updated = applyColorRangeToSelection(
            imgData.data,
            currentMask,
            width,
            height,
            seedR,
            seedG,
            seedB,
            selectionState.tolerance,
            selectionState.contiguous,
            x,
            y,
            isAdd
          );

          onUpdateSelectionState({
            maskBitmap: updated,
            maskWidth: width,
            maskHeight: height,
            hasSelection: true,
          });
        }
        return;
      }
    }

    // 2. RETOUCH / REMOVE MODE INTERACTION
    if (workspaceMode === 'remove' && retouchState && onUpdateRetouchState) {
      let currentMask = retouchState.maskBitmap;
      if (!currentMask) {
        currentMask = createEmptySelection(width, height);
      } else if (retouchState.maskWidth !== width || retouchState.maskHeight !== height) {
        currentMask = resampleMask(currentMask, retouchState.maskWidth, retouchState.maskHeight, width, height);
      }

      setIsRetouching(true);
      setLastPoint({ x, y });
      const isAdd = retouchState.mode === 'add';
      const updated = applyBrushStrokeToSelection(
        currentMask,
        width,
        height,
        x,
        y,
        x,
        y,
        retouchState.brushSize,
        retouchState.feather,
        isAdd
      );

      onUpdateRetouchState({
        maskBitmap: updated,
        maskWidth: width,
        maskHeight: height,
        hasMask: true,
      });
      return;
    }

    // 3. DEVELOP MODE (Mask Refine, Brush Mask, Crop, Pan)
    if (e.button === 0 && activeMask && (activeMask.refineMode === 'add' || activeMask.refineMode === 'erase')) {
      setIsRefining(true);
      addRefineStroke(e);
      return;
    }

    if (e.button === 0 && activeMask && activeMask.type === 'brush' && !e.altKey && !e.shiftKey) {
      setIsBrushing(true);
      addBrushPoint(e);
      return;
    }

    if (
      e.button === 0 &&
      adjustments.crop.isEditing &&
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
    const { x, y, nx, ny, width, height, isInside } = getCanvasPixelCoords(e);
    setCursorPos({ x: e.clientX, y: e.clientY, isInside });

    if (isDraggingSplit && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const pos = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
      setSplitPos(pos);
      return;
    }

    // 1. SELECT MODE DRAG
    if (isSelecting && workspaceMode === 'select' && selectionState && onUpdateSelectionState) {
      if (selectionState.mode === 'brush' && lastPoint && selectionState.maskBitmap) {
        const isAdd = selectionState.operation !== 'subtract';
        const updated = applyBrushStrokeToSelection(
          selectionState.maskBitmap,
          width,
          height,
          lastPoint.x,
          lastPoint.y,
          x,
          y,
          selectionState.brushSize,
          selectionState.brushFeather,
          isAdd
        );
        setLastPoint({ x, y });
        onUpdateSelectionState({ maskBitmap: updated });
        return;
      }
      if (selectionState.mode === 'lasso') {
        const newPts = [...selectionState.lassoPoints, { x: nx, y: ny }];
        onUpdateSelectionState({ lassoPoints: newPts });
        return;
      }
    }

    // 2. RETOUCH MODE DRAG
    if (isRetouching && workspaceMode === 'remove' && retouchState && onUpdateRetouchState) {
      if (lastPoint && retouchState.maskBitmap) {
        const isAdd = retouchState.mode === 'add';
        const updated = applyBrushStrokeToSelection(
          retouchState.maskBitmap,
          width,
          height,
          lastPoint.x,
          lastPoint.y,
          x,
          y,
          retouchState.brushSize,
          retouchState.feather,
          isAdd
        );
        setLastPoint({ x, y });
        onUpdateRetouchState({ maskBitmap: updated });
        return;
      }
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

      const newX = Math.max(0, Math.min(maxMoveX, cropDragStart.x + dx));
      const newY = Math.max(0, Math.min(maxMoveY, cropDragStart.y + dy));

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
    // Finalize lasso selection
    if (isSelecting && workspaceMode === 'select' && selectionState && onUpdateSelectionState) {
      if (selectionState.mode === 'lasso' && selectionState.lassoPoints.length > 2) {
        const width = canvasRef.current?.width || 1200;
        const height = canvasRef.current?.height || 800;
        let currentMask = selectionState.maskBitmap || createEmptySelection(width, height);
        if (selectionState.maskWidth !== width || selectionState.maskHeight !== height) {
          currentMask = resampleMask(currentMask, selectionState.maskWidth, selectionState.maskHeight, width, height);
        }
        const isAdd = selectionState.operation !== 'subtract';
        const updated = applyPolygonToSelection(
          currentMask,
          width,
          height,
          selectionState.lassoPoints,
          isAdd
        );
        onUpdateSelectionState({
          maskBitmap: updated,
          maskWidth: width,
          maskHeight: height,
          hasSelection: true,
          lassoPoints: [],
        });
      }
    }

    setIsSelecting(false);
    setIsRetouching(false);
    setLastPoint(null);
    setIsPanning(false);
    setIsDraggingSplit(false);
    setIsBrushing(false);
    setIsRefining(false);
    setIsDraggingCrop(false);
    setCropDragStart(null);
  };

  const handleDoubleClick = () => {
    // Finalize polygon selection
    if (workspaceMode === 'select' && selectionState && onUpdateSelectionState) {
      if (selectionState.mode === 'polygon' && selectionState.polygonPoints.length >= 3) {
        const width = canvasRef.current?.width || 1200;
        const height = canvasRef.current?.height || 800;
        let currentMask = selectionState.maskBitmap || createEmptySelection(width, height);
        if (selectionState.maskWidth !== width || selectionState.maskHeight !== height) {
          currentMask = resampleMask(currentMask, selectionState.maskWidth, selectionState.maskHeight, width, height);
        }
        const isAdd = selectionState.operation !== 'subtract';
        const updated = applyPolygonToSelection(
          currentMask,
          width,
          height,
          selectionState.polygonPoints,
          isAdd
        );
        onUpdateSelectionState({
          maskBitmap: updated,
          maskWidth: width,
          maskHeight: height,
          hasSelection: true,
          polygonPoints: [],
        });
      }
    }
  };

  const crop = adjustments.crop;
  const isCropping = Boolean(crop.isEditing);

  if (!sourceImage) {
    return (
      <main className="flex-1 h-[calc(100vh-3rem)] bg-[#07090d] flex items-center justify-center p-6 select-none relative">
        <div className="max-w-md text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-[#141824] border border-[#232a3b] mx-auto flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
              <path d="M21 15l-5-5L5 21" strokeWidth="1.5" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white">No Photo Loaded</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Drag and drop an image anywhere onto the canvas, or select a photo from the sample library on the left.
          </p>
        </div>
      </main>
    );
  }

  const activeRatioOption = CROP_ASPECT_RATIOS.find((r) => r.key === crop.aspectRatio);

  // Calculate brush ring diameter in screen pixels
  const activeBrushRadius =
    workspaceMode === 'select'
      ? selectionState?.brushSize || 40
      : workspaceMode === 'remove'
      ? retouchState?.brushSize || 32
      : 0;
  const brushDiameterScreen = Math.round(activeBrushRadius * 2 * zoom);

  return (
    <main
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      className={`flex-1 h-[calc(100vh-3rem)] bg-[#07090d] overflow-hidden relative flex items-center justify-center select-none ${
        isSpacePressed || isPanning
          ? 'cursor-grabbing'
          : workspaceMode === 'select' || workspaceMode === 'remove'
          ? 'cursor-crosshair'
          : 'cursor-grab'
      }`}
    >
      {/* Floating Person Detected Action Banner */}
      {workspaceMode === 'select' && selectionState?.personInfo?.detected && selectionState.hasSelection && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#121622]/95 border border-purple-500/50 shadow-2xl backdrop-blur-md text-xs text-white">
          <div className="flex items-center gap-1.5 font-medium text-purple-300 pr-1">
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span>
              {selectionState.personInfo.count === 1
                ? 'Person Detected'
                : `${selectionState.personInfo.count} People Detected`}
            </span>
          </div>
          <div className="w-px h-3.5 bg-zinc-700" />
          <button
            onClick={onAcceptSelection}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition cursor-pointer"
          >
            <Check className="w-3 h-3" />
            <span>Accept</span>
          </button>
          <button
            onClick={onGoToRemove}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-sm transition cursor-pointer"
          >
            <Eraser className="w-3 h-3" />
            <span>Remove Person</span>
          </button>
          <button
            onClick={onClearSelection}
            className="flex items-center gap-1 px-2 py-1 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-3 h-3" />
            <span>Cancel</span>
          </button>
        </div>
      )}

      {/* Dynamic Brush Radius Cursor Ring */}
      {cursorPos && cursorPos.isInside && activeBrushRadius > 0 && !isPanning && !isSpacePressed && (
        <div
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            width: `${brushDiameterScreen}px`,
            height: `${brushDiameterScreen}px`,
            transform: 'translate(-50%, -50%)',
          }}
          className="fixed rounded-full border border-white/90 shadow-[0_0_2px_rgba(0,0,0,0.9)] pointer-events-none z-50 transition-none"
        />
      )}

      {/* Canvas container with pan & zoom transform */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isPanning || isDraggingCrop ? 'none' : 'transform 0.05s ease-out',
        }}
        className="relative"
      >
        {/* SIDE-BY-SIDE BEFORE / AFTER VIEW */}
        {comparisonMode === 'side-by-side' ? (
          <div className="flex gap-4 p-2 bg-[#0c0f17] rounded-lg border border-[#1b2130] shadow-2xl">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Original</span>
              <div className="relative overflow-hidden rounded border border-[#232a3b] bg-black">
                <canvas ref={originalCanvasRef} className="block object-contain" />
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-violet-400">Edited</span>
              <div className="relative overflow-hidden rounded border border-violet-900/60 bg-black">
                <canvas ref={canvasRef} className="block object-contain" />
              </div>
            </div>
          </div>
        ) : comparisonMode === 'split' ? (
          /* SPLIT SCREEN SLIDER COMPARISON VIEW */
          <div className="relative shadow-2xl rounded border border-[#202738] overflow-hidden bg-black">
            <canvas ref={canvasRef} className="block object-contain" />
            <div
              style={{ clipPath: `inset(0 ${(1 - splitPos) * 100}% 0 0)` }}
              className="absolute inset-0 pointer-events-none"
            >
              <canvas ref={originalCanvasRef} className="block object-contain w-full h-full" />
            </div>
            <div
              style={{ left: `${splitPos * 100}%` }}
              className="split-divider-handle absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize flex items-center justify-center z-20 shadow-[0_0_10px_rgba(0,0,0,0.8)]"
            >
              <div className="w-6 h-6 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-lg pointer-events-none text-[10px] font-bold">
                <SplitSquareVertical className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        ) : workspaceMode === 'background' && backgroundState?.maskBitmap ? (
          /* BACKGROUND REMOVAL WORKSPACE PREVIEW (Checkerboard / Solid / Image / Blur) */
          <div
            className={`relative shadow-2xl rounded border border-[#202738] overflow-hidden ${
              backgroundState.mode === 'transparent'
                ? 'bg-[linear-gradient(45deg,#1f2937_25%,transparent_25%),linear-gradient(-45deg,#1f2937_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f2937_75%),linear-gradient(-45deg,transparent_75%,#1f2937_75%)] bg-[size:20px_20px] bg-slate-900'
                : 'bg-black'
            }`}
          >
            <canvas ref={bgPreviewCanvasRef} className="block object-contain" />
          </div>
        ) : (
          /* STANDARD SINGLE CANVAS VIEW WITH OVERLAYS */
          <div className="relative shadow-2xl rounded border border-[#202738] overflow-hidden bg-black">
            <canvas ref={canvasRef} className="block object-contain" />

            {/* Selection / Retouch / Mask Preview Overlay */}
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
              <div className="absolute inset-0 pointer-events-none select-none z-20">
                {/* 4 Dimmed Exterior Masking Panels */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `${crop.y * 100}%`,
                  }}
                  className="bg-black/60 pointer-events-none backdrop-blur-[0.5px]"
                />
                <div
                  style={{
                    position: 'absolute',
                    top: `${(crop.y + crop.height) * 100}%`,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                  className="bg-black/60 pointer-events-none backdrop-blur-[0.5px]"
                />
                <div
                  style={{
                    position: 'absolute',
                    top: `${crop.y * 100}%`,
                    height: `${crop.height * 100}%`,
                    left: 0,
                    width: `${crop.x * 100}%`,
                  }}
                  className="bg-black/60 pointer-events-none backdrop-blur-[0.5px]"
                />
                <div
                  style={{
                    position: 'absolute',
                    top: `${crop.y * 100}%`,
                    height: `${crop.height * 100}%`,
                    left: `${(crop.x + crop.width) * 100}%`,
                    right: 0,
                  }}
                  className="bg-black/60 pointer-events-none backdrop-blur-[0.5px]"
                />

                {/* Draggable Active Crop Viewport Box */}
                <div
                  style={{
                    left: `${crop.x * 100}%`,
                    top: `${crop.y * 100}%`,
                    width: `${crop.width * 100}%`,
                    height: `${crop.height * 100}%`,
                  }}
                  className="crop-drag-surface absolute pointer-events-auto border-2 border-dashed border-violet-400 bg-violet-500/5 cursor-move shadow-[0_0_0_1px_rgba(255,255,255,0.4)]"
                >
                  {/* 3x3 Rule-of-Thirds Grid */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="border border-white/20" />
                    ))}
                  </div>

                  {/* 4 Corner Framing Brackets */}
                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white pointer-events-none -translate-x-0.5 -translate-y-0.5" />
                  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-white pointer-events-none translate-x-0.5 -translate-y-0.5" />
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-white pointer-events-none -translate-x-0.5 translate-y-0.5" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-white pointer-events-none translate-x-0.5 translate-y-0.5" />

                  {/* Top-Right HUD with Ratio, Reset, and Commit buttons */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute -top-9 right-0 bg-[#0d1017]/90 px-2.5 py-1 rounded-md text-[11px] text-white flex items-center gap-2 backdrop-blur-md border border-[#2b3348] shadow-xl pointer-events-auto z-30"
                  >
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
                              isEditing: false,
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
                          {
                            ...adjustments,
                            crop: {
                              ...crop,
                              active: true,
                              isEditing: false,
                            },
                          },
                          'Apply Crop'
                        )
                      }
                      className="flex items-center gap-1 px-2 py-0.5 bg-violet-600 hover:bg-violet-500 rounded text-white text-[10px] font-medium shadow-sm transition-colors cursor-pointer"
                      title="Commit Crop and view cropped composition"
                    >
                      <Check className="w-3 h-3" />
                      <span>Apply</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Bottom Toolbar: Zoom & Viewport Controls */}
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
