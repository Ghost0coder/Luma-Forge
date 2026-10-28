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
    { key: '\\ (Backslash)', desc: 'Hold to preview original unedited photo' },
    { key: 'Ctrl + Z / ⌘Z', desc: 'Undo last adjustment' },
    { key: 'Ctrl + Y / ⌘⇧Z', desc: 'Redo adjustment' },
    { key: 'Space + Drag', desc: 'Pan around zoomed image canvas' },
    { key: 'Mouse Wheel', desc: 'Smooth zoom in / zoom out' },
    { key: 'Double Click Slider', desc: 'Instantly reset slider to neutral zero' },
    { key: 'C', desc: 'Toggle crop & geometry tool overlay' },
    { key: 'O', desc: 'Toggle mask preview overlay (Ruby Red)' },
    { key: 'Tab', desc: 'Toggle sidebars for full-screen distraction-free view' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-sm bg-[#131722] border border-[#262e40] rounded-xl shadow-2xl overflow-hidden text-slate-200">
        <div className="px-5 py-4 border-b border-[#202738] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Command className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Keyboard Shortcuts</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-2 text-xs">
          {shortcuts.map((sc, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-1.5 border-b border-[#1b212f] last:border-none"
            >
              <span className="text-slate-400">{sc.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-[#1c2333] border border-[#2a3449] font-mono text-[11px] text-violet-300 font-semibold shadow-sm">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[#202738] bg-[#0f121a] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1e2536] hover:bg-[#283248] text-white rounded-lg text-xs font-medium transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
