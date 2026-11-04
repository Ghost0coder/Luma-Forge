import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Star,
  Clock,
  Plus,
  Trash2,
  Copy,
  Edit2,
  Download,
  Upload,
  Check,
  Eye,
  RotateCcw,
  Sliders,
  X,
  Sparkles,
  FolderArchive,
  Layers,
} from 'lucide-react';
import { Preset, PresetCategory, Adjustments } from '../types/editor';
import {
  exportPresetToFile,
  exportPresetPackToFile,
  parsePresetFile,
  duplicatePreset,
} from '../presets/presetUtils';
import {
  getFavoritePresetIds,
  toggleFavoritePresetId,
  getRecentlyUsedPresetIds,
  markPresetAsRecentlyUsed,
} from '../services/presetManager';
import { generatePresetThumbnail } from '../engine/presetThumbnailEngine';

interface PresetsPanelProps {
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
  sourceImage?: HTMLImageElement | null;
  currentAdjustments: Adjustments;
}

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'All', label: 'All' },
  { id: 'Favorites', label: 'Favorites' },
  { id: 'Recent', label: 'Recent' },
  { id: 'Cinematic', label: 'Cinematic' },
  { id: 'Portrait', label: 'Portrait' },
  { id: 'Landscape', label: 'Landscape' },
  { id: 'Street', label: 'Street' },
  { id: 'Film', label: 'Film' },
  { id: 'Black & White', label: 'B&W' },
  { id: 'Vibrant', label: 'Vibrant' },
  { id: 'Custom', label: 'Custom' },
];

export const PresetsPanel: React.FC<PresetsPanelProps> = ({
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
  sourceImage,
  currentAdjustments,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => getFavoritePresetIds());
  const [recentIds, setRecentIds] = useState<string[]>(() => getRecentlyUsedPresetIds());
  const [previewingPresetId, setPreviewingPresetId] = useState<string | null>(null);

  // Modal / form states
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [newPresetCategory, setNewPresetCategory] = useState<PresetCategory>('Custom');

  // Edit metadata modal
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCategory, setEditCategory] = useState<PresetCategory>('Custom');

  // Selected for batch export
  const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);

  // Status message for imports/exports
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine all presets
  const allPresets = useMemo(() => {
    return [...builtInPresets, ...customPresets];
  }, [builtInPresets, customPresets]);

  // Sync favorites on mount
  useEffect(() => {
    setFavoriteIds(getFavoritePresetIds());
    setRecentIds(getRecentlyUsedPresetIds());
  }, []);

  // Filtered preset list based on category, search, and favorites
  const filteredPresets = useMemo(() => {
    let list = allPresets;

    if (selectedCategory === 'Favorites') {
      list = list.filter((p) => favoriteIds.has(p.id));
    } else if (selectedCategory === 'Recent') {
      // Ordered by recent IDs
      const recentMap = new Map(recentIds.map((id, index) => [id, index]));
      list = list
        .filter((p) => recentMap.has(p.id))
        .sort((a, b) => (recentMap.get(a.id) ?? 999) - (recentMap.get(b.id) ?? 999));
    } else if (selectedCategory === 'Custom') {
      list = customPresets;
    } else if (selectedCategory !== 'All') {
      list = list.filter((p) => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allPresets, customPresets, selectedCategory, searchQuery, favoriteIds, recentIds]);

  const handleToggleFavorite = (e: React.MouseEvent, presetId: string) => {
    e.stopPropagation();
    const updated = toggleFavoritePresetId(presetId);
    setFavoriteIds(new Set(updated));
  };

  const handleApply = (preset: Preset) => {
    // Clear any active live preview
    if (onPreviewPreset) {
      onPreviewPreset(null);
    }
    setPreviewingPresetId(null);

    // Track recently used
    const updatedRecent = markPresetAsRecentlyUsed(preset.id);
    setRecentIds(updatedRecent);

    // Apply to current photograph
    onApplyPreset(preset, presetStrength);
  };

  // Live preview on hover / hover-out
  const handleMouseEnter = (preset: Preset) => {
    setPreviewingPresetId(preset.id);
    if (onPreviewPreset) {
      onPreviewPreset(preset);
    }
  };

  const handleMouseLeave = () => {
    if (previewingPresetId) {
      setPreviewingPresetId(null);
      if (onPreviewPreset) {
        onPreviewPreset(null);
      }
    }
  };

  const handleSaveCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    onSaveCustomPreset(newPresetName.trim(), newPresetDesc.trim(), newPresetCategory);
    setNewPresetName('');
    setNewPresetDesc('');
    setIsCreatingCustom(false);
    setStatusMessage('Custom preset created successfully!');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleDuplicate = (e: React.MouseEvent, preset: Preset) => {
    e.stopPropagation();
    const copy = duplicatePreset(preset);
    onImportCustomPreset(copy);
    setStatusMessage(`Created editable copy: "${copy.name}"`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleStartEdit = (e: React.MouseEvent, preset: Preset) => {
    e.stopPropagation();
    setEditingPreset(preset);
    setEditName(preset.name);
    setEditDesc(preset.description || '');
    setEditCategory(preset.category || 'Custom');
  };

  const handleSaveEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPreset || !editName.trim()) return;

    if (onUpdateCustomPreset) {
      onUpdateCustomPreset({
        ...editingPreset,
        name: editName.trim(),
        description: editDesc.trim(),
        category: editCategory,
        updatedAt: Date.now(),
      });
    }
    setEditingPreset(null);
    setStatusMessage('Preset metadata updated');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parsePresetFile(text);
        onImportCustomPreset(parsed);
        const count = Array.isArray(parsed) ? parsed.length : 1;
        setStatusMessage(`Successfully imported ${count} preset${count > 1 ? 's' : ''}!`);
        setTimeout(() => setStatusMessage(null), 3500);
      } catch (err: any) {
        alert(err.message || 'Failed to import preset');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleBatchExport = () => {
    if (selectedForBatch.size === 0) return;
    const presetsToExport = allPresets.filter((p) => selectedForBatch.has(p.id));
    exportPresetPackToFile(presetsToExport, `LumaForge-Export-${selectedForBatch.size}-Presets`);
    setIsBatchMode(false);
    setSelectedForBatch(new Set());
    setStatusMessage(`Exported pack of ${presetsToExport.length} presets!`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const toggleBatchSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = new Set(selectedForBatch);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedForBatch(updated);
  };

  const activePreset = allPresets.find((p) => p.id === activePresetId);

  return (
    <div className="flex flex-col h-full min-h-0 select-none text-slate-200 gap-2.5">
      {/* TOP CONTROLS: Fixed Header */}
      <div className="shrink-0 space-y-2">
        {/* Status banner */}
      {statusMessage && (
        <div className="p-2 bg-emerald-950/80 border border-emerald-700/60 rounded text-emerald-200 text-xs flex items-center justify-between animate-in fade-in">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ACTIVE PRESET HEADER BAR */}
      {activePreset && (
        <div className="p-2.5 rounded-lg bg-[#141824] border border-violet-800/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse shrink-0" />
              <span className="text-[11px] uppercase tracking-wider font-semibold text-violet-300">Active Look:</span>
              <span className="font-medium text-white truncate max-w-[130px]">{activePreset.name}</span>
            </div>
            {onResetPreset && (
              <button
                type="button"
                onClick={onResetPreset}
                title="Remove applied preset and reset to original"
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-[#1f2638] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Remove</span>
              </button>
            )}
          </div>

          {/* Strength Slider */}
          <div className="space-y-1 pt-1 border-t border-[#1f2638]">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Preset Strength</span>
              <span className="font-mono text-violet-300 tabular-nums">
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
              className="w-full accent-violet-500 h-1 bg-[#232b3e] rounded cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* SEARCH BAR & BATCH TOGGLE */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search 33+ presets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-[#141822] border border-[#202738] rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          onClick={() => {
            setIsBatchMode(!isBatchMode);
            setSelectedForBatch(new Set());
          }}
          title={isBatchMode ? 'Cancel batch selection' : 'Batch export presets'}
          className={`p-1.5 rounded-md border text-xs transition-colors cursor-pointer ${
            isBatchMode
              ? 'bg-violet-600 border-violet-500 text-white'
              : 'bg-[#141822] border-[#202738] text-slate-400 hover:text-white'
          }`}
        >
          <FolderArchive className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* CATEGORY FILTER TABS */}
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const count =
            cat.id === 'All'
              ? allPresets.length
              : cat.id === 'Favorites'
              ? favoriteIds.size
              : cat.id === 'Recent'
              ? recentIds.length
              : cat.id === 'Custom'
              ? customPresets.length
              : allPresets.filter((p) => p.category === cat.id).length;

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2 py-1 text-[11px] rounded transition-all cursor-pointer flex items-center gap-1 ${
                isSelected
                  ? 'bg-violet-600 text-white font-medium shadow-sm'
                  : 'bg-[#141822] text-slate-400 hover:text-slate-200 hover:bg-[#1a202d] border border-[#1e2536]'
              }`}
            >
              {cat.id === 'Favorites' && <Star className="w-2.5 h-2.5 fill-current" />}
              {cat.id === 'Recent' && <Clock className="w-2.5 h-2.5" />}
              <span>{cat.label}</span>
              <span className={`text-[9px] px-1 rounded-full ${isSelected ? 'bg-violet-800 text-violet-200' : 'bg-[#1b2230] text-slate-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* BATCH ACTION BAR (WHEN IN BATCH MODE) */}
      {isBatchMode && (
        <div className="p-2 bg-violet-950/60 border border-violet-800 rounded-md flex items-center justify-between text-xs">
          <span className="text-violet-200">
            {selectedForBatch.size} selected
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (selectedForBatch.size === filteredPresets.length) {
                  setSelectedForBatch(new Set());
                } else {
                  setSelectedForBatch(new Set(filteredPresets.map((p) => p.id)));
                }
              }}
              className="px-2 py-0.5 rounded bg-[#1e2536] text-[11px] text-slate-300 hover:text-white cursor-pointer"
            >
              {selectedForBatch.size === filteredPresets.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              disabled={selectedForBatch.size === 0}
              onClick={handleBatchExport}
              className="px-2.5 py-0.5 rounded bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-[11px] text-white font-medium flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>Export Pack</span>
            </button>
          </div>
        </div>
      )}

      {/* ACTION BAR: SAVE CUSTOM & IMPORT JSON */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setIsCreatingCustom(!isCreatingCustom)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-slate-200 bg-[#141822] hover:bg-[#1e2536] border border-[#202738] rounded-md transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-violet-400" />
          <span>Save Current Look</span>
        </button>

        <label className="flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-[#141822] hover:bg-[#1e2536] border border-[#202738] rounded-md transition-colors cursor-pointer">
          <Upload className="w-3.5 h-3.5 text-slate-400" />
          <span>Import</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
        </label>
      </div>

      {/* SAVE CUSTOM PRESET FORM MODAL */}
      {isCreatingCustom && (
        <form
          onSubmit={handleSaveCustomSubmit}
          className="p-3 bg-[#131722] border border-violet-800/80 rounded-lg space-y-2 text-xs animate-in fade-in"
        >
          <div className="flex items-center justify-between font-semibold text-slate-200">
            <span className="flex items-center gap-1.5 text-violet-300">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              Save As Custom Preset
            </span>
            <button
              type="button"
              onClick={() => setIsCreatingCustom(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            type="text"
            placeholder="Preset name (e.g. Vintage Portra Look)..."
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-[#0e1118] border border-[#232938] rounded text-slate-200 text-xs focus:outline-none focus:border-violet-500"
            required
            autoFocus
          />

          <input
            type="text"
            placeholder="Description (optional)..."
            value={newPresetDesc}
            onChange={(e) => setNewPresetDesc(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-[#0e1118] border border-[#232938] rounded text-slate-200 text-xs focus:outline-none focus:border-violet-500"
          />

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>Category:</span>
              <select
                value={newPresetCategory}
                onChange={(e) => setNewPresetCategory(e.target.value as PresetCategory)}
                className="bg-[#0e1118] border border-[#232938] text-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none"
              >
                <option value="Custom">Custom</option>
                <option value="Cinematic">Cinematic</option>
                <option value="Portrait">Portrait</option>
                <option value="Landscape">Landscape</option>
                <option value="Street">Street</option>
                <option value="Film">Film</option>
                <option value="Black & White">Black & White</option>
                <option value="Vibrant">Vibrant</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsCreatingCustom(false)}
                className="px-2.5 py-1 text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded font-medium cursor-pointer shadow-sm"
              >
                Save Preset
              </button>
            </div>
          </div>
        </form>
      )}

      {/* EDIT METADATA MODAL */}
      {editingPreset && (
        <form
          onSubmit={handleSaveEditSubmit}
          className="p-3 bg-[#131722] border border-blue-800/80 rounded-lg space-y-2 text-xs animate-in fade-in"
        >
          <div className="flex items-center justify-between font-semibold text-slate-200">
            <span className="flex items-center gap-1.5 text-blue-300">
              <Edit2 className="w-3.5 h-3.5 text-blue-400" />
              Edit Preset Metadata
            </span>
            <button
              type="button"
              onClick={() => setEditingPreset(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-[#0e1118] border border-[#232938] rounded text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            required
          />

          <input
            type="text"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="Description..."
            className="w-full px-2.5 py-1.5 bg-[#0e1118] border border-[#232938] rounded text-slate-200 text-xs focus:outline-none focus:border-blue-500"
          />

          <div className="flex items-center justify-between gap-2 pt-1">
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value as PresetCategory)}
              className="bg-[#0e1118] border border-[#232938] text-slate-300 rounded px-1.5 py-0.5 text-xs focus:outline-none"
            >
              <option value="Custom">Custom</option>
              <option value="Cinematic">Cinematic</option>
              <option value="Portrait">Portrait</option>
              <option value="Landscape">Landscape</option>
              <option value="Street">Street</option>
              <option value="Film">Film</option>
              <option value="Black & White">Black & White</option>
              <option value="Vibrant">Vibrant</option>
            </select>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEditingPreset(null)}
                className="px-2.5 py-1 text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium cursor-pointer shadow-sm"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      )}
      </div>

      {/* PRESETS THUMBNAIL GRID / LIST: Occupies remaining vertical height */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 custom-scrollbar">
        {filteredPresets.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs space-y-1">
            <Sliders className="w-6 h-6 mx-auto text-slate-600 mb-1" />
            <p>No presets found matching "{searchQuery || selectedCategory}"</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="text-violet-400 hover:underline text-[11px]"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-1 pb-4">
          {filteredPresets.map((preset) => {
            const isActive = preset.id === activePresetId;
            const isPreviewing = preset.id === previewingPresetId;
            const isFav = favoriteIds.has(preset.id);
            const isBatchSelected = selectedForBatch.has(preset.id);

            // Compute real thumbnail preview
            const thumbUrl = generatePresetThumbnail(preset, sourceImage, 76);

            return (
              <div
                key={preset.id}
                onClick={() => (isBatchMode ? toggleBatchSelect({} as any, preset.id) : handleApply(preset))}
                onMouseEnter={() => handleMouseEnter(preset)}
                onMouseLeave={handleMouseLeave}
                className={`relative rounded-lg border text-left transition-all cursor-pointer group overflow-hidden flex flex-col justify-between ${
                  isActive
                    ? 'bg-violet-950/40 border-violet-500 ring-1 ring-violet-500 text-white shadow-md'
                    : isPreviewing
                    ? 'bg-[#181e2b] border-violet-400/80 text-white'
                    : isBatchSelected
                    ? 'bg-violet-950/20 border-violet-600'
                    : 'bg-[#141822] hover:bg-[#1a202d] border-[#202738] text-slate-300'
                }`}
              >
                {/* Thumbnail Header with Live Preview */}
                <div className="relative aspect-[4/3] w-full bg-[#0d1017] overflow-hidden">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={preset.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#151924]">
                      <Sliders className="w-5 h-5 text-slate-600" />
                    </div>
                  )}

                  {/* Gradient bottom overlay */}
                  <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#141822] to-transparent pointer-events-none" />

                  {/* Favorite Star Button */}
                  <button
                    onClick={(e) => handleToggleFavorite(e, preset.id)}
                    title={isFav ? 'Remove from favorites' : 'Mark as favorite'}
                    className={`absolute top-1.5 right-1.5 p-1 rounded-full transition-colors cursor-pointer ${
                      isFav
                        ? 'bg-amber-500/90 text-white'
                        : 'bg-black/50 text-slate-400 hover:text-amber-400 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Star className={`w-3 h-3 ${isFav ? 'fill-current' : ''}`} />
                  </button>

                  {/* Batch Selection Checkbox */}
                  {isBatchMode && (
                    <div
                      onClick={(e) => toggleBatchSelect(e, preset.id)}
                      className="absolute top-1.5 left-1.5 w-4 h-4 rounded bg-black/60 border border-slate-400 flex items-center justify-center cursor-pointer"
                    >
                      {isBatchSelected && <Check className="w-3 h-3 text-violet-400 stroke-[3]" />}
                    </div>
                  )}

                  {/* Active / Preview Pill */}
                  {isActive ? (
                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-violet-600 text-white text-[9px] font-semibold flex items-center gap-1 shadow">
                      <Check className="w-2.5 h-2.5" />
                      Active
                    </span>
                  ) : isPreviewing ? (
                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-sky-600 text-white text-[9px] font-semibold flex items-center gap-1 shadow animate-pulse">
                      <Eye className="w-2.5 h-2.5" />
                      Previewing
                    </span>
                  ) : null}
                </div>

                {/* Preset Details */}
                <div className="p-2 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium truncate group-hover:text-violet-300 transition-colors">
                      {preset.name}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">
                    {preset.description}
                  </p>

                  {/* Hover Action Strip */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#1b2230] text-[10px] text-slate-500">
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider font-mono">
                      {preset.category}
                    </span>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      {/* Single Export */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exportPresetToFile(preset);
                        }}
                        title="Export JSON"
                        className="p-1 hover:text-slate-200 rounded cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                      </button>

                      {/* Duplicate */}
                      <button
                        onClick={(e) => handleDuplicate(e, preset)}
                        title="Duplicate as custom preset"
                        className="p-1 hover:text-violet-300 rounded cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                      </button>

                      {/* Edit Metadata (Custom presets only) */}
                      {preset.isCustom && (
                        <button
                          onClick={(e) => handleStartEdit(e, preset)}
                          title="Edit metadata"
                          className="p-1 hover:text-blue-300 rounded cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}

                      {/* Delete (Custom presets only) */}
                      {preset.isCustom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete custom preset "${preset.name}"?`)) {
                              onDeleteCustomPreset(preset.id);
                            }
                          }}
                          title="Delete custom preset"
                          className="p-1 hover:text-red-400 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
};
