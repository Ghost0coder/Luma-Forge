import React from 'react';
import {
  Eraser,
  Paintbrush,
  Sparkles,
  Cpu,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Info,
  Users,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { RetouchState } from '../../types/editor';

interface RemovePanelProps {
  retouchState: RetouchState;
  onUpdateRetouchState: (updates: Partial<RetouchState>) => void;
  onExecuteRemoval: () => void;
  onClearMask: () => void;
  onRunSelectPeople: () => Promise<void>;
  isDetectingPeople?: boolean;
  serverAIConfigured: boolean;
  isHoldingCompare: boolean;
  setIsHoldingCompare: (val: boolean) => void;
}

export const RemovePanel: React.FC<RemovePanelProps> = ({
  retouchState,
  onUpdateRetouchState,
  onExecuteRemoval,
  onClearMask,
  onRunSelectPeople,
  isDetectingPeople = false,
  serverAIConfigured,
  isHoldingCompare,
  setIsHoldingCompare,
}) => {
  return (
    <div className="flex flex-col h-full text-slate-200 select-none bg-[#11141c] border-l border-[#222938] p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="pb-3 border-b border-[#222938]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide text-[#f8fafc] flex items-center gap-2">
            <Eraser className="w-4 h-4 text-rose-400" />
            Object & Watermark Removal
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            Retouch & Inpaint
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Seamlessly remove unwanted people, objects, watermarks, or blemishes from your photo.
        </p>
      </div>

      {/* Target Mode: Remove Person vs Remove Object */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium uppercase text-zinc-400">Target Type</label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onUpdateRetouchState({ toolMode: 'person' })}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded text-xs font-medium transition ${
              retouchState.toolMode === 'person'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Remove Person
          </button>
          <button
            onClick={() => onUpdateRetouchState({ toolMode: 'object' })}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded text-xs font-medium transition ${
              retouchState.toolMode === 'object'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            Remove Object
          </button>
        </div>
      </div>

      {/* ToolMode: Person Removal Assistant */}
      {retouchState.toolMode === 'person' && (
        <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-200">AI Person Detection</span>
            <span className="text-[10px] font-mono text-purple-300">MediaPipe</span>
          </div>
          <button
            onClick={onRunSelectPeople}
            disabled={isDetectingPeople || retouchState.isProcessing}
            className="w-full flex items-center justify-center gap-2 py-2 rounded text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-sm disabled:opacity-50 transition cursor-pointer"
          >
            {isDetectingPeople ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Detecting People...
              </>
            ) : (
              <>
                <Users className="w-3.5 h-3.5" />
                Detect & Select People
              </>
            )}
          </button>
          <p className="text-[11px] text-zinc-400 leading-tight">
            Click to automatically segment people in the photograph, or use the brush below to manually adjust the removal area.
          </p>
        </div>
      )}

      {/* Engine Selection */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium uppercase text-zinc-400">Inpainting Engine</label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onUpdateRetouchState({ algorithm: 'ai' })}
            className={`flex flex-col items-start p-2.5 rounded text-left transition border ${
              retouchState.algorithm === 'ai'
                ? 'bg-purple-950/60 border-purple-600/70 text-purple-200'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Gemini AI
            </div>
            <span className="text-[10px] text-zinc-400 mt-0.5">
              {serverAIConfigured ? '3.1 Flash Lite Image' : 'Requires API Key'}
            </span>
          </button>

          <button
            onClick={() => onUpdateRetouchState({ algorithm: 'local' })}
            className={`flex flex-col items-start p-2.5 rounded text-left transition border ${
              retouchState.algorithm === 'local'
                ? 'bg-purple-950/60 border-purple-600/70 text-purple-200'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Cpu className="w-3.5 h-3.5 text-zinc-300" />
              Manual Retouch
            </div>
            <span className="text-[10px] text-zinc-400 mt-0.5">100% Offline Local Patch</span>
          </button>
        </div>
      </div>

      {/* Brush Painting Controls */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium uppercase text-zinc-400">Brush Mode</label>
          <span className="text-[10px] text-purple-400 font-mono">
            {retouchState.mode === 'add' ? 'Paint Mask' : 'Erase Mask'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onUpdateRetouchState({ mode: 'add' })}
            className={`flex items-center justify-center gap-2 py-1.5 rounded text-xs font-medium transition ${
              retouchState.mode === 'add'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            Paint
          </button>
          <button
            onClick={() => onUpdateRetouchState({ mode: 'erase' })}
            className={`flex items-center justify-center gap-2 py-1.5 rounded text-xs font-medium transition ${
              retouchState.mode === 'erase'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            Erase
          </button>
        </div>
      </div>

      {/* Brush Settings */}
      <div className="space-y-2.5 bg-zinc-900/50 p-3 rounded border border-zinc-800/70">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-400">Brush Size</span>
            <span className="text-zinc-200 font-mono">{retouchState.brushSize}px</span>
          </div>
          <input
            type="range"
            min="5"
            max="150"
            value={retouchState.brushSize}
            onChange={(e) => onUpdateRetouchState({ brushSize: parseInt(e.target.value, 10) })}
            className="w-full accent-purple-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-400">Hardness</span>
            <span className="text-zinc-200 font-mono">{retouchState.hardness}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={retouchState.hardness}
            onChange={(e) => onUpdateRetouchState({ hardness: parseInt(e.target.value, 10) })}
            className="w-full accent-purple-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-400">Feathering</span>
            <span className="text-zinc-200 font-mono">{retouchState.feather}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="40"
            value={retouchState.feather}
            onChange={(e) => onUpdateRetouchState({ feather: parseInt(e.target.value, 10) })}
            className="w-full accent-purple-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Instructions */}
      <div className="flex items-start gap-2 text-[11px] text-zinc-400 bg-zinc-900/40 p-2.5 rounded border border-zinc-800/70">
        <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <span>
          Paint a red mask over any person, watermark, or object. Click <strong>Generate Removal</strong> to reconstruct the underlying photograph.
        </span>
      </div>

      {/* Error or Notice Alert */}
      {retouchState.error && (
        <div className="p-2.5 rounded bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-medium text-rose-200">Removal Notice</p>
            <p className="text-[11px] text-rose-300/90 leading-tight">{retouchState.error}</p>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {retouchState.successMessage && (
        <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-[11px]">{retouchState.successMessage}</span>
        </div>
      )}

      {/* Before/After Hold Compare */}
      <div className="pt-1">
        <button
          onMouseDown={() => setIsHoldingCompare(true)}
          onMouseUp={() => setIsHoldingCompare(false)}
          onMouseLeave={() => setIsHoldingCompare(false)}
          onTouchStart={() => setIsHoldingCompare(true)}
          onTouchEnd={() => setIsHoldingCompare(false)}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs transition border cursor-pointer ${
            isHoldingCompare
              ? 'bg-purple-700 text-white border-purple-500'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border-zinc-800'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Hold to Compare with Original</span>
        </button>
      </div>

      {/* Primary Actions */}
      <div className="space-y-2 pt-2 border-t border-zinc-800">
        <button
          onClick={onExecuteRemoval}
          disabled={!retouchState.hasMask || retouchState.isProcessing}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        >
          {retouchState.isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Inpainting & Reconstructing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Removal
            </>
          )}
        </button>

        <button
          onClick={onClearMask}
          disabled={!retouchState.hasMask || retouchState.isProcessing}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Removal Mask
        </button>
      </div>
    </div>
  );
};
