import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Sliders,
  History,
  FolderOpen,
  Plus,
  Trash2,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Check,
} from 'lucide-react';
import { Preset, PresetCategory, HistoryEntry, PhotoProject, Snapshot, Adjustments } from '../types/editor';
import { SAMPLE_PHOTOS, SamplePhoto } from '../data/samplePhotos';
import { exportPresetToFile, parsePresetFile } from '../presets/presetUtils';
import { Compass, Camera } from 'lucide-react';
import { PresetsPanel } from './PresetsPanel';

interface LeftSidebarProps {
  activeTab: 'library' | 'presets' | 'history';
  setActiveTab: (tab: 'library' | 'presets' | 'history') => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSelectSample: (sample: SamplePhoto) => void;
  projects: PhotoProject[];
  currentProjectId: string | null;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  builtInPresets: Preset[];
  customPresets: Preset[];
  activePresetId: string | null;
  presetStrength: number;
  onApplyPreset: (preset: Preset, strength?: number) => void;
  onPresetStrengthChange: (strength: number) => void;
  onPreviewPreset?: (preset: Preset | null) => void;
  onResetPreset?: () => void;
  onSaveCustomPreset: (name: string, description: string, category: PresetCategory) => void;
  onUpdateCustomPreset?: (updated: Preset) => void;
  onImportCustomPreset: (preset: Preset | Preset[]) => void;
  onDeleteCustomPreset: (id: string) => void;
  history: HistoryEntry[];
  historyIndex: number;
  onJumpToHistory: (index: number) => void;
  sourceImage?: HTMLImageElement | null;
  currentAdjustments: Adjustments;
  snapshots?: Snapshot[];
  onSaveSnapshot?: (name: string) => void;
  onRestoreSnapshot?: (snapshot: Snapshot) => void;
  onDeleteSnapshot?: (id: string) => void;
  zoom?: number;
  onSetZoom?: (zoom: number) => void;
  onFit?: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = React.memo(({
  activeTab,
  setActiveTab,
  isOpen,
  onToggleOpen,
  onSelectSample,
  projects,
  currentProjectId,
  onSelectProject,
  onDeleteProject,
  builtInPresets,
  customPresets,
  activePresetId,
  presetStrength,
  onApplyPreset,
  onPresetStrengthChange,
  onPreviewPreset,
  onResetPreset,
  onSaveCustomPreset,
  onUpdateCustomPreset,
  onImportCustomPreset,
  onDeleteCustomPreset,
  history,
  historyIndex,
  onJumpToHistory,
  sourceImage,
  currentAdjustments,
  snapshots = [],
  onSaveSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  zoom = 1.0,
  onSetZoom,
  onFit,
}) => {
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);

  if (!isOpen) {
    return (
      <aside className="w-12 bg-[#11141c] border-r border-[#222938] flex flex-col items-center py-3 gap-3 shrink-0 z-20 h-full min-h-0">
        <button
          onClick={onToggleOpen}
          title="Expand sidebar"
          className="p-2 text-slate-400 hover:text-white hover:bg-[#161a24] rounded-lg transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="w-6 h-px bg-[#222938] my-0.5" />
        <button
          onClick={() => {
            setActiveTab('library');
            onToggleOpen();
          }}
          title="Library & Sessions"
          className={`p-2.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'library' ? 'text-indigo-400 bg-indigo-950/40 border border-indigo-800/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-[#161a24]'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setActiveTab('presets');
            onToggleOpen();
          }}
          title="Presets Studio"
          className={`p-2.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'presets' ? 'text-indigo-400 bg-indigo-950/40 border border-indigo-800/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-[#161a24]'
          }`}
        >
          <Sliders className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setActiveTab('history');
            onToggleOpen();
          }}
          title="History & Snapshots"
          className={`p-2.5 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'history' ? 'text-indigo-400 bg-indigo-950/40 border border-indigo-800/40 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-[#161a24]'
          }`}
        >
          <History className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-72 sm:w-80 bg-[#11141c] border-r border-[#222938] flex flex-col h-full min-h-0 shrink-0 z-20 select-none overflow-hidden">
      {/* Sidebar Header & Tab Switcher */}
      <div className="p-3 border-b border-[#222938] flex items-center justify-between gap-2 bg-[#11141c] shrink-0">
        <div className="flex items-center gap-1 p-0.5 bg-[#0c0e14] rounded-lg border border-[#222938] text-xs">
          <button
            onClick={() => setActiveTab('library')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'library'
                ? 'bg-[#1c2230] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Library
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'presets'
                ? 'bg-[#1c2230] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Presets
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#1c2230] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            History
          </button>
        </div>

        <button
          onClick={onToggleOpen}
          title="Collapse sidebar"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-[#161a24] rounded-lg transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* TAB CONTENT: PRESETS gets full height without wrapper scroll; LIBRARY & HISTORY get custom scrolling */}
      {activeTab === 'presets' ? (
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden p-3">
          <PresetsPanel
            builtInPresets={builtInPresets}
            customPresets={customPresets}
            activePresetId={activePresetId}
            presetStrength={presetStrength}
            onApplyPreset={onApplyPreset}
            onPresetStrengthChange={onPresetStrengthChange}
            onPreviewPreset={onPreviewPreset}
            onResetPreset={onResetPreset}
            onSaveCustomPreset={onSaveCustomPreset}
            onUpdateCustomPreset={onUpdateCustomPreset}
            onImportCustomPreset={onImportCustomPreset}
            onDeleteCustomPreset={onDeleteCustomPreset}
            sourceImage={sourceImage}
            currentAdjustments={currentAdjustments}
          />
        </div>
      ) : activeTab === 'library' ? (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
          {/* Collapsible Navigator Section inside Library tab */}
          {sourceImage && (
            <div className="rounded-lg border border-[#222938] bg-[#0c0e14] overflow-hidden">
              <button
                type="button"
                onClick={() => setIsNavigatorOpen(!isNavigatorOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-mono text-slate-400 hover:text-slate-200 hover:bg-[#141822] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5 text-indigo-300 font-semibold uppercase tracking-wider">
                  <Compass className="w-3.5 h-3.5 text-indigo-400" />
                  NAVIGATOR
                </span>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-slate-300">{Math.round(zoom * 100)}%</span>
                  {isNavigatorOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </div>
              </button>

              {isNavigatorOpen && (
                <div className="p-2.5 pt-0 border-t border-[#222938]/60 space-y-2">
                  <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-black border border-[#222938] group shadow-inner">
                    <img
                      src={sourceImage.src}
                      alt="Navigator Preview"
                      className="w-full h-full object-contain"
                    />
                    {zoom > 1.0 && (
                      <div
                        className="absolute border-2 border-indigo-400 bg-indigo-500/20 pointer-events-none rounded-sm transition-all"
                        style={{
                          width: `${Math.max(20, 100 / zoom)}%`,
                          height: `${Math.max(20, 100 / zoom)}%`,
                          top: '25%',
                          left: '25%',
                        }}
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                    <button
                      onClick={() => onFit?.()}
                      title="Fit complete image inside workspace"
                      className="flex-1 py-1 bg-[#161a24] hover:bg-[#1c2230] rounded border border-[#222938] text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      FIT
                    </button>
                    <button
                      onClick={() => onSetZoom?.(1.0)}
                      title="Actual size (100% / 1:1 pixel scale)"
                      className={`flex-1 py-1 rounded border transition-colors cursor-pointer ${
                        Math.abs(zoom - 1.0) < 0.01
                          ? 'bg-indigo-600 text-white font-medium border-indigo-500'
                          : 'bg-[#161a24] hover:bg-[#1c2230] border-[#222938] text-slate-300 hover:text-white'
                      }`}
                    >
                      100%
                    </button>
                    <button
                      onClick={() => onSetZoom?.(2.0)}
                      title="Double magnification (200% / 2:1 zoom)"
                      className={`flex-1 py-1 rounded border transition-colors cursor-pointer ${
                        Math.abs(zoom - 2.0) < 0.01
                          ? 'bg-indigo-600 text-white font-medium border-indigo-500'
                          : 'bg-[#161a24] hover:bg-[#1c2230] border-[#222938] text-slate-300 hover:text-white'
                      }`}
                    >
                      200%
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sample RAW / Editorial Photos */}
          <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Sample Studio Photos
                </span>
                <span className="text-[11px] text-slate-500 font-mono">3 shots</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {SAMPLE_PHOTOS.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => onSelectSample(sample)}
                    className="flex items-center gap-3 p-2 rounded-lg bg-[#141822] hover:bg-[#1c2230] border border-[#202738] text-left transition-all group"
                  >
                    <img
                      src={sample.url}
                      alt={sample.title}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 object-cover rounded-md border border-[#2b3345] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-200 group-hover:text-white truncate">
                        {sample.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {sample.category} · High Dynamic Range
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Saved Projects / Sessions in IndexedDB */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Saved Sessions
                </span>
                <span className="text-[11px] text-slate-500 font-mono">{projects.length} saved</span>
              </div>

              {projects.length === 0 ? (
                <div className="p-4 rounded-lg bg-[#0c0e14] border border-[#222938] text-center text-xs text-slate-500">
                  <FolderOpen className="w-6 h-6 mx-auto mb-1.5 text-slate-600" />
                  No saved sessions yet. Imported photos will automatically persist in your local IndexedDB storage.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {projects.map((proj) => {
                    const isSelected = proj.id === currentProjectId;
                    return (
                      <div
                        key={proj.id}
                        onClick={() => onSelectProject(proj.id)}
                        className={`flex items-center justify-between gap-2 p-2 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-950/40 border-indigo-500/60 text-white shadow-sm'
                            : 'bg-[#161a24] hover:bg-[#1c2230] border-[#222938] text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {proj.thumbnailUrl ? (
                            <img
                              src={proj.thumbnailUrl}
                              alt={proj.name}
                              className="w-10 h-10 object-cover rounded-md border border-[#222938] shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-[#0c0e14] rounded-md border border-[#222938] flex items-center justify-center shrink-0">
                              <ImageIcon className="w-4 h-4 text-slate-500" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate">{proj.name}</div>
                            <div className="text-[11px] text-slate-500">
                              {proj.width} × {proj.height} · {new Date(proj.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete session "${proj.name}"?`)) {
                              onDeleteProject(proj.id);
                            }
                          }}
                          className="p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors"
                          title="Delete session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
      ) : (
        /* 3. HISTORY TAB */
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
          {/* SNAPSHOTS SUB-SECTION */}
          <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-indigo-400" />
                  Snapshots
                </span>
                <button
                  onClick={() => {
                    const name = prompt('Enter snapshot name:', `Snapshot ${snapshots.length + 1}`);
                    if (name && name.trim()) {
                      onSaveSnapshot?.(name.trim());
                    }
                  }}
                  className="px-2.5 py-1 rounded-md bg-[#161a24] hover:bg-[#1c2230] border border-[#222938] hover:border-slate-500 text-[11px] font-mono text-indigo-300 transition-colors cursor-pointer"
                >
                  + Snapshot
                </button>
              </div>

              {snapshots.length === 0 ? (
                <div className="p-3 rounded-lg bg-[#0c0e14] border border-[#222938] text-center text-[11px] text-slate-500">
                  Save named edit states (e.g. "Warm Look") to recall them at any time.
                </div>
              ) : (
                <div className="space-y-1">
                  {snapshots.map((snap) => (
                    <div
                      key={snap.id}
                      onClick={() => onRestoreSnapshot?.(snap)}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#161a24] hover:bg-[#1c2230] border border-[#222938] text-xs text-slate-200 cursor-pointer transition-colors group"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate text-indigo-200 group-hover:text-white">
                          {snap.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSnapshot?.(snap.id);
                        }}
                        className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                        title="Delete snapshot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <hr className="border-[#222938]" />

            {/* EDIT HISTORY STACK */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Non-Destructive History</span>
                <span className="font-mono tabular-nums text-slate-500">{history.length} states</span>
              </div>

              {history.length === 0 ? (
                <div className="p-4 rounded-lg bg-[#0c0e14] border border-[#222938] text-center text-xs text-slate-500">
                  <Clock className="w-6 h-6 mx-auto mb-1.5 text-slate-600" />
                  No edits made yet. Adjust any parameter to build your non-destructive history stack.
                </div>
              ) : (
                <div className="space-y-1">
                  {history.map((entry, idx) => {
                    const isCurrent = idx === historyIndex;
                    const isFuture = idx > historyIndex;
                    return (
                      <button
                        key={entry.id}
                        onClick={() => onJumpToHistory(idx)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-indigo-950/40 border border-indigo-500/50 text-white font-medium shadow-sm'
                            : isFuture
                            ? 'bg-[#0c0e14] text-slate-600 hover:text-slate-400 border border-transparent'
                            : 'bg-[#161a24] hover:bg-[#1c2230] text-slate-300 border border-[#222938]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isCurrent ? 'bg-indigo-400' : isFuture ? 'bg-slate-700' : 'bg-slate-500'
                            }`}
                          />
                          <span className="truncate">{entry.action}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
      )}
    </aside>
  );
});
