import React from 'react';
import { ArrowRight, Sparkles, Sliders, Lock } from 'lucide-react';

interface CTASectionProps {
  onNavigate: (route: string) => void;
}

export const CTASection: React.FC<CTASectionProps> = ({ onNavigate }) => {
  return (
    <section className="py-20 lg:py-28 bg-[#07090d] relative overflow-hidden border-t border-[#171c28]">
      {/* Background Accent Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-violet-600/15 blur-[140px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="rounded-3xl bg-[#0e121d] border border-[#232b3e] p-8 sm:p-14 text-center space-y-6 shadow-2xl shadow-violet-950/20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-950/80 border border-violet-800/40 text-xs font-mono font-medium text-violet-300">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>NO SIGN UP REQUIRED • 100% PRIVATE</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Your Next Favorite Photo Starts Here.
          </h2>

          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto font-normal">
            Open your workspace and start creating with professional light adjustments, 8-channel HSL color science, and local MediaPipe AI segmentation.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => onNavigate('/editor')}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm shadow-xl shadow-violet-950/60 transition-all flex items-center justify-center gap-2.5 cursor-pointer transform hover:-translate-y-0.5"
            >
              <span>Start Editing Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('/editor')}
              className="w-full sm:w-auto px-6 py-4 rounded-xl bg-[#141824] hover:bg-[#1c2233] border border-[#283246] text-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-violet-400" />
              <span>Open Editor Workspace</span>
            </button>
          </div>

          <div className="pt-4 flex items-center justify-center gap-2 text-xs font-mono text-slate-400">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Photos are processed locally in your browser. Zero cloud upload.</span>
          </div>
        </div>
      </div>
    </section>
  );
};
