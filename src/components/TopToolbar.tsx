import React from 'react';
import {
  Undo2,
  Redo2,
  RotateCcw,
  Layers,
  Upload,
  Download,
  HelpCircle,
  Columns,
  SplitSquareVertical,
  Eye,
  Sliders,
  Eraser,
  Scissors,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { WorkspaceMode } from '../types/editor';

interface TopToolbarProps {
  workspaceMode: WorkspaceMode;
  onWorkspaceChange: (mode: WorkspaceMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onImportClick: () => void;
  onExportClick: () => void;
  onOpenBatch: () => void;
  onOpenShortcuts: () => void;
  comparisonMode: 'off' | 'split' | 'side-by-side';
  onComparisonChange: (mode: 'off' | 'split' | 'side-by-side') => void;
  isHoldingCompare: boolean;
  setIsHoldingCompare: (val: boolean) => void;
  hasImage: boolean;
  onHomeClick?: () => void;
  currentFilename?: string;
}

export const TopToolbar: React.FC<TopToolbarProps> = React.memo(({
  workspaceMode,
  onWorkspaceChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
  onImportClick,
  onExportClick,
  onOpenBatch,
  onOpenShortcuts,
  comparisonMode,
  onComparisonChange,
  isHoldingCompare,
  setIsHoldingCompare,
  hasImage,
  onHomeClick,
  currentFilename,
}) => {
  const workspaceTabs: { id: WorkspaceMode; label: string; icon: React.ReactNode }[] = [
    { id: 'develop', label: 'Develop', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'select', label: 'Select', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'remove', label: 'Remove', icon: <Eraser className="w-3.5 h-3.5" /> },
    { id: 'background', label: 'Background', icon: <Scissors className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="h-12 w-full bg-[#0e1117] border-b border-[#1b202c] px-3 sm:px-4 flex items-center justify-between gap-3 sm:gap-6 select-none shrink-0 z-30">
      {/* Zone 1: Brand Wordmark & Active Photo Filename */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          onClick={onHomeClick}
          title="Return to LumaForge Library & Gallery"
          className="flex items-center gap-2 shrink-0 group hover:opacity-90 transition-opacity cursor-pointer focus:outline-none"
        >
          <svg className="w-5 h-5 text-violet-400 group-hover:scale-105 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="9" strokeWidth="1.75" />
            <path d="M12 3v18M3 12h18" strokeWidth="1.2" strokeOpacity="0.3" />
            <polygon points="12,5 17,12 12,19 7,12" fill="currentColor" fillOpacity="0.25" strokeWidth="1.5" />
          </svg>
          <span className="text-sm font-bold tracking-tight text-white group-hover:text-violet-300 transition-colors whitespace-nowrap hidden sm:inline">
            LumaForge Studio
          </span>
        </button>

        {/* Workspace Mode Switcher Tabs */}
        <div className="flex items-center bg-[#141822] p-0.5 rounded-lg border border-[#232938]">
          {workspaceTabs.map((tab) => {
            const isActive = workspaceMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onWorkspaceChange(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1f2638]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {currentFilename && (
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#141822] border border-[#202738] text-[11px] font-mono text-slate-300 truncate max-w-[180px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="truncate">{currentFilename}</span>
          </div>
        )}
      </div>

      {/* Zone 2: Navigation & Quick Adjustment Controls (Single-line, no wrap) */}
      <div className="flex items-center gap-1 sm:gap-2 text-xs font-medium text-slate-300 overflow-x-auto no-scrollbar">
        {/* Undo / Redo */}
        <div className="flex items-center bg-[#151923] p-0.5 rounded-md border border-[#232938]">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={`p-1.5 rounded transition-colors ${
              canUndo ? 'hover:bg-[#202736] text-slate-200' : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className={`p-1.5 rounded transition-colors ${
              canRedo ? 'hover:bg-[#202736] text-slate-200' : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Before / After Comparison Modes */}
        {hasImage && (
          <div className="flex items-center bg-[#151923] p-0.5 rounded-md border border-[#232938]">
            <button
              onMouseDown={() => setIsHoldingCompare(true)}
              onMouseUp={() => setIsHoldingCompare(false)}
              onMouseLeave={() => setIsHoldingCompare(false)}
              onTouchStart={() => setIsHoldingCompare(true)}
              onTouchEnd={() => setIsHoldingCompare(false)}
              title="Hold to preview Original photo (\ key)"
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors whitespace-nowrap ${
                isHoldingCompare ? 'bg-violet-700 text-white' : 'hover:bg-[#202736] text-slate-300'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Hold Original</span>
            </button>
            <button
              onClick={() => onComparisonChange(comparisonMode === 'split' ? 'off' : 'split')}
              title="Split View comparison"
              className={`p-1 rounded transition-colors ${
                comparisonMode === 'split' ? 'bg-violet-700 text-white' : 'hover:bg-[#202736] text-slate-300'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onComparisonChange(comparisonMode === 'side-by-side' ? 'off' : 'side-by-side')}
              title="Side-by-Side comparison"
              className={`p-1 rounded transition-colors ${
                comparisonMode === 'side-by-side' ? 'bg-violet-700 text-white' : 'hover:bg-[#202736] text-slate-300'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Reset All */}
        {hasImage && (
          <button
            onClick={onReset}
            title="Reset all adjustments to original"
            className="flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-slate-200 hover:bg-[#1a202c] rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden md:inline">Reset</span>
          </button>
        )}

        {/* Batch Editing Modal */}
        <button
          onClick={onOpenBatch}
          title="Batch Edit & Export Multiple Photos"
          className="flex items-center gap-1 px-2.5 py-1 text-slate-300 hover:text-white hover:bg-[#1a202c] rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <Layers className="w-3.5 h-3.5 text-violet-400" />
          <span className="hidden sm:inline">Batch</span>
        </button>

        {/* Keyboard Shortcuts */}
        <button
          onClick={onOpenShortcuts}
          title="Keyboard shortcuts"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-[#1a202c] rounded-md transition-colors shrink-0"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Zone 3: Primary Action & Import */}
      <div className="flex items-center gap-2 shrink-0">
        <PWAInstallButton />

        <button
          onClick={onImportClick}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#161b26] hover:bg-[#202738] border border-[#2b3348] rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <Upload className="w-3.5 h-3.5 text-violet-400" />
          <span className="hidden sm:inline">Import</span>
        </button>

        <button
          onClick={onExportClick}
          disabled={!hasImage}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md shadow-sm transition-all whitespace-nowrap shrink-0 ${
            hasImage
              ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-950/40'
              : 'bg-[#1b202c] text-slate-500 cursor-not-allowed'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
});
