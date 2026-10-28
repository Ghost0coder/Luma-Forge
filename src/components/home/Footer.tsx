import React from 'react';
import { Sliders, ShieldCheck, Heart } from 'lucide-react';

interface FooterProps {
  onNavigate: (route: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer className="bg-[#05070a] border-t border-[#151a26] text-slate-400 py-12 lg:py-16 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Brand Col */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-900 flex items-center justify-center shadow-md">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="9" strokeWidth="1.75" />
                  <path d="M12 3v18M3 12h18" strokeWidth="1.2" strokeOpacity="0.3" />
                  <polygon points="12,5 17,12 12,19 7,12" fill="currentColor" fillOpacity="0.3" strokeWidth="1.5" />
                </svg>
              </div>
              <span className="text-base font-bold tracking-tight text-white">LumaForge</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm font-normal">
              LumaForge is a modern, privacy-first AI photo editing workspace engineered for photographers, creators, and enthusiasts.
            </p>

            <div className="p-3 rounded-xl bg-[#0c0f17] border border-[#1b2130] flex items-start gap-2.5 text-xs text-slate-300 max-w-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white font-medium block">Privacy Guarantee</strong>
                All WebGL rendering, tone curve calculations, and MediaPipe AI segmentation execute 100% locally in your browser session.
              </div>
            </div>
          </div>

          {/* Nav Links */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase text-white tracking-wider">
              Navigation
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => scrollToSection('features')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Features
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('ai-tools')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  AI Tools
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('presets')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Presets
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('gallery')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Gallery
                </button>
              </li>
            </ul>
          </div>

          {/* Workspace Quick Launch */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase text-white tracking-wider">
              Workspace
            </h4>
            <p className="text-xs text-slate-400">
              Launch the photo editor directly in your web browser. No plugins, downloads, or accounts required.
            </p>
            <button
              onClick={() => onNavigate('/editor')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-violet-950/50"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Open LumaForge Editor</span>
            </button>
          </div>
        </div>

        <div className="pt-8 border-t border-[#121622] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-500">
          <div>© {new Date().getFullYear()} LumaForge AI Photo Studio. All rights reserved.</div>
          <div className="flex items-center gap-1 text-slate-400">
            <span>Built with precision & color science for creators</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
