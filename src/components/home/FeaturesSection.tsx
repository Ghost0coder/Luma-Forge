import React from 'react';
import { Sun, Palette, Wand2, Sparkles, Sliders, Layers } from 'lucide-react';

interface FeaturesSectionProps {
  onNavigate?: (route: string) => void;
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({ onNavigate }) => {
  const features = [
    {
      icon: Sun,
      title: 'Professional Light',
      description:
        'Soft-knee exposure compensation, contrast, highlights, shadows, whites, and blacks with real-time histogram feedback.',
      color: 'from-amber-500/20 to-orange-500/5',
      iconColor: 'text-amber-400',
    },
    {
      icon: Palette,
      title: 'Color, Perfected',
      description:
        'Monotone cubic spline RGB tone curves, 8-channel HSL color mixer with hue, saturation, and luminance, plus split toning.',
      color: 'from-violet-500/20 to-purple-500/5',
      iconColor: 'text-violet-400',
    },
    {
      icon: Wand2,
      title: 'Smart Masks',
      description:
        'Select subjects and backgrounds using local spatial contrast algorithms for targeted exposure, color, and sharpness masks.',
      color: 'from-indigo-500/20 to-blue-500/5',
      iconColor: 'text-indigo-400',
    },
    {
      icon: Sparkles,
      title: 'Auto-Enhance',
      description:
        'Instant photographic diagnosis recommending optimal exposure and balance, plus interactive brush-based mask refinement.',
      color: 'from-fuchsia-500/20 to-pink-500/5',
      iconColor: 'text-fuchsia-400',
    },
    {
      icon: Sliders,
      title: 'Creative Presets',
      description:
        'Create, save, and fine-tune preset strength from 0% to 200%. Export and import custom JSON preset packs anytime.',
      color: 'from-emerald-500/20 to-teal-500/5',
      iconColor: 'text-emerald-400',
    },
    {
      icon: Layers,
      title: 'Batch Workflow',
      description:
        'Apply looks across multiple photos simultaneously. Batch copy-paste adjustment stacks with bounded concurrency export.',
      color: 'from-sky-500/20 to-cyan-500/5',
      iconColor: 'text-sky-400',
    },
  ];

  return (
    <section id="features" className="py-20 lg:py-28 bg-[#090b11] relative border-t border-[#171c28]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <span className="text-xs font-mono font-semibold tracking-widest text-violet-400 uppercase">
            COMPLETE EDITING SUITE
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Your Vision. Every Detail.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Built with standard-setting color science, non-destructive adjustment stacks, and high-precision controls.
          </p>
        </div>

        {/* 6 Feature Cards Grid */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                onClick={() => onNavigate?.('/editor')}
                className="group relative rounded-2xl bg-[#0f131d] p-6 border border-[#1e2638] hover:border-violet-500/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-violet-950/20 flex flex-col justify-between overflow-hidden cursor-pointer"
              >
                {/* Accent Background Glow */}
                <div
                  className={`absolute -top-12 -right-12 w-36 h-36 bg-gradient-to-br ${feat.color} rounded-full blur-2xl group-hover:scale-150 transition-transform pointer-events-none`}
                />

                <div className="relative z-10 space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-[#161b29] border border-[#273046] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon className={`w-6 h-6 ${feat.iconColor}`} />
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-violet-300 transition-colors">
                    {feat.title}
                  </h3>

                  <p className="text-sm text-slate-400 leading-relaxed font-normal">
                    {feat.description}
                  </p>
                </div>

                <div className="relative z-10 pt-4 mt-4 border-t border-[#181e2b] flex items-center justify-between text-xs font-medium text-slate-300 group-hover:text-violet-300">
                  <span>Explore in Workspace</span>
                  <span className="text-violet-400 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
