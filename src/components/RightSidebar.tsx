import React, { useState } from 'react';
import {
  Sun,
  Palette,
  Sparkles,
  Crop as CropIcon,
  SlidersHorizontal,
  CircleDot,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RotateCcw as ResetIcon,
  Wand2,
  UserCheck,
  Brush,
  Eraser,
  Layers,
} from 'lucide-react';
import { Adjustments, HistogramData, LocalMask, AIAnalysisResult } from '../types/editor';
import { HistogramView } from './HistogramView';
import { ToneCurveGraph } from './ToneCurveGraph';
import { HSLMixerPanel } from './HSLMixerPanel';
import { CROP_ASPECT_RATIOS, calculateAspectCrop } from '../engine/cropUtils';

interface RightSidebarProps {
  adjustments: Adjustments;
  onChangeAdjustments: (newAdj: Adjustments, actionName: string) => void;
  histogramData: HistogramData | null;
  onRunAIEnhance: () => Promise<void>;
  isAIAnalyzing: boolean;
  aiAnalysis: AIAnalysisResult | null;
  activeMaskId: string | null;
  setActiveMaskId: (id: string | null) => void;
  onGenerateAISubjectMask?: (type: 'ai-subject' | 'ai-background') => Promise<void>;
  isSegmenting?: boolean;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  sourceImage?: HTMLImageElement | null;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  adjustments,
  onChangeAdjustments,
  histogramData,
  onRunAIEnhance,
  isAIAnalyzing,
  aiAnalysis,
  activeMaskId,
  setActiveMaskId,
  onGenerateAISubjectMask,
  isSegmenting = false,
  isOpen = true,
  onToggleOpen,
  sourceImage,
}) => {
  // Mode state: 'basic' vs 'advanced'
  const [editMode, setEditMode] = useState<'basic' | 'advanced'>('basic');

  // Accordion section open states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    light: true,
    color: true,
    curves: false,
    hsl: false,
    grading: false,
    detail: false,
    geometry: false,
    masks: false,
  });

  const toggleSection = (sec: string) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Helper to update a numeric adjustment field
  const updateField = (
    field: keyof Adjustments,
    value: any,
    actionDesc: string
  ) => {
    onChangeAdjustments(
      {
        ...adjustments,
        [field]: value,
      },
      actionDesc
    );
  };

  // Reset Light section
  const resetLight = () => {
    onChangeAdjustments(
      {
        ...adjustments,
        exposure: 0,
        brightness: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        whites: 0,
        blacks: 0,
        temperature: 0,
        tint: 0,
      },
      'Reset Light'
    );
  };

  // Reset Color section
  const resetColor = () => {
    onChangeAdjustments(
      {
        ...adjustments,
        saturation: 0,
        vibrance: 0,
      },
      'Reset Color'
    );
  };

  // Reset Detail section
  const resetDetail = () => {
    onChangeAdjustments(
      {
        ...adjustments,
        sharpening: 0,
        clarity: 0,
        dehaze: 0,
        vignette: 0,
        grain: 0,
      },
      'Reset Detail'
    );
  };

  // Add Local Mask
  const handleAddMask = (type: 'radial' | 'linear' | 'brush') => {
    const id = `mask-${Date.now()}`;
    const newMask: LocalMask = {
      id,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Mask`,
      type,
      enabled: true,
      inverted: false,
      opacity: 1,
      centerX: 0.5,
      centerY: 0.5,
      radiusX: 0.25,
      radiusY: 0.25,
      feather: 0.5,
      startX: 0.5,
      startY: 0.8,
      endX: 0.5,
      endY: 0.2,
      points: [],
      brushRadius: 0.05,
      adjustments: {
        exposure: 0.4,
        contrast: 15,
        saturation: 10,
        temperature: 0,
        sharpness: 0,
      },
    };

    const newMasks = [...adjustments.masks, newMask];
    onChangeAdjustments(
      { ...adjustments, masks: newMasks },
      `Add ${type} mask`
    );
    setActiveMaskId(id);
    setOpenSections((prev) => ({ ...prev, masks: true }));
  };

  const handleUpdateMask = (id: string, partial: Partial<LocalMask>) => {
    const newMasks = adjustments.masks.map((m) =>
      m.id === id ? { ...m, ...partial } : m
    );
    onChangeAdjustments({ ...adjustments, masks: newMasks }, 'Update mask');
  };

  const handleDeleteMask = (id: string) => {
    const newMasks = adjustments.masks.filter((m) => m.id !== id);
    onChangeAdjustments({ ...adjustments, masks: newMasks }, 'Delete mask');
    if (activeMaskId === id) setActiveMaskId(null);
  };

  const handleSetAspectRatio = (ratioKey: string) => {
    const origW = sourceImage?.naturalWidth || 1200;
    const origH = sourceImage?.naturalHeight || 800;

    if (ratioKey === 'reset') {
      updateField(
        'crop',
        {
          ...adjustments.crop,
          active: false,
          aspectRatio: 'original',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
        'Reset Crop'
      );
      return;
    }

    const newCrop = calculateAspectCrop(origW, origH, ratioKey, adjustments.crop.stepRotation);
    updateField(
      'crop',
      {
        ...adjustments.crop,
        ...newCrop,
      },
      `Aspect Ratio ${ratioKey}`
    );
  };

  const activeMask = adjustments.masks.find((m) => m.id === activeMaskId);

  if (!isOpen) {
    return (
      <div className="w-10 bg-[#0e1117] border-l border-[#1b202c] flex flex-col items-center py-3 gap-4 shrink-0 z-20 select-none">
        <button
          onClick={onToggleOpen}
          title="Expand Right Sidebar"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1a202d] rounded-md transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setEditMode('basic');
            onToggleOpen?.();
          }}
          title="Basic Editing Mode"
          className={`p-2 rounded-md transition-colors ${
            editMode === 'basic' ? 'text-violet-400 bg-violet-950/40' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sun className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setEditMode('advanced');
            onToggleOpen?.();
          }}
          title="Advanced Editing Mode"
          className={`p-2 rounded-md transition-colors ${
            editMode === 'advanced' ? 'text-violet-400 bg-violet-950/40' : 'text-slate-400 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-80 sm:w-84 bg-[#0e1117] border-l border-[#1b202c] flex flex-col h-[calc(100vh-3rem)] shrink-0 z-20 select-none overflow-hidden text-slate-200">
      {/* Top Section: Mode Switcher (Basic vs Advanced) */}
      <div className="p-2.5 border-b border-[#1b202c] bg-[#0c0f16] flex items-center justify-between">
        <div className="flex items-center gap-1 p-0.5 bg-[#141822] rounded-lg border border-[#202738] text-xs">
          <button
            onClick={() => setEditMode('basic')}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              editMode === 'basic'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Basic Mode
          </button>
          <button
            onClick={() => setEditMode('advanced')}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              editMode === 'advanced'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Advanced Mode
          </button>
        </div>

        {onToggleOpen && (
          <button
            onClick={onToggleOpen}
            title="Collapse Right Sidebar"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1a202d] rounded-md transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Histogram & Deterministic Auto Adjust Section */}
      <div className="p-3 border-b border-[#1b202c] space-y-3 bg-[#0d1016]">
        <HistogramView data={histogramData} />

        {/* Local Deterministic Auto Adjust Button */}
        <button
          onClick={onRunAIEnhance}
          disabled={isAIAnalyzing}
          title="100% Local Deterministic Histogram Auto-Levels & Color Balance"
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:from-violet-700 active:to-indigo-700 text-white rounded-lg font-semibold text-xs shadow-md shadow-violet-950/50 transition-all cursor-pointer disabled:opacity-50"
        >
          {isAIAnalyzing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Auto Adjusting Tones...</span>
            </>
          ) : (
            <>
              <Wand2 className="w-3.5 h-3.5 text-violet-200" />
              <span>Auto Adjust</span>
            </>
          )}
        </button>

        {/* Photographic Diagnosis Box */}
        {aiAnalysis && (
          <div className="p-2.5 rounded-lg bg-[#141824] border border-violet-800/40 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-violet-300 font-semibold">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-violet-400" />
                Histogram Diagnosis
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {Math.round(aiAnalysis.confidence * 100)}% confidence
              </span>
            </div>
            <p className="text-slate-300">{aiAnalysis.sceneSummary}</p>
            <p className="text-slate-400 leading-snug">{aiAnalysis.lightingDiagnosis}</p>
          </div>
        )}
      </div>

      {/* Scrollable Adjustment Modules */}
      <div className="flex-1 overflow-y-auto p-3 pb-32 space-y-3 divide-y divide-[#1b202c]">
        {/* BASIC MODE CONTROLS */}
        {editMode === 'basic' && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Basic Tone & Color Adjustments
              </span>
              <button
                onClick={resetLight}
                title="Reset basic sliders"
                className="text-slate-500 hover:text-slate-300 p-0.5 text-xs flex items-center gap-1"
              >
                <ResetIcon className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Exposure */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-medium">Exposure</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.exposure > 0
                      ? `+${adjustments.exposure.toFixed(2)} EV`
                      : `${adjustments.exposure.toFixed(2)} EV`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="0.05"
                  value={adjustments.exposure}
                  onDoubleClick={() => updateField('exposure', 0, 'Reset Exposure')}
                  onChange={(e) => updateField('exposure', parseFloat(e.target.value), 'Exposure')}
                  className="w-full"
                />
              </div>

              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-medium">Contrast</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.contrast > 0 ? `+${adjustments.contrast}` : adjustments.contrast}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.contrast}
                  onDoubleClick={() => updateField('contrast', 0, 'Reset Contrast')}
                  onChange={(e) => updateField('contrast', parseInt(e.target.value, 10), 'Contrast')}
                  className="w-full"
                />
              </div>

              {/* Highlights */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-medium">Highlights</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.highlights > 0 ? `+${adjustments.highlights}` : adjustments.highlights}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.highlights}
                  onDoubleClick={() => updateField('highlights', 0, 'Reset Highlights')}
                  onChange={(e) => updateField('highlights', parseInt(e.target.value, 10), 'Highlights')}
                  className="w-full"
                />
              </div>

              {/* Shadows */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-medium">Shadows</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.shadows > 0 ? `+${adjustments.shadows}` : adjustments.shadows}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.shadows}
                  onDoubleClick={() => updateField('shadows', 0, 'Reset Shadows')}
                  onChange={(e) => updateField('shadows', parseInt(e.target.value, 10), 'Shadows')}
                  className="w-full"
                />
              </div>

              {/* Whites */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-medium">Whites</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.whites > 0 ? `+${adjustments.whites}` : adjustments.whites}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.whites}
                  onDoubleClick={() => updateField('whites', 0, 'Reset Whites')}
                  onChange={(e) => updateField('whites', parseInt(e.target.value, 10), 'Whites')}
                  className="w-full"
                />
              </div>

              {/* Blacks */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-medium">Blacks</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.blacks > 0 ? `+${adjustments.blacks}` : adjustments.blacks}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.blacks}
                  onDoubleClick={() => updateField('blacks', 0, 'Reset Blacks')}
                  onChange={(e) => updateField('blacks', parseInt(e.target.value, 10), 'Blacks')}
                  className="w-full"
                />
              </div>

              {/* Temperature */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-medium">Temperature</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.temperature > 0 ? `+${adjustments.temperature}` : adjustments.temperature}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.temperature}
                  onDoubleClick={() => updateField('temperature', 0, 'Reset Temp')}
                  onChange={(e) => updateField('temperature', parseInt(e.target.value, 10), 'Temperature')}
                  className="w-full"
                />
              </div>

              {/* Tint */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-medium">Tint</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.tint > 0 ? `+${adjustments.tint}` : adjustments.tint}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.tint}
                  onDoubleClick={() => updateField('tint', 0, 'Reset Tint')}
                  onChange={(e) => updateField('tint', parseInt(e.target.value, 10), 'Tint')}
                  className="w-full"
                />
              </div>

              {/* Vibrance */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-medium">Vibrance</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.vibrance > 0 ? `+${adjustments.vibrance}` : adjustments.vibrance}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.vibrance}
                  onDoubleClick={() => updateField('vibrance', 0, 'Reset Vibrance')}
                  onChange={(e) => updateField('vibrance', parseInt(e.target.value, 10), 'Vibrance')}
                  className="w-full"
                />
              </div>

              {/* Saturation */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-medium">Saturation</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.saturation > 0 ? `+${adjustments.saturation}` : adjustments.saturation}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.saturation}
                  onDoubleClick={() => updateField('saturation', 0, 'Reset Saturation')}
                  onChange={(e) => updateField('saturation', parseInt(e.target.value, 10), 'Saturation')}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* ADVANCED MODE CONTROLS */}
        {editMode === 'advanced' && (
          <>
        {/* 1. LIGHT & EXPOSURE PANEL */}
        <div className="pt-2 first:pt-0 space-y-3">
          <div
            onClick={() => toggleSection('light')}
            className="flex items-center justify-between cursor-pointer group"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-200 group-hover:text-white">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              Light & Exposure
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resetLight();
                }}
                title="Reset light adjustments"
                className="text-slate-500 hover:text-slate-300 p-0.5"
              >
                <ResetIcon className="w-3 h-3" />
              </button>
              {openSections.light ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </div>
          </div>

          {openSections.light && (
            <div className="space-y-2.5 text-xs">
              {/* Exposure */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Exposure</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.exposure > 0
                      ? `+${adjustments.exposure.toFixed(2)} EV`
                      : `${adjustments.exposure.toFixed(2)} EV`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="0.05"
                  value={adjustments.exposure}
                  onDoubleClick={() => updateField('exposure', 0, 'Reset Exposure')}
                  onChange={(e) => updateField('exposure', parseFloat(e.target.value), 'Exposure')}
                  className="w-full"
                />
              </div>

              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Contrast</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.contrast > 0 ? `+${adjustments.contrast}` : adjustments.contrast}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.contrast}
                  onDoubleClick={() => updateField('contrast', 0, 'Reset Contrast')}
                  onChange={(e) => updateField('contrast', parseInt(e.target.value, 10), 'Contrast')}
                  className="w-full"
                />
              </div>

              {/* Highlights */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Highlights</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.highlights > 0 ? `+${adjustments.highlights}` : adjustments.highlights}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.highlights}
                  onDoubleClick={() => updateField('highlights', 0, 'Reset Highlights')}
                  onChange={(e) => updateField('highlights', parseInt(e.target.value, 10), 'Highlights')}
                  className="w-full"
                />
              </div>

              {/* Shadows */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Shadows</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.shadows > 0 ? `+${adjustments.shadows}` : adjustments.shadows}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.shadows}
                  onDoubleClick={() => updateField('shadows', 0, 'Reset Shadows')}
                  onChange={(e) => updateField('shadows', parseInt(e.target.value, 10), 'Shadows')}
                  className="w-full"
                />
              </div>

              {/* Whites */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Whites</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.whites > 0 ? `+${adjustments.whites}` : adjustments.whites}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.whites}
                  onDoubleClick={() => updateField('whites', 0, 'Reset Whites')}
                  onChange={(e) => updateField('whites', parseInt(e.target.value, 10), 'Whites')}
                  className="w-full"
                />
              </div>

              {/* Blacks */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Blacks</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.blacks > 0 ? `+${adjustments.blacks}` : adjustments.blacks}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.blacks}
                  onDoubleClick={() => updateField('blacks', 0, 'Reset Blacks')}
                  onChange={(e) => updateField('blacks', parseInt(e.target.value, 10), 'Blacks')}
                  className="w-full"
                />
              </div>

              {/* Temperature */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Temperature (Kelvin)</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.temperature > 0 ? `+${adjustments.temperature}` : adjustments.temperature}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.temperature}
                  onDoubleClick={() => updateField('temperature', 0, 'Reset Temp')}
                  onChange={(e) => updateField('temperature', parseInt(e.target.value, 10), 'Temperature')}
                  className="w-full"
                />
              </div>

              {/* Tint */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Tint</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.tint > 0 ? `+${adjustments.tint}` : adjustments.tint}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.tint}
                  onDoubleClick={() => updateField('tint', 0, 'Reset Tint')}
                  onChange={(e) => updateField('tint', parseInt(e.target.value, 10), 'Tint')}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* 2. COLOR & VIBRANCE PANEL */}
        <div className="pt-3 space-y-3">
          <div
            onClick={() => toggleSection('color')}
            className="flex items-center justify-between cursor-pointer group"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-200 group-hover:text-white">
              <Palette className="w-3.5 h-3.5 text-pink-400" />
              Color & Vibrance
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resetColor();
                }}
                title="Reset color adjustments"
                className="text-slate-500 hover:text-slate-300 p-0.5"
              >
                <ResetIcon className="w-3 h-3" />
              </button>
              {openSections.color ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </div>
          </div>

          {openSections.color && (
            <div className="space-y-2.5 text-xs">
              {/* Vibrance */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Vibrance (Protects skin)</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.vibrance > 0 ? `+${adjustments.vibrance}` : adjustments.vibrance}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.vibrance}
                  onDoubleClick={() => updateField('vibrance', 0, 'Reset Vibrance')}
                  onChange={(e) => updateField('vibrance', parseInt(e.target.value, 10), 'Vibrance')}
                  className="w-full"
                />
              </div>

              {/* Saturation */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Global Saturation</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.saturation > 0 ? `+${adjustments.saturation}` : adjustments.saturation}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.saturation}
                  onDoubleClick={() => updateField('saturation', 0, 'Reset Saturation')}
                  onChange={(e) => updateField('saturation', parseInt(e.target.value, 10), 'Saturation')}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. TONE CURVES (RGB & INDIVIDUAL CHANNELS) */}
        <div className="pt-3 space-y-3">
          <div
            onClick={() => toggleSection('curves')}
            className="flex items-center justify-between cursor-pointer group"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-200 group-hover:text-white">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              RGB Tone Curve
            </span>
            {openSections.curves ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>

          {openSections.curves && (
            <ToneCurveGraph
              curves={adjustments.toneCurves}
              onChange={(curves) => updateField('toneCurves', curves, 'Tone Curve Edit')}
            />
          )}
        </div>

        {/* 4. HSL COLOR MIXER (8 CHANNELS) */}
        <div className="pt-3 space-y-3">
          <div
            onClick={() => toggleSection('hsl')}
            className="flex items-center justify-between cursor-pointer group"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-200 group-hover:text-white">
              <CircleDot className="w-3.5 h-3.5 text-emerald-400" />
              HSL Color Mixer (8 Channels)
            </span>
            {openSections.hsl ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>

          {openSections.hsl && (
            <HSLMixerPanel
              mixer={adjustments.hslMixer}
              onChange={(mixer) => updateField('hslMixer', mixer, 'HSL Mixer Edit')}
            />
          )}
        </div>

        {/* 5. DETAIL & EFFECTS */}
        <div className="pt-3 space-y-3">
          <div
            onClick={() => toggleSection('detail')}
            className="flex items-center justify-between cursor-pointer group"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-200 group-hover:text-white">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Detail & Effects
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resetDetail();
                }}
                title="Reset detail adjustments"
                className="text-slate-500 hover:text-slate-300 p-0.5"
              >
                <ResetIcon className="w-3 h-3" />
              </button>
              {openSections.detail ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </div>
          </div>

          {openSections.detail && (
            <div className="space-y-2.5 text-xs">
              {/* Sharpening */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Sharpening</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.sharpening}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={adjustments.sharpening}
                  onDoubleClick={() => updateField('sharpening', 0, 'Reset Sharpening')}
                  onChange={(e) => updateField('sharpening', parseInt(e.target.value, 10), 'Sharpening')}
                  className="w-full"
                />
              </div>

              {/* Clarity */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Clarity</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.clarity > 0 ? `+${adjustments.clarity}` : adjustments.clarity}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.clarity}
                  onDoubleClick={() => updateField('clarity', 0, 'Reset Clarity')}
                  onChange={(e) => updateField('clarity', parseInt(e.target.value, 10), 'Clarity')}
                  className="w-full"
                />
              </div>

              {/* Vignette Amount */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Vignette Shading</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.vignette > 0 ? `+${adjustments.vignette}` : adjustments.vignette}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.vignette}
                  onDoubleClick={() => updateField('vignette', 0, 'Reset Vignette')}
                  onChange={(e) => updateField('vignette', parseInt(e.target.value, 10), 'Vignette')}
                  className="w-full"
                />
              </div>

              {/* Film Grain */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Film Grain</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.grain}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={adjustments.grain}
                  onDoubleClick={() => updateField('grain', 0, 'Reset Grain')}
                  onChange={(e) => updateField('grain', parseInt(e.target.value, 10), 'Grain')}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* 6. GEOMETRY, CROP & ROTATION */}
        <div className="pt-3 space-y-3">
          <div
            onClick={() => toggleSection('geometry')}
            className="flex items-center justify-between cursor-pointer group"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-200 group-hover:text-white">
              <CropIcon className="w-3.5 h-3.5 text-blue-400" />
              Crop & Geometry
            </span>
            {openSections.geometry ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>

          {openSections.geometry && (
            <div className="space-y-3 text-xs">
              {/* Crop Active Toggle */}
              <button
                onClick={() =>
                  updateField(
                    'crop',
                    { ...adjustments.crop, active: !adjustments.crop.active },
                    adjustments.crop.active ? 'Exit Crop' : 'Enter Crop'
                  )
                }
                className={`w-full py-1.5 px-3 rounded-md font-medium text-xs transition-colors flex items-center justify-center gap-1.5 ${
                  adjustments.crop.active
                    ? 'bg-violet-600 text-white'
                    : 'bg-[#151924] hover:bg-[#1f2536] text-slate-300 border border-[#232938]'
                }`}
              >
                <CropIcon className="w-3.5 h-3.5" />
                <span>{adjustments.crop.active ? 'Apply / Close Crop' : 'Crop Overlay Mode'}</span>
              </button>

              {/* Aspect Ratio Presets */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium">Crop Ratio</span>
                  <button
                    onClick={() => handleSetAspectRatio('reset')}
                    className={`font-mono text-[10px] transition-colors cursor-pointer ${
                      adjustments.crop.active
                        ? 'text-violet-400 hover:text-violet-300 underline font-semibold'
                        : 'text-slate-500 cursor-default'
                    }`}
                    title="Reset crop and restore original composition"
                  >
                    Reset Crop
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {CROP_ASPECT_RATIOS.map((item) => {
                    const isSelected =
                      adjustments.crop.active && adjustments.crop.aspectRatio === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleSetAspectRatio(item.key)}
                        title={`Select ${item.label} crop viewport`}
                        className={`py-1.5 px-2 text-[11px] rounded transition-colors font-medium text-center cursor-pointer ${
                          isSelected
                            ? 'bg-violet-600 text-white shadow-sm ring-1 ring-violet-400'
                            : 'bg-[#151924] hover:bg-[#1e2434] text-slate-300'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Rotation & Flip Controls */}
              <div className="flex items-center justify-between gap-1 pt-1">
                <button
                  onClick={() =>
                    updateField(
                      'crop',
                      {
                        ...adjustments.crop,
                        stepRotation: (adjustments.crop.stepRotation + 270) % 360,
                      },
                      'Rotate CCW'
                    )
                  }
                  title="Rotate 90° CCW"
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#141822] hover:bg-[#1e2434] border border-[#202738] rounded text-slate-300"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>-90°</span>
                </button>
                <button
                  onClick={() =>
                    updateField(
                      'crop',
                      {
                        ...adjustments.crop,
                        stepRotation: (adjustments.crop.stepRotation + 90) % 360,
                      },
                      'Rotate CW'
                    )
                  }
                  title="Rotate 90° CW"
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#141822] hover:bg-[#1e2434] border border-[#202738] rounded text-slate-300"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>+90°</span>
                </button>
                <button
                  onClick={() =>
                    updateField(
                      'crop',
                      { ...adjustments.crop, flipH: !adjustments.crop.flipH },
                      'Flip H'
                    )
                  }
                  title="Flip Horizontal"
                  className={`p-1.5 bg-[#141822] hover:bg-[#1e2434] border border-[#202738] rounded ${
                    adjustments.crop.flipH ? 'text-violet-400 border-violet-600' : 'text-slate-300'
                  }`}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    updateField(
                      'crop',
                      { ...adjustments.crop, flipV: !adjustments.crop.flipV },
                      'Flip V'
                    )
                  }
                  title="Flip Vertical"
                  className={`p-1.5 bg-[#141822] hover:bg-[#1e2434] border border-[#202738] rounded ${
                    adjustments.crop.flipV ? 'text-violet-400 border-violet-600' : 'text-slate-300'
                  }`}
                >
                  <FlipVertical className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Fine Straighten Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Fine Straighten</span>
                  <span className="font-mono text-slate-300 tabular-nums">
                    {adjustments.crop.rotation}°
                  </span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  value={adjustments.crop.rotation}
                  onDoubleClick={() =>
                    updateField(
                      'crop',
                      { ...adjustments.crop, rotation: 0 },
                      'Reset Straighten'
                    )
                  }
                  onChange={(e) =>
                    updateField(
                      'crop',
                      { ...adjustments.crop, rotation: parseInt(e.target.value, 10) },
                      'Straighten'
                    )
                  }
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* 7. LOCAL MASKS (RADIAL, LINEAR, BRUSH) */}
        <div className="pt-3 space-y-3">
          <div
            onClick={() => toggleSection('masks')}
            className="flex items-center justify-between cursor-pointer group"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-200 group-hover:text-white">
              <CircleDot className="w-3.5 h-3.5 text-violet-400" />
              Local Masks ({adjustments.masks.length})
            </span>
            {openSections.masks ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>

          {openSections.masks && (
            <div className="space-y-3 text-xs">
              {/* Subject & Background Segmentation */}
              <div className="space-y-1.5 p-2 rounded-lg bg-[#141824] border border-violet-900/40">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-violet-300 text-[11px] flex items-center gap-1">
                    <Wand2 className="w-3 h-3 text-violet-400" />
                    Smart Subject Masking
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">100% In-Browser</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => onGenerateAISubjectMask?.('ai-subject')}
                    disabled={isSegmenting}
                    className="py-1.5 px-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded font-medium flex items-center justify-center gap-1.5 text-[11px] shadow-sm transition-all disabled:opacity-50"
                  >
                    {isSegmenting ? (
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" />
                    )}
                    <span>Select Subject</span>
                  </button>

                  <button
                    onClick={() => onGenerateAISubjectMask?.('ai-background')}
                    disabled={isSegmenting}
                    className="py-1.5 px-2 bg-[#1c2232] hover:bg-[#252d42] border border-[#2c364e] text-slate-200 rounded font-medium flex items-center justify-center gap-1.5 text-[11px] transition-all disabled:opacity-50"
                  >
                    <Layers className="w-3.5 h-3.5 text-violet-400" />
                    <span>Select Background</span>
                  </button>
                </div>
              </div>

              {/* Standard Geometry Mask Buttons */}
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => handleAddMask('radial')}
                  className="py-1 px-1.5 bg-[#141822] hover:bg-[#1e2434] border border-[#202738] rounded text-slate-300 flex items-center justify-center gap-1 text-[11px]"
                >
                  <Plus className="w-3 h-3 text-violet-400" />
                  <span>Radial</span>
                </button>
                <button
                  onClick={() => handleAddMask('linear')}
                  className="py-1 px-1.5 bg-[#141822] hover:bg-[#1e2434] border border-[#202738] rounded text-slate-300 flex items-center justify-center gap-1 text-[11px]"
                >
                  <Plus className="w-3 h-3 text-violet-400" />
                  <span>Linear</span>
                </button>
                <button
                  onClick={() => handleAddMask('brush')}
                  className="py-1 px-1.5 bg-[#141822] hover:bg-[#1e2434] border border-[#202738] rounded text-slate-300 flex items-center justify-center gap-1 text-[11px]"
                >
                  <Plus className="w-3 h-3 text-violet-400" />
                  <span>Brush</span>
                </button>
              </div>

              {/* Mask List */}
              {adjustments.masks.length > 0 && (
                <div className="space-y-1.5">
                  {adjustments.masks.map((mask) => {
                    const isSelected = mask.id === activeMaskId;
                    return (
                      <div
                        key={mask.id}
                        onClick={() => setActiveMaskId(mask.id)}
                        className={`p-2 rounded-md border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-violet-950/40 border-violet-600 text-white'
                            : 'bg-[#141822] hover:bg-[#1c2230] border-[#202738] text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateMask(mask.id, { enabled: !mask.enabled });
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            {mask.enabled ? (
                              <Eye className="w-3.5 h-3.5 text-violet-400" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                            )}
                          </button>
                          <span className="truncate text-xs">{mask.name}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateMask(mask.id, { inverted: !mask.inverted });
                            }}
                            title="Invert mask"
                            className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                              mask.inverted ? 'bg-violet-700 text-white' : 'bg-[#1a202d] text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            Inv
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMask(mask.id);
                            }}
                            title="Delete mask"
                            className="p-1 text-slate-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Active Mask Adjustments & Refinements */}
              {activeMask && (
                <div className="p-2.5 rounded-lg bg-[#141824] border border-[#232938] space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[#202738] pb-1.5">
                    <span className="text-xs font-semibold text-violet-300 truncate">
                      {activeMask.name}
                    </span>
                    {/* Mask Preview Overlay Toggle */}
                    <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeMask.showOverlay !== false}
                        onChange={(e) =>
                          handleUpdateMask(activeMask.id, { showOverlay: e.target.checked })
                        }
                        className="rounded accent-violet-600"
                      />
                      <span>Show Overlay</span>
                    </label>
                  </div>

                  {/* Mask Refinement Controls for AI Bitmap Masks */}
                  {(activeMask.type === 'ai-subject' || activeMask.type === 'ai-background' || activeMask.maskBitmap) && (
                    <div className="p-2 rounded bg-[#0f121a] border border-[#1e2434] space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Brush Refinement</span>
                        {activeMask.refineStrokes && activeMask.refineStrokes.length > 0 && (
                          <button
                            onClick={() => handleUpdateMask(activeMask.id, { refineStrokes: [] })}
                            className="text-[10px] text-slate-500 hover:text-red-400"
                          >
                            Clear strokes ({activeMask.refineStrokes.length})
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => handleUpdateMask(activeMask.id, { refineMode: 'none' })}
                          className={`py-1 rounded text-[10px] font-medium transition-colors ${
                            !activeMask.refineMode || activeMask.refineMode === 'none'
                              ? 'bg-violet-700 text-white'
                              : 'bg-[#181d2a] text-slate-400 hover:text-white'
                          }`}
                        >
                          Off
                        </button>
                        <button
                          onClick={() => handleUpdateMask(activeMask.id, { refineMode: 'add', showOverlay: true })}
                          className={`py-1 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition-colors ${
                            activeMask.refineMode === 'add'
                              ? 'bg-violet-700 text-white'
                              : 'bg-[#181d2a] text-slate-400 hover:text-white'
                          }`}
                        >
                          <Brush className="w-3 h-3 text-emerald-400" />
                          <span>Add</span>
                        </button>
                        <button
                          onClick={() => handleUpdateMask(activeMask.id, { refineMode: 'erase', showOverlay: true })}
                          className={`py-1 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition-colors ${
                            activeMask.refineMode === 'erase'
                              ? 'bg-violet-700 text-white'
                              : 'bg-[#181d2a] text-slate-400 hover:text-white'
                          }`}
                        >
                          <Eraser className="w-3 h-3 text-red-400" />
                          <span>Erase</span>
                        </button>
                      </div>

                      {activeMask.refineMode && activeMask.refineMode !== 'none' && (
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>Brush Size</span>
                            <span className="font-mono text-slate-300">
                              {Math.round((activeMask.refineRadius || 0.06) * 200)} px
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.02"
                            max="0.18"
                            step="0.01"
                            value={activeMask.refineRadius || 0.06}
                            onChange={(e) =>
                              handleUpdateMask(activeMask.id, {
                                refineRadius: parseFloat(e.target.value),
                              })
                            }
                            className="w-full"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Local Exposure */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Local Exposure</span>
                      <span className="font-mono text-slate-300 tabular-nums">
                        {activeMask.adjustments.exposure > 0
                          ? `+${activeMask.adjustments.exposure.toFixed(2)} EV`
                          : `${activeMask.adjustments.exposure.toFixed(2)} EV`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-3"
                      max="3"
                      step="0.05"
                      value={activeMask.adjustments.exposure}
                      onChange={(e) =>
                        handleUpdateMask(activeMask.id, {
                          adjustments: {
                            ...activeMask.adjustments,
                            exposure: parseFloat(e.target.value),
                          },
                        })
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Local Contrast */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Local Contrast</span>
                      <span className="font-mono text-slate-300 tabular-nums">
                        {activeMask.adjustments.contrast > 0
                          ? `+${activeMask.adjustments.contrast}`
                          : activeMask.adjustments.contrast}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={activeMask.adjustments.contrast}
                      onChange={(e) =>
                        handleUpdateMask(activeMask.id, {
                          adjustments: {
                            ...activeMask.adjustments,
                            contrast: parseInt(e.target.value, 10),
                          },
                        })
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Local Saturation */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Local Saturation</span>
                      <span className="font-mono text-slate-300 tabular-nums">
                        {activeMask.adjustments.saturation > 0
                          ? `+${activeMask.adjustments.saturation}`
                          : activeMask.adjustments.saturation}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={activeMask.adjustments.saturation}
                      onChange={(e) =>
                        handleUpdateMask(activeMask.id, {
                          adjustments: {
                            ...activeMask.adjustments,
                            saturation: parseInt(e.target.value, 10),
                          },
                        })
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Local Temperature */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Local Warmth</span>
                      <span className="font-mono text-slate-300 tabular-nums">
                        {activeMask.adjustments.temperature > 0
                          ? `+${activeMask.adjustments.temperature}`
                          : activeMask.adjustments.temperature}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={activeMask.adjustments.temperature}
                      onChange={(e) =>
                        handleUpdateMask(activeMask.id, {
                          adjustments: {
                            ...activeMask.adjustments,
                            temperature: parseInt(e.target.value, 10),
                          },
                        })
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </aside>
  );
};
