import React, { useState } from 'react';
import { X, Layers, Check, Download, Sliders, CheckSquare, Square } from 'lucide-react';
import { Adjustments, Preset, PhotoProject } from '../types/editor';
import { SAMPLE_PHOTOS } from '../data/samplePhotos';
import { BUILT_IN_PRESETS } from '../presets/builtInPresets';
import { applyPresetWithStrength } from '../presets/presetUtils';
import { renderImageAdjustments } from '../engine/pipeline';
import { getDefaultAdjustments } from '../engine/defaultAdjustments';

interface BatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: PhotoProject[];
  currentAdjustments: Adjustments;
  onBatchApplyPresetToProjects: (projectIds: string[], preset: Preset) => void;
  onBatchPasteAdjustments: (projectIds: string[], adjustments: Adjustments) => void;
}

export const BatchModal: React.FC<BatchModalProps> = ({
  isOpen,
  onClose,
  projects,
  currentAdjustments,
  onBatchApplyPresetToProjects,
  onBatchPasteAdjustments,
}) => {
  // Combine saved projects and sample photos for batch targets
  const allTargets = [
    ...projects.map((p) => ({
      id: p.id,
      name: p.name,
      thumb: p.thumbnailUrl,
      src: p.imageDataUrl,
      adjustments: p.adjustments,
    })),
    ...SAMPLE_PHOTOS.map((s) => ({
      id: s.id,
      name: s.title,
      thumb: s.url,
      src: s.url,
      adjustments: getDefaultAdjustments(),
    })),
  ];

  const [selectedIds, setSelectedIds] = useState<string[]>(allTargets.map((t) => t.id));
  const [selectedPresetId, setSelectedPresetId] = useState<string>(BUILT_IN_PRESETS[0].id);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(allTargets.map((t) => t.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const handleApplyPreset = () => {
    const preset = BUILT_IN_PRESETS.find((p) => p.id === selectedPresetId);
    if (!preset) return;
    onBatchApplyPresetToProjects(selectedIds, preset);
    alert(`Applied "${preset.name}" to ${selectedIds.length} photos.`);
    onClose();
  };

  const handlePasteCurrentLook = () => {
    onBatchPasteAdjustments(selectedIds, currentAdjustments);
    alert(`Synchronized current adjustment stack across ${selectedIds.length} photos.`);
    onClose();
  };

  const handleBatchExport = async () => {
    if (selectedIds.length === 0) return;
    setIsProcessing(true);
    setProgress({ current: 0, total: selectedIds.length });

    const targetsToExport = allTargets.filter((t) => selectedIds.includes(t.id));

    // Bounded concurrency (1 at a time to prevent mobile canvas memory spikes)
    for (let i = 0; i < targetsToExport.length; i++) {
      const target = targetsToExport[i];
      setProgress({ current: i + 1, total: targetsToExport.length });

      try {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            renderImageAdjustments(img, canvas, target.adjustments, { maxDimension: 1920 });
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `batch-${target.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.jpg`;
            a.click();
            setTimeout(resolve, 300);
          };
          img.onerror = () => resolve();
          img.src = target.src;
        });
      } catch (err) {
        console.error('Batch export item failed:', err);
      }
    }

    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-lg bg-[#131722] border border-[#262e40] rounded-xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#202738] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Batch Photography Workflow</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Photos Selection List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">
                Target Photos ({selectedIds.length} of {allTargets.length} selected)
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <button onClick={selectAll} className="text-violet-400 hover:underline">
                  Select All
                </button>
                <span>·</span>
                <button onClick={deselectAll} className="text-slate-400 hover:underline">
                  Deselect All
                </button>
              </div>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1 bg-[#0d1016] p-2 rounded-lg border border-[#202738]">
              {allTargets.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleSelect(item.id)}
                    className="flex items-center gap-2.5 p-1.5 rounded hover:bg-[#161c29] cursor-pointer transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-violet-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600 shrink-0" />
                    )}
                    <img
                      src={item.thumb}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded object-cover border border-[#262e40] shrink-0"
                    />
                    <span className="text-slate-200 font-medium truncate">{item.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action 1: Synchronize Current Adjustments */}
          <div className="p-3 bg-[#171c28] rounded-lg border border-[#262e40] flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-slate-200">Copy & Paste Current Look</div>
              <div className="text-[11px] text-slate-400">
                Sync current curves, light, HSL mixer, and grading onto selected photos.
              </div>
            </div>
            <button
              onClick={handlePasteCurrentLook}
              disabled={selectedIds.length === 0}
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-md whitespace-nowrap transition-colors disabled:opacity-50"
            >
              Paste Look
            </button>
          </div>

          {/* Action 2: Apply Built-in Preset */}
          <div className="p-3 bg-[#171c28] rounded-lg border border-[#262e40] space-y-2">
            <div className="font-semibold text-slate-200">Apply Preset in Bulk</div>
            <div className="flex items-center gap-2">
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                className="flex-1 px-2.5 py-1.5 bg-[#0e1118] border border-[#262e40] rounded text-slate-200 text-xs focus:outline-none focus:border-violet-500"
              >
                {BUILT_IN_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>
              <button
                onClick={handleApplyPreset}
                disabled={selectedIds.length === 0}
                className="px-3 py-1.5 bg-[#252e42] hover:bg-[#313c54] text-white font-medium rounded-md whitespace-nowrap transition-colors disabled:opacity-50"
              >
                Apply Preset
              </button>
            </div>
          </div>

          {/* Progress Indicator if active */}
          {isProcessing && (
            <div className="p-3 bg-violet-950/40 border border-violet-800/50 rounded-lg text-center space-y-1">
              <div className="text-violet-300 font-medium">
                Exporting image {progress.current} of {progress.total}...
              </div>
              <div className="w-full bg-[#121622] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-violet-500 h-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#202738] bg-[#0f121a] flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Bounded concurrency prevents browser out-of-memory errors.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white"
            >
              Close
            </button>
            <button
              onClick={handleBatchExport}
              disabled={isProcessing || selectedIds.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded text-xs font-semibold shadow transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Batch Export ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
