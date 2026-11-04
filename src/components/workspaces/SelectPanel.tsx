import React from 'react';
import {
  Paintbrush,
  Lasso,
  Hexagon,
  Pipette,
  Plus,
  Minus,
  Sparkles,
  Maximize2,
  Minimize2,
  Layers,
  RotateCcw,
  Sliders,
  Check,
  Trash2,
  Users,
  UserCheck,
  Loader2,
  Eraser,
  X,
  Info,
} from 'lucide-react';
import { SelectionState, SelectionMode, SelectionOperation } from '../../types/editor';
import { applyPolygonToSelection, createEmptySelection } from '../../engine/selection/selectionEngine';

interface SelectPanelProps {
  selectionState: SelectionState;
  onUpdateSelectionState: (updates: Partial<SelectionState>) => void;
  onRunSelectPeople: () => Promise<void>;
  onInvert: () => void;
  onExpand: () => void;
  onContract: () => void;
  onFeather: () => void;
  onClear: () => void;
  onConvertToMask: () => void;
  onApplyAdjustments: () => void;
  onGoToRemove: () => void;
}

export const SelectPanel: React.FC<SelectPanelProps> = ({
  selectionState,
  onUpdateSelectionState,
  onRunSelectPeople,
  onInvert,
  onExpand,
  onContract,
  onFeather,
  onClear,
  onConvertToMask,
  onApplyAdjustments,
  onGoToRemove,
}) => {
  const handleFinishPolygon = () => {
    if (selectionState.polygonPoints.length < 3) return;
    const w = selectionState.maskWidth || 1200;
    const h = selectionState.maskHeight || 800;
    const currentMask = selectionState.maskBitmap || createEmptySelection(w, h);
    const isAdd = selectionState.operation !== 'subtract';
    const updated = applyPolygonToSelection(currentMask, w, h, selectionState.polygonPoints, isAdd);
    onUpdateSelectionState({
      maskBitmap: updated,
      hasSelection: true,
      polygonPoints: [],
    });
  };

  const handleUndoPolygonVertex = () => {
    if (selectionState.polygonPoints.length === 0) return;
    onUpdateSelectionState({
      polygonPoints: selectionState.polygonPoints.slice(0, -1),
    });
  };

  const handleCancelPolygon = () => {
    onUpdateSelectionState({
      polygonPoints: [],
    });
  };

  const modes: { id: SelectionMode; label: string; icon: React.ReactNode }[] = [
    { id: 'brush', label: 'Brush Select', icon: <Paintbrush className="w-4 h-4" /> },
    { id: 'lasso', label: 'Lasso Select', icon: <Lasso className="w-4 h-4" /> },
    { id: 'polygon', label: 'Polygon Select', icon: <Hexagon className="w-4 h-4" /> },
    { id: 'color-range', label: 'Color Range', icon: <Pipette className="w-4 h-4" /> },
  ];

  const operations: { id: SelectionOperation; label: string; icon: React.ReactNode }[] = [
    { id: 'new', label: 'New', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'add', label: 'Add', icon: <Plus className="w-3.5 h-3.5" /> },
    { id: 'subtract', label: 'Subtract', icon: <Minus className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full text-slate-200 select-none bg-[#11141c] border-l border-[#222938] p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="pb-3 border-b border-[#222938]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide text-[#f8fafc] flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Selection Studio
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            Object & People
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Detect people with AI or select regions using precision computer-vision tools.
        </p>
      </div>

      {/* Primary Tool: Select People */}
      <div className="bg-gradient-to-br from-purple-950/40 via-zinc-900/60 to-zinc-900/40 p-3 rounded-lg border border-purple-800/40 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-zinc-200">AI Person Detection</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-700/40 font-mono">
            MediaPipe
          </span>
        </div>

        <button
          onClick={onRunSelectPeople}
          disabled={selectionState.isDetectingPeople}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 disabled:opacity-50 transition cursor-pointer"
        >
          {selectionState.isDetectingPeople ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running Person Segmentation...
            </>
          ) : (
            <>
              <UserCheck className="w-4 h-4" />
              Select People
            </>
          )}
        </button>

        {/* Person Detection Feedback Banner */}
        {selectionState.personInfo && (
          <div className="pt-1 text-xs">
            {selectionState.personInfo.detected ? (
              <div className="p-2.5 rounded bg-purple-950/70 border border-purple-600/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-purple-200 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    {selectionState.personInfo.count === 1
                      ? '1 Person Detected'
                      : `${selectionState.personInfo.count} People Detected`}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {selectionState.personInfo.model === 'mediapipe-selfie' ? 'MediaPipe Model' : 'Local Heuristic'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-tight">
                  Selection active. You can accept, adjust toning, or remove the detected person.
                </p>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    onClick={onGoToRemove}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium text-[11px] shadow-sm transition"
                  >
                    <Eraser className="w-3 h-3" />
                    Remove Person
                  </button>
                  <button
                    onClick={onClear}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] border border-zinc-700 transition"
                  >
                    <X className="w-3 h-3" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="text-[11px]">{selectionState.personInfo.statusMessage || 'No people detected in this photograph.'}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Selection Tools */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium uppercase text-zinc-400">Manual Vision Tools</label>
        <div className="grid grid-cols-2 gap-1.5">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => onUpdateSelectionState({ mode: m.id })}
              className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors ${
                selectionState.mode === m.id
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                  : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Operation Mode */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium uppercase text-zinc-400">Operation</label>
        <div className="grid grid-cols-3 gap-1">
          {operations.map((op) => (
            <button
              key={op.id}
              onClick={() => onUpdateSelectionState({ operation: op.id })}
              className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                selectionState.operation === op.id
                  ? 'bg-purple-950 text-purple-200 border border-purple-600/60'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              {op.icon}
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tool-specific Settings */}
      {selectionState.mode === 'brush' && (
        <div className="space-y-3 bg-zinc-900/50 p-3 rounded border border-zinc-800/70">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400">Brush Radius</span>
              <span className="text-zinc-200 font-mono">{selectionState.brushSize}px</span>
            </div>
            <input
              type="range"
              min="5"
              max="150"
              value={selectionState.brushSize}
              onChange={(e) => onUpdateSelectionState({ brushSize: parseInt(e.target.value, 10) })}
              className="w-full accent-purple-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400">Edge Feather</span>
              <span className="text-zinc-200 font-mono">{selectionState.brushFeather}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={selectionState.brushFeather}
              onChange={(e) => onUpdateSelectionState({ brushFeather: parseInt(e.target.value, 10) })}
              className="w-full accent-purple-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      )}

      {selectionState.mode === 'color-range' && (
        <div className="space-y-3 bg-zinc-900/50 p-3 rounded border border-zinc-800/70">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400">Color Tolerance</span>
              <span className="text-zinc-200 font-mono">{selectionState.tolerance}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={selectionState.tolerance}
              onChange={(e) => onUpdateSelectionState({ tolerance: parseInt(e.target.value, 10) })}
              className="w-full accent-purple-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={selectionState.contiguous}
              onChange={(e) => onUpdateSelectionState({ contiguous: e.target.checked })}
              className="rounded bg-zinc-800 border-zinc-700 text-purple-600 focus:ring-purple-500/30 w-4 h-4"
            />
            <span>Contiguous (Flood Fill Region)</span>
          </label>
          <p className="text-[11px] text-zinc-500 leading-tight">
            Click any pixel on canvas to sample color seed and propagate.
          </p>
        </div>
      )}

      {selectionState.mode === 'polygon' && (
        <div className="space-y-2 bg-zinc-900/50 p-3 rounded border border-zinc-800/70 text-xs">
          <div className="flex items-center justify-between text-zinc-400">
            <span>Polygon Vertices</span>
            <span className="text-purple-300 font-mono font-semibold">
              {selectionState.polygonPoints.length} {selectionState.polygonPoints.length === 1 ? 'point' : 'points'}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-tight">
            Click on photo to place vertices. Click near the start vertex or click <strong>Finish</strong> below to close.
          </p>
          <div className="flex gap-1.5 pt-1">
            <button
              onClick={handleFinishPolygon}
              disabled={selectionState.polygonPoints.length < 3}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded font-medium text-xs shadow-sm transition cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Finish Selection</span>
            </button>
            <button
              onClick={handleUndoPolygonVertex}
              disabled={selectionState.polygonPoints.length === 0}
              className="flex items-center justify-center gap-1 py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 rounded font-medium text-xs transition cursor-pointer"
              title="Undo last placed vertex"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
            <button
              onClick={handleCancelPolygon}
              disabled={selectionState.polygonPoints.length === 0}
              className="flex items-center justify-center py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-400 hover:text-red-400 rounded transition cursor-pointer"
              title="Cancel polygon"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {selectionState.mode === 'lasso' && (
        <div className="text-xs text-zinc-400 bg-zinc-900/40 p-2.5 rounded border border-zinc-800">
          Click and drag freehand around any subject. Release to auto-close.
        </div>
      )}

      {/* Refine Selection Actions */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium uppercase text-zinc-400">Refine Selection</label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onInvert}
            disabled={!selectionState.hasSelection}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-800 transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
            Invert
          </button>
          <button
            onClick={onFeather}
            disabled={!selectionState.hasSelection}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-800 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
            Feather +4px
          </button>
          <button
            onClick={onExpand}
            disabled={!selectionState.hasSelection}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-800 transition"
          >
            <Maximize2 className="w-3.5 h-3.5 text-zinc-400" />
            Expand +4px
          </button>
          <button
            onClick={onContract}
            disabled={!selectionState.hasSelection}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-800 transition"
          >
            <Minimize2 className="w-3.5 h-3.5 text-zinc-400" />
            Contract -4px
          </button>
        </div>
        <button
          onClick={onClear}
          disabled={!selectionState.hasSelection}
          className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-rose-400 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition mt-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Selection
        </button>
      </div>

      {/* Direct Remove Action */}
      <div className="pt-2 border-t border-zinc-800">
        <button
          onClick={onGoToRemove}
          disabled={!selectionState.hasSelection}
          className="w-full flex items-center justify-center gap-2 py-2 rounded text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        >
          <Eraser className="w-4 h-4" />
          Remove Selected Region
        </button>
      </div>

      {/* Local Tone Adjustments for Selected Pixels */}
      <div className="space-y-3 pt-2 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium uppercase text-zinc-400 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            Selection Toning
          </label>
        </div>

        <div className="space-y-2 bg-zinc-900/40 p-2.5 rounded border border-zinc-800 text-xs">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-zinc-400">Exposure</span>
              <span className="font-mono text-zinc-200">
                {selectionState.localAdjustments.exposure > 0 ? '+' : ''}
                {selectionState.localAdjustments.exposure.toFixed(2)} EV
              </span>
            </div>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.05"
              value={selectionState.localAdjustments.exposure}
              onChange={(e) =>
                onUpdateSelectionState({
                  localAdjustments: {
                    ...selectionState.localAdjustments,
                    exposure: parseFloat(e.target.value),
                  },
                })
              }
              className="w-full accent-purple-500 h-1 bg-zinc-800 rounded cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-zinc-400">Contrast</span>
              <span className="font-mono text-zinc-200">{selectionState.localAdjustments.contrast}</span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={selectionState.localAdjustments.contrast}
              onChange={(e) =>
                onUpdateSelectionState({
                  localAdjustments: {
                    ...selectionState.localAdjustments,
                    contrast: parseInt(e.target.value, 10),
                  },
                })
              }
              className="w-full accent-purple-500 h-1 bg-zinc-800 rounded cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-zinc-400">Saturation</span>
              <span className="font-mono text-zinc-200">{selectionState.localAdjustments.saturation}</span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={selectionState.localAdjustments.saturation}
              onChange={(e) =>
                onUpdateSelectionState({
                  localAdjustments: {
                    ...selectionState.localAdjustments,
                    saturation: parseInt(e.target.value, 10),
                  },
                })
              }
              className="w-full accent-purple-500 h-1 bg-zinc-800 rounded cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-zinc-400">Temperature</span>
              <span className="font-mono text-zinc-200">{selectionState.localAdjustments.temperature}</span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={selectionState.localAdjustments.temperature}
              onChange={(e) =>
                onUpdateSelectionState({
                  localAdjustments: {
                    ...selectionState.localAdjustments,
                    temperature: parseInt(e.target.value, 10),
                  },
                })
              }
              className="w-full accent-purple-500 h-1 bg-zinc-800 rounded cursor-pointer"
            />
          </div>
        </div>

        <button
          onClick={onApplyAdjustments}
          disabled={!selectionState.hasSelection}
          className="w-full flex items-center justify-center gap-2 py-2 rounded text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-sm shadow-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <Check className="w-4 h-4" />
          Apply Toning to Image
        </button>

        <button
          onClick={onConvertToMask}
          disabled={!selectionState.hasSelection}
          className="w-full flex items-center justify-center gap-2 py-2 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <Layers className="w-4 h-4 text-purple-400" />
          Convert to Develop Mask
        </button>
      </div>
    </div>
  );
};
