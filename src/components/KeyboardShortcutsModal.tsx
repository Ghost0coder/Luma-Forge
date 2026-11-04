import React from 'react';
import { X, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '⌘K / Ctrl+K', desc: 'Quick Actions Command Palette' },
    { key: 'F', desc: 'Toggle Focus Mode (Fullscreen Canvas)' },
    { key: '\\ (Backslash)', desc: 'Hold to preview original unedited photo' },
    { key: 'Ctrl + Z / ⌘Z', desc: 'Undo last adjustment' },
    { key: 'Ctrl + Y / ⌘⇧Z', desc: 'Redo adjustment' },
    { key: '0 / 1 / 2', desc: 'Zoom: Fit to screen / 100% / 200%' },
    { key: 'Space + Drag', desc: 'Pan around zoomed image canvas' },
    { key: 'Mouse Wheel', desc: 'Smooth zoom in / zoom out' },
    { key: 'Double Click Slider', desc: 'Instantly reset slider to neutral zero' },
    { key: 'D / S / R / B', desc: 'Switch modes: Develop / Select / Remove / Background' },
    { key: 'C', desc: 'Toggle crop & geometry tool overlay' },
    { key: 'O', desc: 'Toggle mask preview overlay' },
    { key: 'Tab', desc: 'Toggle sidebars for distraction-free view' },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 select-none animate-in fade-in duration-100"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#11141c] border border-[#222938] rounded-xl shadow-2xl overflow-hidden text-slate-200"
      >
        <div className="px-5 py-4 border-b border-[#222938] bg-[#161a24] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#11141c] border border-[#222938] text-indigo-400">
              <Command className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#f8fafc]">Studio Shortcuts</h3>
              <p className="text-[11px] text-slate-400">Professional editing keyboard hotkeys</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1c2230] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-1 text-xs max-h-[60vh] overflow-y-auto">
          {shortcuts.map((sc, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-[#161a24] transition-colors"
            >
              <span className="text-slate-300">{sc.desc}</span>
              <kbd className="px-2 py-0.5 rounded-md bg-[#0c0e14] border border-[#222938] font-mono text-[11px] text-indigo-300 font-semibold shadow-sm shrink-0 ml-3">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[#222938] bg-[#0c0e14] flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-400">LumaForge Obsidian Studio</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
