import React, { useState, useRef, useEffect } from 'react';
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
  Search,
  Command,
  MoreHorizontal,
  Edit3,
  Check,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { WorkspaceMode } from '../types/editor';

export type WorkspaceLayout = 'editing' | 'color-grading' | 'retouching' | 'minimal';

interface TopToolbarProps {
  workspaceMode: WorkspaceMode;
  onWorkspaceChange: (mode: WorkspaceMode) => void;
  workspaceLayout?: WorkspaceLayout;
  onWorkspaceLayoutChange?: (layout: WorkspaceLayout) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onImportClick: () => void;
  onExportClick: () => void;
  onOpenBatch: () => void;
  onOpenShortcuts: () => void;
  onOpenQuickActions?: () => void;
  comparisonMode: 'off' | 'split' | 'side-by-side';
  onComparisonChange: (mode: 'off' | 'split' | 'side-by-side') => void;
  isHoldingCompare: boolean;
  setIsHoldingCompare: (val: boolean) => void;
  hasImage: boolean;
  onHomeClick?: () => void;
  currentFilename?: string;
  onRenameFilename?: (name: string) => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = React.memo(({
  workspaceMode,
  onWorkspaceChange,
  workspaceLayout = 'editing',
  onWorkspaceLayoutChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onReset,
  onImportClick,
  onExportClick,
  onOpenBatch,
  onOpenShortcuts,
  onOpenQuickActions,
  comparisonMode,
  onComparisonChange,
  isHoldingCompare,
  setIsHoldingCompare,
  hasImage,
  onHomeClick,
  currentFilename,
  onRenameFilename,
}) => {
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement | null>(null);

  // Close overflow menu on click outside or escape key
  useEffect(() => {
    if (!isOverflowOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setIsOverflowOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOverflowOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOverflowOpen]);

  const workspaceTabs: { id: WorkspaceMode; label: string; icon: React.ReactNode }[] = [
    { id: 'develop', label: 'Develop', icon: <Sliders className="w-3.5 h-3.5" /> },
    { id: 'select', label: 'Select', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'remove', label: 'Remove', icon: <Eraser className="w-3.5 h-3.5" /> },
    { id: 'background', label: 'Background', icon: <Scissors className="w-3.5 h-3.5" /> },
  ];

  const layoutOptions: { id: WorkspaceLayout; label: string }[] = [
    { id: 'editing', label: 'Edit' },
    { id: 'color-grading', label: 'Color' },
    { id: 'retouching', label: 'Retouch' },
    { id: 'minimal', label: 'Minimal' },
  ];

  const handleFilenameClick = () => {
    if (!currentFilename) return;
    const newName = prompt('Rename project file:', currentFilename);
    if (newName && newName.trim()) {
      onRenameFilename?.(newName.trim());
    }
  };

  return (
    <header className="h-12 w-full bg-[#11141c] border-b border-[#222938] px-2.5 sm:px-3 md:px-4 flex items-center justify-between gap-1.5 sm:gap-2.5 select-none shrink-0 z-30 min-w-0 relative">
      {/* ZONE 1: BRANDING & COMPACT PROJECT FILENAME */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0">
        <button
          onClick={onHomeClick}
          title="Return to LumaForge Library & Gallery"
          className="flex items-center gap-2 shrink-0 group hover:opacity-90 transition-opacity cursor-pointer focus:outline-none"
        >
          <div className="w-7 h-7 rounded-lg bg-[#161a24] border border-[#222938] flex items-center justify-center text-indigo-400 group-hover:border-indigo-500/50 group-hover:text-indigo-300 transition-all shadow-sm shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="9" strokeWidth="1.75" />
              <path d="M12 3v18M3 12h18" strokeWidth="1.2" strokeOpacity="0.3" />
              <polygon points="12,5 17,12 12,19 7,12" fill="currentColor" fillOpacity="0.3" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="hidden sm:flex flex-col text-left shrink-0">
            <span className="text-xs font-bold tracking-tight text-[#f8fafc] group-hover:text-indigo-200 transition-colors uppercase leading-tight">
              LumaForge
            </span>
            <span className="hidden lg:inline text-[8px] font-mono tracking-widest text-slate-500 leading-none">
              OBSIDIAN STUDIO
            </span>
          </div>
        </button>

        {/* Shortened Project Filename & Persistent Saved Status */}
        {currentFilename && (
          <div className="flex items-center gap-1.5 pl-2 sm:pl-2.5 border-l border-[#222938] min-w-0 shrink">
            <button
              onClick={handleFilenameClick}
              title={`Project File: ${currentFilename}\nClick to rename file`}
              className="group flex items-center gap-1 min-w-0 max-w-[70px] sm:max-w-[95px] md:max-w-[125px] lg:max-w-[160px] xl:max-w-[200px] text-[11px] font-mono text-[#cbd5e1] hover:text-white transition-colors cursor-pointer text-left focus:outline-none"
            >
              <span className="truncate">{currentFilename}</span>
              <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-70 shrink-0 text-slate-400 transition-opacity" />
            </button>

            <div
              title="Session saved automatically to local IndexedDB"
              className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">Saved</span>
            </div>
          </div>
        )}
      </div>

      {/* ZONE 2: PRIMARY WORKSPACE MODES & CREATIVE CONTROLS */}
      <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 min-w-0">
        {/* Primary Workspace Modes (Develop, Select, Remove, Background) */}
        <nav
          aria-label="Workspace modes"
          className="flex items-center bg-[#0c0e14] p-0.5 rounded-lg border border-[#222938] shrink-0"
        >
          {workspaceTabs.map((tab) => {
            const isActive = workspaceMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onWorkspaceChange(tab.id)}
                title={`Switch to ${tab.label} workspace`}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a24]'
                }`}
              >
                {tab.icon}
                <span className="hidden lg:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Workspace Layout Selector (Edit, Color, Retouch, Minimal) */}
        {onWorkspaceLayoutChange && (
          <div className="hidden xl:flex items-center bg-[#0c0e14] p-0.5 rounded-lg border border-[#222938] shrink-0">
            {layoutOptions.map((opt) => {
              const isActive = workspaceLayout === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => onWorkspaceLayoutChange(opt.id)}
                  title={`Switch layout to ${opt.label} mode`}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#222938] text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a24]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Undo / Redo */}
        <div className="hidden md:flex items-center bg-[#0c0e14] p-0.5 rounded-lg border border-[#222938] shrink-0">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={`p-1.5 rounded-md transition-colors ${
              canUndo ? 'hover:bg-[#161a24] text-slate-200 cursor-pointer' : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className={`p-1.5 rounded-md transition-colors ${
              canRedo ? 'hover:bg-[#161a24] text-slate-200 cursor-pointer' : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Before / After Comparison Modes */}
        {hasImage && (
          <div className="hidden lg:flex items-center bg-[#0c0e14] p-0.5 rounded-lg border border-[#222938] shrink-0">
            <button
              onMouseDown={() => setIsHoldingCompare(true)}
              onMouseUp={() => setIsHoldingCompare(false)}
              onMouseLeave={() => setIsHoldingCompare(false)}
              onTouchStart={() => setIsHoldingCompare(true)}
              onTouchEnd={() => setIsHoldingCompare(false)}
              title="Hold to preview Original photo (\ key)"
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                isHoldingCompare ? 'bg-indigo-600 text-white' : 'hover:bg-[#161a24] text-slate-300'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden 2xl:inline text-[11px]">Compare</span>
            </button>
            <button
              onClick={() => onComparisonChange(comparisonMode === 'split' ? 'off' : 'split')}
              title="Split View comparison slider"
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                comparisonMode === 'split' ? 'bg-indigo-600 text-white' : 'hover:bg-[#161a24] text-slate-300'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onComparisonChange(comparisonMode === 'side-by-side' ? 'off' : 'side-by-side')}
              title="Side-by-Side comparison"
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                comparisonMode === 'side-by-side' ? 'bg-indigo-600 text-white' : 'hover:bg-[#161a24] text-slate-300'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Search Launcher (Cmd+K) */}
        {onOpenQuickActions && (
          <button
            onClick={onOpenQuickActions}
            title="Search tools, adjustments & presets (Cmd/Ctrl + K)"
            className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#161a24] hover:bg-[#1c2230] border border-[#222938] hover:border-slate-500 text-xs text-slate-400 hover:text-slate-200 transition-all cursor-pointer shrink-0"
          >
            <Search className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden 2xl:inline text-[11px] text-slate-400">Search</span>
            <div className="flex items-center gap-0.5 text-[10px] font-mono text-slate-400 bg-[#0c0e14] px-1 py-0.2 rounded border border-[#222938]">
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </div>
          </button>
        )}

        {/* Reset All */}
        {hasImage && (
          <button
            onClick={onReset}
            title="Reset all adjustments to default"
            className="hidden lg:flex items-center gap-1 px-2 py-1 text-slate-400 hover:text-rose-300 hover:bg-[#161a24] rounded-lg border border-transparent hover:border-[#222938] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden xl:inline text-[11px]">Reset</span>
          </button>
        )}

        {/* Batch Processing */}
        <button
          onClick={onOpenBatch}
          title="Batch Edit & Export Multiple Photos"
          className="hidden sm:flex items-center gap-1 px-2 py-1 text-slate-300 hover:text-white hover:bg-[#161a24] rounded-lg border border-[#222938] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden xl:inline text-xs">Batch</span>
        </button>

        {/* Keyboard Shortcuts (?) */}
        <button
          onClick={onOpenShortcuts}
          title="Keyboard shortcuts (? key)"
          className="hidden sm:flex p-1.5 text-slate-400 hover:text-white hover:bg-[#161a24] rounded-lg border border-[#222938] transition-colors shrink-0 cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>

        {/* Overflow Menu ("More / •••") for smaller resolutions */}
        <div className="relative" ref={overflowRef}>
          <button
            onClick={() => setIsOverflowOpen((prev) => !prev)}
            title="More workspace tools and options"
            aria-expanded={isOverflowOpen}
            aria-label="More tools and options"
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
              isOverflowOpen
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                : 'bg-[#141822] text-slate-300 hover:text-white hover:bg-[#1a202d] border-[#222938]'
            }`}
          >
            <MoreHorizontal className="w-4 h-4" />
            <span className="hidden md:inline text-xs font-medium">More</span>
          </button>

          {isOverflowOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-[#11141c] border border-[#222938] rounded-xl shadow-2xl p-2.5 z-50 text-xs text-slate-200 divide-y divide-[#222938] space-y-2 animate-in fade-in zoom-in-95 duration-100">
              {/* Workspace Layout Options */}
              {onWorkspaceLayoutChange && (
                <div className="space-y-1 pb-2">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 px-2 py-0.5">
                    Layout Views
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {layoutOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          onWorkspaceLayoutChange(opt.id);
                          setIsOverflowOpen(false);
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          workspaceLayout === opt.id
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-300 hover:bg-[#161a24] hover:text-white'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {workspaceLayout === opt.id && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Comparison Modes */}
              {hasImage && (
                <div className="space-y-1 pt-2 pb-2">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 px-2 py-0.5">
                    Compare
                  </div>
                  <button
                    onClick={() => {
                      onComparisonChange(comparisonMode === 'split' ? 'off' : 'split');
                      setIsOverflowOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      comparisonMode === 'split'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:bg-[#161a24] hover:text-white'
                    }`}
                  >
                    <SplitSquareVertical className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Split View Slider</span>
                    {comparisonMode === 'split' && <Check className="w-3 h-3 ml-auto" />}
                  </button>
                  <button
                    onClick={() => {
                      onComparisonChange(comparisonMode === 'side-by-side' ? 'off' : 'side-by-side');
                      setIsOverflowOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                      comparisonMode === 'side-by-side'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:bg-[#161a24] hover:text-white'
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Side-by-Side</span>
                    {comparisonMode === 'side-by-side' && <Check className="w-3 h-3 ml-auto" />}
                  </button>
                </div>
              )}

              {/* Utility Tools */}
              <div className="space-y-1 pt-2">
                <button
                  onClick={() => {
                    onOpenQuickActions?.();
                    setIsOverflowOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-[#161a24] hover:text-white transition-colors cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Quick Actions Search</span>
                  <span className="text-[10px] font-mono text-slate-500 ml-auto">⌘K</span>
                </button>

                <button
                  onClick={() => {
                    onOpenBatch();
                    setIsOverflowOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-[#161a24] hover:text-white transition-colors cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Batch Processing</span>
                </button>

                <button
                  onClick={() => {
                    onOpenShortcuts();
                    setIsOverflowOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-[#161a24] hover:text-white transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>Keyboard Shortcuts</span>
                  <span className="text-[10px] font-mono text-slate-500 ml-auto">?</span>
                </button>

                {hasImage && (
                  <button
                    onClick={() => {
                      if (confirm('Reset all adjustments to default?')) {
                        onReset();
                        setIsOverflowOpen(false);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                    <span>Reset All Adjustments</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ZONE 3: PRIMARY ACTIONS (IMPORT & EXPORT) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <PWAInstallButton />

        <button
          onClick={onImportClick}
          title="Import photo (JPEG, PNG, WebP)"
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#161a24] hover:bg-[#1c2230] border border-[#222938] hover:border-slate-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Import</span>
        </button>

        <button
          onClick={onExportClick}
          disabled={!hasImage}
          title={hasImage ? 'Export processed photo' : 'Import a photo to export'}
          className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            hasImage
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/40'
              : 'bg-[#161a24] text-slate-600 border border-[#222938] cursor-not-allowed'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
});
