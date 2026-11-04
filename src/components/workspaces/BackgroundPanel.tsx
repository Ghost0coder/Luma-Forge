import React, { useRef } from 'react';
import {
  Scissors,
  Download,
  Image as ImageIcon,
  Palette,
  Eye,
  Sliders,
  Sparkles,
  Loader2,
  Upload,
  RefreshCw,
  Check,
} from 'lucide-react';
import { BackgroundRemovalState } from '../../types/editor';

interface BackgroundPanelProps {
  backgroundState: BackgroundRemovalState;
  onUpdateBackgroundState: (updates: Partial<BackgroundRemovalState>) => void;
  onRunSegmentation: () => void;
  onExportTransparentPNG: () => void;
  onApplyToProject: () => void;
}

const COLOR_PRESETS = [
  '#ffffff',
  '#f3f4f6',
  '#e5e7eb',
  '#111827',
  '#090d16',
  '#1e1b4b',
  '#1e3a8a',
  '#064e3b',
  '#701a75',
  '#831843',
];

const BACKDROP_PRESETS = [
  {
    name: 'Studio Soft Grey',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><radialGradient id="g" cx="50%" cy="50%" r="70%"><stop offset="0%" stop-color="%23d1d5db"/><stop offset="100%" stop-color="%236b7280"/></radialGradient></defs><rect width="800" height="600" fill="url(%23g)"/></svg>',
  },
  {
    name: 'Dark Vignette Studio',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><radialGradient id="g" cx="50%" cy="40%" r="75%"><stop offset="0%" stop-color="%23374151"/><stop offset="100%" stop-color="%230f172a"/></radialGradient></defs><rect width="800" height="600" fill="url(%23g)"/></svg>',
  },
  {
    name: 'Warm Sunset Glow',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23ffedd5"/><stop offset="50%" stop-color="%23fed7aa"/><stop offset="100%" stop-color="%23fb923c"/></linearGradient></defs><rect width="800" height="600" fill="url(%23g)"/></svg>',
  },
];

export const BackgroundPanel: React.FC<BackgroundPanelProps> = ({
  backgroundState,
  onUpdateBackgroundState,
  onRunSegmentation,
  onExportTransparentPNG,
  onApplyToProject,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      onUpdateBackgroundState({
        mode: 'image',
        customBgUrl: url,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full text-slate-200 select-none bg-[#11141c] border-l border-[#222938] p-4 space-y-5 overflow-y-auto">
      {/* Header */}
      <div className="pb-3 border-b border-[#222938]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide text-[#f8fafc] flex items-center gap-2">
            <Scissors className="w-4 h-4 text-sky-400" />
            Background Studio
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            Subject Isolation
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Isolate portrait subjects and replace backgrounds with transparency, color, or blur.
        </p>
      </div>

      {/* Main Action Button */}
      <button
        onClick={onRunSegmentation}
        disabled={backgroundState.isProcessing}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 disabled:opacity-50 transition"
      >
        {backgroundState.isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing Subject Geometry...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            {backgroundState.maskBitmap ? 'Re-segment Subject' : 'Extract Subject Background'}
          </>
        )}
      </button>

      {/* Model detection badge */}
      {backgroundState.modelType !== 'none' && (
        <div className="flex items-center justify-between text-xs p-2 rounded bg-zinc-900 border border-zinc-800">
          <span className="text-zinc-400">Segmentation Model:</span>
          <span className="text-purple-300 font-medium">
            {backgroundState.modelType === 'mediapipe-selfie'
              ? 'MediaPipe SelfieSegmentation'
              : 'Local Saliency Heuristic'}
          </span>
        </div>
      )}

      {/* Background Replacement Modes */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium uppercase text-zinc-400">Replacement Mode</label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onUpdateBackgroundState({ mode: 'transparent' })}
            className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition ${
              backgroundState.mode === 'transparent'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Transparent
          </button>

          <button
            onClick={() => onUpdateBackgroundState({ mode: 'color' })}
            className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition ${
              backgroundState.mode === 'color'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            Solid Color
          </button>

          <button
            onClick={() => onUpdateBackgroundState({ mode: 'blur' })}
            className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition ${
              backgroundState.mode === 'blur'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Bokeh Blur
          </button>

          <button
            onClick={() => onUpdateBackgroundState({ mode: 'image' })}
            className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition ${
              backgroundState.mode === 'image'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Backdrop
          </button>
        </div>
      </div>

      {/* Mode Controls */}
      {backgroundState.mode === 'color' && (
        <div className="space-y-3 bg-zinc-900/50 p-3 rounded border border-zinc-800/70">
          <label className="text-[11px] font-medium uppercase text-zinc-400">Palette & Custom Color</label>
          <div className="flex flex-wrap gap-1.5">
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                onClick={() => onUpdateBackgroundState({ color: c })}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-full border transition ${
                  backgroundState.color === c ? 'border-purple-400 scale-110 shadow-sm' : 'border-zinc-700'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="color"
              value={backgroundState.color}
              onChange={(e) => onUpdateBackgroundState({ color: e.target.value })}
              className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer"
            />
            <input
              type="text"
              value={backgroundState.color}
              onChange={(e) => onUpdateBackgroundState({ color: e.target.value })}
              className="flex-1 bg-zinc-950 border border-zinc-800 px-2 py-1 text-xs rounded font-mono text-zinc-200"
            />
          </div>
        </div>
      )}

      {backgroundState.mode === 'blur' && (
        <div className="space-y-2 bg-zinc-900/50 p-3 rounded border border-zinc-800/70">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">Bokeh Blur Radius</span>
            <span className="text-zinc-200 font-mono">{backgroundState.blurRadius}px</span>
          </div>
          <input
            type="range"
            min="1"
            max="30"
            value={backgroundState.blurRadius}
            onChange={(e) => onUpdateBackgroundState({ blurRadius: parseInt(e.target.value, 10) })}
            className="w-full accent-purple-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>
      )}

      {backgroundState.mode === 'image' && (
        <div className="space-y-3 bg-zinc-900/50 p-3 rounded border border-zinc-800/70">
          <label className="text-[11px] font-medium uppercase text-zinc-400">Backdrop Presets</label>
          <div className="grid grid-cols-3 gap-1.5">
            {BACKDROP_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => onUpdateBackgroundState({ customBgUrl: p.url })}
                className="group relative h-14 rounded overflow-hidden border border-zinc-700 hover:border-purple-500 transition"
              >
                <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                <span className="absolute inset-0 bg-black/40 flex items-center justify-center text-[10px] text-white p-1 text-center font-medium opacity-0 group-hover:opacity-100 transition">
                  {p.name}
                </span>
              </button>
            ))}
          </div>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition"
            >
              <Upload className="w-3.5 h-3.5 text-purple-400" />
              Upload Custom Backdrop
            </button>
          </div>
        </div>
      )}

      {/* Edge Refinements */}
      <div className="space-y-3 bg-zinc-900/50 p-3 rounded border border-zinc-800/70">
        <label className="text-[11px] font-medium uppercase text-zinc-400">Alpha Edge Refinement</label>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-400">Edge Shift</span>
            <span className="text-zinc-200 font-mono">
              {backgroundState.edgeShift > 0 ? '+' : ''}
              {backgroundState.edgeShift}px
            </span>
          </div>
          <input
            type="range"
            min="-10"
            max="10"
            value={backgroundState.edgeShift}
            onChange={(e) => onUpdateBackgroundState({ edgeShift: parseInt(e.target.value, 10) })}
            className="w-full accent-purple-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-400">Edge Feather</span>
            <span className="text-zinc-200 font-mono">{backgroundState.feather}px</span>
          </div>
          <input
            type="range"
            min="0"
            max="20"
            value={backgroundState.feather}
            onChange={(e) => onUpdateBackgroundState({ feather: parseInt(e.target.value, 10) })}
            className="w-full accent-purple-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-2 border-t border-zinc-800">
        <button
          onClick={onExportTransparentPNG}
          disabled={!backgroundState.maskBitmap}
          className="w-full flex items-center justify-center gap-2 py-2 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <Download className="w-4 h-4" />
          Export Transparent PNG
        </button>

        <button
          onClick={onApplyToProject}
          disabled={!backgroundState.maskBitmap}
          className="w-full flex items-center justify-center gap-2 py-2 rounded text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white shadow-sm shadow-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <Check className="w-4 h-4" />
          Apply to Photo Project
        </button>
      </div>
    </div>
  );
};
