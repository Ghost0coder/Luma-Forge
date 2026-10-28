import React, { useState } from 'react';
import { Sparkles, Menu, X, ArrowRight, Sliders, Shield } from 'lucide-react';

interface NavbarProps {
  onNavigate: (route: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-[#07090d]/85 backdrop-blur-md border-b border-[#1b202d] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand Logo */}
          <button
            onClick={() => {
              onNavigate('/');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2.5 group text-left cursor-pointer focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-900 flex items-center justify-center shadow-md shadow-violet-950/40 group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="9" strokeWidth="1.75" />
                <path d="M12 3v18M3 12h18" strokeWidth="1.2" strokeOpacity="0.3" />
                <polygon points="12,5 17,12 12,19 7,12" fill="currentColor" fillOpacity="0.3" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white group-hover:text-violet-300 transition-colors">
                LumaForge
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 -mt-1">
                AI Photo Studio
              </span>
            </div>
          </button>

          {/* Center/Right: Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <button
              onClick={() => scrollToSection('features')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('ai-tools')}
              className="hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>AI Tools</span>
            </button>
            <button
              onClick={() => scrollToSection('presets')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Presets
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('gallery')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Gallery
            </button>
          </div>

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => onNavigate('/editor')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-[#141824] hover:bg-[#1c2233] border border-[#273044] rounded-lg transition-all cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-violet-400" />
              <span>Open Editor</span>
            </button>

            <button
              onClick={() => onNavigate('/editor')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg shadow-lg shadow-violet-950/50 hover:shadow-violet-900/60 transition-all cursor-pointer"
            >
              <span>Start Editing Free</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Hamburger Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => onNavigate('/editor')}
              className="px-2.5 py-1.5 text-xs font-semibold text-white bg-violet-600 rounded-md"
            >
              Open Editor
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white rounded-md focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0a0d14] border-b border-[#1b202d] px-4 pt-3 pb-6 space-y-3">
          <button
            onClick={() => scrollToSection('features')}
            className="block w-full text-left py-2 text-sm font-medium text-slate-300 hover:text-white"
          >
            Features
          </button>
          <button
            onClick={() => scrollToSection('ai-tools')}
            className="block w-full text-left py-2 text-sm font-medium text-slate-300 hover:text-white flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span>AI Tools</span>
          </button>
          <button
            onClick={() => scrollToSection('presets')}
            className="block w-full text-left py-2 text-sm font-medium text-slate-300 hover:text-white"
          >
            Presets
          </button>
          <button
            onClick={() => scrollToSection('how-it-works')}
            className="block w-full text-left py-2 text-sm font-medium text-slate-300 hover:text-white"
          >
            How It Works
          </button>
          <button
            onClick={() => scrollToSection('gallery')}
            className="block w-full text-left py-2 text-sm font-medium text-slate-300 hover:text-white"
          >
            Gallery
          </button>

          <div className="pt-3 border-t border-[#1b202d] flex flex-col gap-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate('/editor');
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg shadow-md"
            >
              <span>Start Editing Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};
