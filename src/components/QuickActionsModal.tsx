import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Sliders,
  Layers,
  Eraser,
  Scissors,
  Crop,
  Sparkles,
  Sun,
  Palette,
  Maximize2,
  Eye,
  Download,
  Upload,
  Camera,
  History,
  HelpCircle,
  FolderOpen,
  X,
  ArrowRight,
  Command,
} from 'lucide-react';
import { BUILT_IN_PRESETS } from '../presets/builtInPresets';
import { WorkspaceMode } from '../types/editor';

export interface QuickActionItem {
  id: string;
  title: string;
  description: string;
  category: 'Workspace' | 'Adjustment' | 'Tool' | 'Preset' | 'Action';
  icon: React.ReactNode;
  synonyms: string[];
  shortcut?: string;
  perform: () => void;
}

interface QuickActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkspace: (mode: WorkspaceMode) => void;
  onOpenSection: (sectionKey: string) => void;
  onApplyPresetById: (presetId: string) => void;
  onTriggerAction: (actionKey: 'import' | 'export' | 'batch' | 'shortcuts' | 'reset' | 'fit' | '100%' | 'compare' | 'snapshot' | 'focus') => void;
}

export const QuickActionsModal: React.FC<QuickActionsModalProps> = ({
  isOpen,
  onClose,
  onSelectWorkspace,
  onOpenSection,
  onApplyPresetById,
  onTriggerAction,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Comprehensive catalog of all studio actions, adjustments, workspaces, presets, and tools
  const allActions = useMemo<QuickActionItem[]>(() => {
    const list: QuickActionItem[] = [
      // Workspaces & Modes
      {
        id: 'ws-develop',
        title: 'Develop Studio',
        description: 'Standard color, light, tone curves, and optics editing workspace',
        category: 'Workspace',
        icon: <Sliders className="w-4 h-4 text-indigo-400" />,
        synonyms: ['develop', 'edit', 'adjustments', 'inspector', 'darkroom', 'raw'],
        shortcut: 'D',
        perform: () => {
          onSelectWorkspace('develop');
          onClose();
        },
      },
      {
        id: 'ws-select',
        title: 'Select People & Subject Tool',
        description: 'AI person segmentation, brush, lasso, polygon, and color-range selection',
        category: 'Workspace',
        icon: <Layers className="w-4 h-4 text-purple-400" />,
        synonyms: ['select', 'person', 'people', 'subject', 'lasso', 'wand', 'brush selection', 'cutout', 'segmentation'],
        shortcut: 'S',
        perform: () => {
          onSelectWorkspace('select');
          onClose();
        },
      },
      {
        id: 'ws-remove',
        title: 'AI Object & Watermark Remover',
        description: 'Remove unwanted objects, blemishes, text, and watermarks seamlessly',
        category: 'Workspace',
        icon: <Eraser className="w-4 h-4 text-rose-400" />,
        synonyms: ['remove', 'eraser', 'object removal', 'watermark', 'blemish', 'spot heal', 'retouch', 'clean up', 'inpainting'],
        shortcut: 'R',
        perform: () => {
          onSelectWorkspace('remove');
          onClose();
        },
      },
      {
        id: 'ws-background',
        title: 'AI Background Remover & Compositor',
        description: 'Isolate subjects, create transparent PNGs, blur or replace photo backgrounds',
        category: 'Workspace',
        icon: <Scissors className="w-4 h-4 text-sky-400" />,
        synonyms: ['background', 'bg removal', 'transparent', 'cutout', 'blur background', 'replace background', 'green screen'],
        shortcut: 'B',
        perform: () => {
          onSelectWorkspace('background');
          onClose();
        },
      },

      // Adjustments & Inspector Sections
      {
        id: 'sec-light',
        title: 'Light Adjustments',
        description: 'Exposure, Contrast, Highlights, Shadows, Whites, Blacks, Temp & Tint',
        category: 'Adjustment',
        icon: <Sun className="w-4 h-4 text-amber-400" />,
        synonyms: ['light', 'exposure', 'brightness', 'contrast', 'highlights', 'shadows', 'whites', 'blacks', 'temperature', 'white balance', 'tint'],
        perform: () => {
          onSelectWorkspace('develop');
          onOpenSection('light');
          onClose();
        },
      },
      {
        id: 'sec-color',
        title: 'Color & Saturation',
        description: 'Vibrance and overall color saturation sliders',
        category: 'Adjustment',
        icon: <Palette className="w-4 h-4 text-pink-400" />,
        synonyms: ['color', 'saturation', 'vibrance', 'intensity', 'chroma'],
        perform: () => {
          onSelectWorkspace('develop');
          onOpenSection('color');
          onClose();
        },
      },
      {
        id: 'sec-curves',
        title: 'RGB Tone Curves',
        description: 'Precision parametric tone curve graph with Red, Green, Blue channel editing',
        category: 'Adjustment',
        icon: <Sparkles className="w-4 h-4 text-violet-400" />,
        synonyms: ['curves', 'tone curve', 'rgb curve', 'contrast curve', 's-curve', 'levels', 'red curve', 'green curve', 'blue curve'],
        perform: () => {
          onSelectWorkspace('develop');
          onOpenSection('curves');
          onClose();
        },
      },
      {
        id: 'sec-hsl',
        title: 'Color Mixer (8-Channel HSL)',
        description: 'Hue, Saturation, and Luminance tuning for 8 individual color bands',
        category: 'Adjustment',
        icon: <Palette className="w-4 h-4 text-emerald-400" />,
        synonyms: ['hsl', 'color mixer', 'hue', 'saturation', 'luminance', 'skin tone', 'foliage', 'blues', 'channel mixer'],
        perform: () => {
          onSelectWorkspace('develop');
          onOpenSection('hsl');
          onClose();
        },
      },
      {
        id: 'sec-grading',
        title: 'Color Grading (Split Toning)',
        description: 'Color wheels for Shadows, Midtones, Highlights with Blending and Balance',
        category: 'Adjustment',
        icon: <Palette className="w-4 h-4 text-cyan-400" />,
        synonyms: ['color grading', 'split toning', 'wheels', 'shadows tint', 'highlights tint', 'teal and orange', 'cinematic grade'],
        perform: () => {
          onSelectWorkspace('develop');
          onOpenSection('grading');
          onClose();
        },
      },
      {
        id: 'sec-detail',
        title: 'Detail, Sharpening & Noise Reduction',
        description: 'Unsharp masking, luminance noise reduction, color noise suppression',
        category: 'Adjustment',
        icon: <Sparkles className="w-4 h-4 text-teal-400" />,
        synonyms: ['detail', 'sharpen', 'sharpening', 'noise', 'noise reduction', 'denoise', 'grain cleanup', 'texture', 'radius', 'masking'],
        perform: () => {
          onSelectWorkspace('develop');
          onOpenSection('detail');
          onClose();
        },
      },
      {
        id: 'sec-effects',
        title: 'Effects (Vignette, Grain & Dehaze)',
        description: 'Organic film grain simulation, post-crop vignette, and atmospheric dehaze',
        category: 'Adjustment',
        icon: <Sun className="w-4 h-4 text-amber-300" />,
        synonyms: ['effects', 'vignette', 'grain', 'film grain', 'dehaze', 'haze', 'clarity', 'matte'],
        perform: () => {
          onSelectWorkspace('develop');
          onOpenSection('effects');
          onClose();
        },
      },
      {
        id: 'sec-optics',
        title: 'Optics & Lens Corrections',
        description: 'Barrel/pincushion distortion correction and chromatic aberration defringe',
        category: 'Adjustment',
        icon: <Eye className="w-4 h-4 text-blue-400" />,
        synonyms: ['optics', 'distortion', 'lens', 'lens correction', 'chromatic aberration', 'fringing', 'defringe', 'vignette correction'],
        perform: () => {
          onSelectWorkspace('develop');
          onOpenSection('optics');
          onClose();
        },
      },
      {
        id: 'sec-crop',
        title: 'Crop & Aspect Ratio Tool',
        description: 'Crop overlays, rule-of-thirds grid, 1:1, 16:9, 4:5, 3:2, 2:1 ratios, and rotation',
        category: 'Tool',
        icon: <Crop className="w-4 h-4 text-orange-400" />,
        synonyms: ['crop', 'aspect ratio', 'rotate', 'flip', 'straighten', 'frame', 'proportions', 'dimensions'],
        shortcut: 'C',
        perform: () => {
          onSelectWorkspace('develop');
          onOpenSection('geometry');
          onClose();
        },
      },

      // Studio Actions
      {
        id: 'act-fit',
        title: 'Fit Image to Screen',
        description: 'Adjust zoom scale so the entire photo fits comfortably in the viewport',
        category: 'Action',
        icon: <Maximize2 className="w-4 h-4 text-slate-300" />,
        synonyms: ['fit', 'fit to screen', 'zoom fit', 'full view', 'reset zoom'],
        shortcut: '0',
        perform: () => {
          onTriggerAction('fit');
          onClose();
        },
      },
      {
        id: 'act-100',
        title: 'Zoom to 100% (Actual Pixels)',
        description: 'Inspect full pixel sharpness at 1:1 scale',
        category: 'Action',
        icon: <Maximize2 className="w-4 h-4 text-slate-300" />,
        synonyms: ['100%', 'actual size', '1:1', 'pixel peeping', 'zoom 100'],
        shortcut: '1',
        perform: () => {
          onTriggerAction('100%');
          onClose();
        },
      },
      {
        id: 'act-focus',
        title: 'Toggle Focus Mode (Full Screen)',
        description: 'Collapse all toolbars and sidebars for an immersive canvas experience',
        category: 'Action',
        icon: <Maximize2 className="w-4 h-4 text-indigo-400" />,
        synonyms: ['focus', 'fullscreen', 'immersive', 'hide sidebars', 'zen mode', 'canvas only'],
        shortcut: 'F',
        perform: () => {
          onTriggerAction('focus');
          onClose();
        },
      },
      {
        id: 'act-compare',
        title: 'Toggle Before / After Split View',
        description: 'Compare current adjustments against the unedited original photo',
        category: 'Action',
        icon: <Eye className="w-4 h-4 text-violet-300" />,
        synonyms: ['compare', 'split view', 'before after', 'original', 'difference', 'side by side'],
        shortcut: '\\',
        perform: () => {
          onTriggerAction('compare');
          onClose();
        },
      },
      {
        id: 'act-snapshot',
        title: 'Create Snapshot',
        description: 'Save current edit parameters as a named checkpoint in history',
        category: 'Action',
        icon: <Camera className="w-4 h-4 text-emerald-400" />,
        synonyms: ['snapshot', 'save state', 'checkpoint', 'bookmark', 'version'],
        perform: () => {
          onTriggerAction('snapshot');
          onClose();
        },
      },
      {
        id: 'act-reset',
        title: 'Reset All Adjustments',
        description: 'Revert all sliders and curves back to original default settings',
        category: 'Action',
        icon: <History className="w-4 h-4 text-rose-400" />,
        synonyms: ['reset', 'revert', 'clear adjustments', 'start over', 'undo all'],
        perform: () => {
          onTriggerAction('reset');
          onClose();
        },
      },
      {
        id: 'act-import',
        title: 'Import Photo...',
        description: 'Open a local RAW, JPEG, PNG, or WebP photo from your computer',
        category: 'Action',
        icon: <Upload className="w-4 h-4 text-violet-400" />,
        synonyms: ['import', 'open', 'load', 'upload', 'new photo', 'file open'],
        shortcut: 'Cmd+O',
        perform: () => {
          onTriggerAction('import');
          onClose();
        },
      },
      {
        id: 'act-export',
        title: 'Export Studio Master...',
        description: 'Export high-resolution JPEG, PNG, or WebP with custom quality and resizing',
        category: 'Action',
        icon: <Download className="w-4 h-4 text-emerald-400" />,
        synonyms: ['export', 'save', 'download', 'render', 'save image', 'jpeg export'],
        shortcut: 'Cmd+E',
        perform: () => {
          onTriggerAction('export');
          onClose();
        },
      },
      {
        id: 'act-batch',
        title: 'Batch Processing Studio...',
        description: 'Apply current color grade and export multiple photos simultaneously',
        category: 'Action',
        icon: <Layers className="w-4 h-4 text-indigo-400" />,
        synonyms: ['batch', 'batch edit', 'batch export', 'multiple photos', 'sync adjustments'],
        perform: () => {
          onTriggerAction('batch');
          onClose();
        },
      },
      {
        id: 'act-shortcuts',
        title: 'Keyboard Shortcuts Reference',
        description: 'View all keyboard shortcuts and professional editing workflow hotkeys',
        category: 'Action',
        icon: <HelpCircle className="w-4 h-4 text-slate-300" />,
        synonyms: ['shortcuts', 'hotkeys', 'keys', 'help', 'keyboard'],
        shortcut: '?',
        perform: () => {
          onTriggerAction('shortcuts');
          onClose();
        },
      },
    ];

    // Add Built-in Presets to the command palette
    BUILT_IN_PRESETS.forEach((preset) => {
      list.push({
        id: `preset-${preset.id}`,
        title: `Preset: ${preset.name}`,
        description: `${preset.category.toUpperCase()} · ${preset.description}`,
        category: 'Preset',
        icon: <Sparkles className="w-4 h-4 text-violet-400" />,
        synonyms: [
          'preset',
          'look',
          'filter',
          preset.name.toLowerCase(),
          preset.category.toLowerCase(),
          ...preset.description.toLowerCase().split(/\s+/),
        ],
        perform: () => {
          onApplyPresetById(preset.id);
          onClose();
        },
      });
    });

    return list;
  }, [onSelectWorkspace, onOpenSection, onApplyPresetById, onTriggerAction, onClose]);

  // Filter actions by query
  const filteredActions = useMemo(() => {
    if (!query.trim()) {
      // Default: show Workspaces, key Tools, Adjustments, and Studio Actions
      return allActions.filter((a) => a.category !== 'Preset').slice(0, 14);
    }
    const q = query.toLowerCase().trim();
    return allActions.filter((action) => {
      if (action.title.toLowerCase().includes(q)) return true;
      if (action.description.toLowerCase().includes(q)) return true;
      if (action.category.toLowerCase().includes(q)) return true;
      return action.synonyms.some((syn) => syn.includes(q));
    });
  }, [allActions, query]);

  // Handle keyboard navigation within the modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1 < filteredActions.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredActions.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredActions[selectedIndex]) {
          filteredActions[selectedIndex].perform();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredActions, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-start justify-center pt-16 sm:pt-24 px-4 transition-all"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#11141c] border border-[#222938] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in fade-in zoom-in-95 duration-100"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#222938] bg-[#161a24]">
          <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search tools, adjustments, presets, or actions... (e.g., curves, exposure, remove, portrait)"
            className="w-full bg-transparent text-sm text-[#f8fafc] placeholder-[#64748b] focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-white rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-[#0c0e14] px-2 py-0.5 rounded border border-[#222938] shrink-0">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          )}
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredActions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Search className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
              <div className="text-sm font-medium text-slate-300">No matching tools or presets</div>
              <div className="text-xs text-slate-500">
                Try searching for "curves", "saturation", "remove", "fit", "grain", or "black & white"
              </div>
            </div>
          ) : (
            filteredActions.map((action, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={action.id}
                  onClick={() => action.perform()}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-left transition-all ${
                    isSelected
                      ? 'bg-indigo-600/15 border border-indigo-500/40 text-white'
                      : 'hover:bg-[#161a24] text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-md shrink-0 ${
                        isSelected ? 'bg-indigo-600/30' : 'bg-[#161a24] border border-[#222938]'
                      }`}
                    >
                      {action.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#f8fafc] truncate">
                          {action.title}
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 bg-[#161a24] px-1.5 py-0.5 rounded border border-[#222938]">
                          {action.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {action.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {action.shortcut && (
                      <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-[#0c0e14] border border-[#222938] rounded">
                        {action.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-2 border-t border-[#222938] bg-[#0c0e14] flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span className="text-slate-400">LumaForge Obsidian Studio</span>
        </div>
      </div>
    </div>
  );
};
