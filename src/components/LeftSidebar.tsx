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
  Clock,
  Check,
} from 'lucide-react';
import { Preset, HistoryEntry, PhotoProject, Snapshot } from '../types/editor';
import { SAMPLE_PHOTOS, SamplePhoto } from '../data/samplePhotos';
import { exportPresetToFile, parsePresetFile } from '../presets/presetUtils';
import { Compass, Camera } from 'lucide-react';

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
  onSaveCustomPreset: (name: string, description: string) => void;
  onImportCustomPreset: (preset: Preset) => void;
  onDeleteCustomPreset: (id: string) => void;
  history: HistoryEntry[];
  historyIndex: number;
  onJumpToHistory: (index: number) => void;
  sourceImage?: HTMLImageElement | null;
  snapshots?: Snapshot[];
  onSaveSnapshot?: (name: string) => void;
  onRestoreSnapshot?: (snapshot: Snapshot) => void;
  onDeleteSnapshot?: (id: string) => void;
  zoom?: number;
  onSetZoom?: (zoom: number) => void;
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
  onSaveCustomPreset,
  onImportCustomPreset,
  onDeleteCustomPreset,
  history,
  historyIndex,
  onJumpToHistory,
  sourceImage,
  snapshots = [],
  onSaveSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  zoom = 1.0,
  onSetZoom,
}) => {
  const [presetCategory, setPresetCategory] = useState<string>('All');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');

  const allPresets = [...builtInPresets, ...customPresets];
  const filteredPresets =
    presetCategory === 'All'
      ? allPresets
      : presetCategory === 'Custom'
      ? customPresets
      : allPresets.filter((p) => p.category === presetCategory);

  const handleSavePresetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    onSaveCustomPreset(newPresetName.trim(), newPresetDesc.trim());
    setNewPresetName('');
    setNewPresetDesc('');
    setIsSavingPreset(false);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const preset = parsePresetFile(text);
        onImportCustomPreset(preset);
      } catch (err: any) {
        alert('Invalid preset JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!isOpen) {
    return (
      <div className="w-10 bg-[#0e1117] border-r border-[#1b202c] flex flex-col items-center py-3 gap-4 shrink-0 z-20">
        <button
          onClick={onToggleOpen}
          title="Expand sidebar"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1a202d] rounded-md transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setActiveTab('library');
            onToggleOpen();
          }}
          title="Library"
          className={`p-2 rounded-md transition-colors ${
            activeTab === 'library' ? 'text-violet-400 bg-violet-950/40' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setActiveTab('presets');
            onToggleOpen();
          }}
          title="Presets"
          className={`p-2 rounded-md transition-colors ${
            activeTab === 'presets' ? 'text-violet-400 bg-violet-950/40' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setActiveTab('history');
            onToggleOpen();
          }}
          title="History"
          className={`p-2 rounded-md transition-colors ${
            activeTab === 'history' ? 'text-violet-400 bg-violet-950/40' : 'text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-72 sm:w-80 bg-[#0e1117] border-r border-[#1b202c] flex flex-col h-[calc(100vh-3rem)] shrink-0 z-20 select-none overflow-hidden">
      {/* Sidebar Header & Tab Switcher */}
      <div className="p-3 border-b border-[#1b202c] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-0.5 bg-[#141822] rounded-lg border border-[#202738] text-xs">
          <button
            onClick={() => setActiveTab('library')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'library'
                ? 'bg-[#222a3b] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Library
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'presets'
                ? 'bg-[#222a3b] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Presets
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-[#222a3b] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            History
          </button>
        </div>

        <button
          onClick={onToggleOpen}
          title="Collapse sidebar"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1a202d] rounded-md transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* NAVIGATOR SECTION */}
      {sourceImage && (
        <div className="p-3 border-b border-[#1b202c] bg-[#0b0e14]">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
            <span className="flex items-center gap-1.5 text-violet-300 font-semibold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 text-violet-400" />
              NAVIGATOR
            </span>
            <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-black border border-[#202738] group">
            <img
              src={sourceImage.src}
              alt="Navigator Preview"
              className="w-full h-full object-contain"
            />
            {zoom > 1.0 && (
              <div
                className="absolute border-2 border-violet-400 bg-violet-500/20 pointer-events-none rounded-sm transition-all"
                style={{
                  width: `${Math.max(20, 100 / zoom)}%`,
                  height: `${Math.max(20, 100 / zoom)}%`,
                  top: '25%',
                  left: '25%',
                }}
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-1 mt-2 text-[10px] font-mono">
            <button
              onClick={() => onSetZoom?.(0.5)}
              className="flex-1 py-1 bg-[#141822] hover:bg-[#202738] rounded border border-[#202738] text-slate-300 hover:text-white transition-colors"
            >
              FIT
            </button>
            <button
              onClick={() => onSetZoom?.(1.0)}
              className="flex-1 py-1 bg-[#141822] hover:bg-[#202738] rounded border border-[#202738] text-slate-300 hover:text-white transition-colors"
            >
              1:1
            </button>
            <button
              onClick={() => onSetZoom?.(2.0)}
              className="flex-1 py-1 bg-[#141822] hover:bg-[#202738] rounded border border-[#202738] text-slate-300 hover:text-white transition-colors"
            >
              2:1
            </button>
          </div>
        </div>
      )}

      {/* TAB CONTENT */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* 1. LIBRARY TAB */}
        {activeTab === 'library' && (
          <div className="space-y-4">
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
                <div className="p-4 rounded-lg bg-[#12151e] border border-[#1d2330] text-center text-xs text-slate-500">
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
                            ? 'bg-violet-950/30 border-violet-700/60 text-white'
                            : 'bg-[#141822] hover:bg-[#1a202d] border-[#202738] text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {proj.thumbnailUrl ? (
                            <img
                              src={proj.thumbnailUrl}
                              alt={proj.name}
                              className="w-10 h-10 object-cover rounded border border-[#2b3345] shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-[#1b212f] rounded flex items-center justify-center shrink-0">
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
        )}

        {/* 2. PRESETS TAB */}
        {activeTab === 'presets' && (
          <div className="space-y-3">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1">
              {['All', 'Cinematic', 'Portrait', 'Landscape', 'Monochrome', 'Vintage', 'Custom'].map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setPresetCategory(cat)}
                    className={`px-2 py-0.5 text-[11px] rounded transition-colors ${
                      presetCategory === cat
                        ? 'bg-violet-600 text-white font-medium'
                        : 'bg-[#151923] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>

            {/* Active Preset Strength Slider */}
            {activePresetId && (
              <div className="p-2.5 rounded-lg bg-[#141822] border border-violet-900/50 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-violet-300 font-medium">Preset Strength</span>
                  <span className="font-mono text-slate-400 tabular-nums">
                    {Math.round(presetStrength * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={presetStrength}
                  onChange={(e) => onPresetStrengthChange(parseFloat(e.target.value))}
                  className="w-full accent-violet-500"
                />
              </div>
            )}

            {/* Action Buttons: Save Custom & Import JSON */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                onClick={() => setIsSavingPreset(!isSavingPreset)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-slate-200 bg-[#161b26] hover:bg-[#202738] border border-[#2b3348] rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-violet-400" />
                <span>Save Preset</span>
              </button>

              <label className="flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-[#161b26] hover:bg-[#202738] border border-[#2b3348] rounded-md transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-slate-400" />
                <span>Import</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>

            {/* Save Custom Preset Form */}
            {isSavingPreset && (
              <form onSubmit={handleSavePresetSubmit} className="p-3 bg-[#151924] border border-[#2b3348] rounded-lg space-y-2 text-xs">
                <div className="font-medium text-slate-200">Save Current Look</div>
                <input
                  type="text"
                  placeholder="Preset name..."
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#0f121a] border border-[#232938] rounded text-slate-200 text-xs focus:outline-none focus:border-violet-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newPresetDesc}
                  onChange={(e) => setNewPresetDesc(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#0f121a] border border-[#232938] rounded text-slate-200 text-xs focus:outline-none focus:border-violet-500"
                />
                <div className="flex justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsSavingPreset(false)}
                    className="px-2.5 py-1 text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded font-medium"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}

            {/* Presets List */}
            <div className="space-y-1.5 pt-1">
              {filteredPresets.map((preset) => {
                const isActive = preset.id === activePresetId;
                return (
                  <div
                    key={preset.id}
                    onClick={() => onApplyPreset(preset)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer group ${
                      isActive
                        ? 'bg-violet-950/40 border-violet-600 text-white shadow-sm'
                        : 'bg-[#141822] hover:bg-[#1a202d] border-[#202738] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold group-hover:text-violet-300 transition-colors flex items-center gap-1.5">
                        {preset.name}
                        {isActive && <Check className="w-3.5 h-3.5 text-violet-400" />}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportPresetToFile(preset);
                          }}
                          title="Export preset JSON"
                          className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        {preset.isCustom && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete custom preset "${preset.name}"?`)) {
                                onDeleteCustomPreset(preset.id);
                              }
                            }}
                            title="Delete custom preset"
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      {preset.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* SNAPSHOTS SUB-SECTION */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-violet-400" />
                  Snapshots
                </span>
                <button
                  onClick={() => {
                    const name = prompt('Enter snapshot name:', `Snapshot ${snapshots.length + 1}`);
                    if (name && name.trim()) {
                      onSaveSnapshot?.(name.trim());
                    }
                  }}
                  className="px-2 py-0.5 rounded bg-violet-950/60 hover:bg-violet-900 border border-violet-800/40 text-[11px] font-mono text-violet-300 transition-colors"
                >
                  + Create Snapshot
                </button>
              </div>

              {snapshots.length === 0 ? (
                <div className="p-3 rounded-lg bg-[#12151e] border border-[#1d2330] text-center text-[11px] text-slate-500">
                  Save named edit states (e.g. "Warm Look") to recall them at any time.
                </div>
              ) : (
                <div className="space-y-1">
                  {snapshots.map((snap) => (
                    <div
                      key={snap.id}
                      onClick={() => onRestoreSnapshot?.(snap)}
                      className="flex items-center justify-between p-2 rounded-md bg-[#141822] hover:bg-[#1a202d] border border-[#202738] text-xs text-slate-200 cursor-pointer transition-colors group"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate text-violet-200 group-hover:text-white">
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

            <hr className="border-[#1b202c]" />

            {/* EDIT HISTORY STACK */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Non-Destructive History</span>
                <span className="font-mono tabular-nums">{history.length} states</span>
              </div>

              {history.length === 0 ? (
                <div className="p-4 rounded-lg bg-[#12151e] border border-[#1d2330] text-center text-xs text-slate-500">
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
                        className={`w-full flex items-center justify-between p-2 rounded-md text-left text-xs transition-colors ${
                          isCurrent
                            ? 'bg-violet-950/50 border border-violet-700/60 text-white font-medium'
                            : isFuture
                            ? 'bg-[#10131b] text-slate-600 hover:text-slate-400'
                            : 'bg-[#141822] hover:bg-[#1c2230] text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isCurrent ? 'bg-violet-400' : isFuture ? 'bg-slate-700' : 'bg-slate-500'
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
      </div>
    </aside>
  );
});
