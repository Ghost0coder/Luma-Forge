import React from 'react';
import { Sliders, Sparkles, ArrowRight } from 'lucide-react';
import { BUILT_IN_PRESETS } from '../../presets/builtInPresets';

interface PresetsShowcaseProps {
  onNavigate: (route: string) => void;
}

export const PresetsShowcase: React.FC<PresetsShowcaseProps> = ({ onNavigate }) => {
  return (
    <section id="presets" className="py-20 lg:py-28 bg-[#090b11] relative border-t border-[#171c28]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <span className="text-xs font-mono font-semibold tracking-widest text-violet-400 uppercase">
            STUDIO PRESET PACKS
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Cinematic Looks in One Click.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Crafted for portraits, landscapes, architecture, and street photography with adjustable strength from 0% to 200%.
          </p>
        </div>

        {/* Presets Grid */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {BUILT_IN_PRESETS.map((preset) => (
            <div
              key={preset.id}
              className="group rounded-2xl bg-[#0f131d] border border-[#1e2638] hover:border-violet-500/50 p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-950/20"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#181f2f] text-violet-300 border border-[#2a354e] text-[11px] font-mono font-medium">
                    {preset.category}
                  </span>
                  <Sparkles className="w-4 h-4 text-violet-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors">
                  {preset.name}
                </h3>

                <p className="text-xs text-slate-400 leading-relaxed font-normal">
                  {preset.description}
                </p>

                {/* Micro-preview of key parameter modifications */}
                <div className="pt-2 flex flex-wrap gap-1.5 text-[10px] font-mono text-slate-300">
                  <span className="px-1.5 py-0.5 rounded bg-[#151a26] border border-[#222b3d]">
                    Exp: {(preset.adjustments.exposure ?? 0) > 0 ? `+${preset.adjustments.exposure}` : (preset.adjustments.exposure ?? 0)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#151a26] border border-[#222b3d]">
                    Sat: {(preset.adjustments.saturation ?? 0) > 0 ? `+${preset.adjustments.saturation}` : (preset.adjustments.saturation ?? 0)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#151a26] border border-[#222b3d]">
                    Temp: {(preset.adjustments.temperature ?? 0) > 0 ? `+${preset.adjustments.temperature}` : (preset.adjustments.temperature ?? 0)}
                  </span>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-[#181e2b]">
                <button
                  onClick={() => onNavigate('/editor')}
                  className="w-full py-2 px-3 rounded-lg bg-[#151924] hover:bg-violet-600 text-slate-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Apply in Editor</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Preset Strength callout */}
        <div className="mt-12 p-6 rounded-2xl bg-[#0e121c] border border-[#1d2536] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-sm font-bold text-white">Save Custom Preset Packs</h4>
            <p className="text-xs text-slate-400">
              Save your own custom color looks, export them as JSON, or share them with fellow editors.
            </p>
          </div>

          <button
            onClick={() => onNavigate('/editor')}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span>Open Presets Panel</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
};
