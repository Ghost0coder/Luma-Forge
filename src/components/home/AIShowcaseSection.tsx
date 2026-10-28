import React, { useState } from 'react';
import { Sparkles, UserCheck, Sliders, ArrowRight, Eye, ShieldCheck } from 'lucide-react';
import samplePortrait from '../../assets/images/sample_portrait_editorial_1793160633779.jpg';

interface AIShowcaseSectionProps {
  onNavigate: (route: string) => void;
}

export const AIShowcaseSection: React.FC<AIShowcaseSectionProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'subject' | 'background' | 'enhance'>('subject');
  const [showMaskOverlay, setShowMaskOverlay] = useState<boolean>(true);

  const showcaseItems = [
    {
      id: 'subject' as const,
      title: 'Subject Selection',
      icon: UserCheck,
      badge: '100% In-Browser Engine',
      tagline: 'Instant Subject Isolation',
      description:
        'Isolate portraits, people, or foreground subjects in 15ms. Apply targeted lighting and sharpness without affecting backgrounds.',
    },
    {
      id: 'background' as const,
      title: 'Background Separation',
      icon: Sliders,
      badge: 'Inverted Smart Mask',
      tagline: 'Atmospheric & Sky Control',
      description:
        'Darken background distracting elements, desaturate distant noise, or add soft background blur while keeping your subject pin-sharp.',
    },
    {
      id: 'enhance' as const,
      title: 'Smart Enhancement',
      icon: Sparkles,
      badge: 'Histogram Auto-Levels',
      tagline: 'Intelligent Tone Balancing',
      description:
        'Analyzes histogram distribution and dynamic range to auto-correct flat exposure, recover blown highlights, and enhance depth.',
    },
  ];

  return (
    <section id="smart-tools" className="py-20 lg:py-28 bg-[#07090d] relative overflow-hidden border-t border-[#171c28]">
      {/* Background Accent Glow */}
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-violet-600/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-950/60 border border-violet-800/40 text-xs font-mono font-medium text-violet-300">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>LOCAL COMPUTATIONAL WORKFLOW</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Less Busywork. More Creativity.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Let intelligent tools handle repetitive adjustments while you stay in control of the final image.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {showcaseItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/50'
                    : 'bg-[#111522] text-slate-400 hover:text-white border border-[#232b3e]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.title}</span>
              </button>
            );
          })}
        </div>

        {/* Visual Preview */}
        <div className="mt-10 max-w-5xl mx-auto">
          <div className="bg-[#0f131d] rounded-2xl border border-[#1f2738] p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-2xl">
            {/* Left: Image Container with Live Mask Preview Overlay */}
            <div className="lg:col-span-7 relative aspect-[4/3] rounded-xl overflow-hidden bg-black border border-[#232b3e] group">
              <img
                src={samplePortrait}
                alt="Subject Masking Sample"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/samples/sample_portrait_editorial_1793160633779.jpg';
                }}
              />

              {/* Ruby Red Mask Overlay Effect */}
              {showMaskOverlay && activeTab === 'subject' && (
                <div
                  className="absolute inset-0 bg-red-600/40 mix-blend-screen transition-opacity duration-300 pointer-events-none"
                  style={{
                    maskImage: 'radial-gradient(circle at 48% 42%, black 0%, black 35%, transparent 68%)',
                    WebkitMaskImage: 'radial-gradient(circle at 48% 42%, black 0%, black 35%, transparent 68%)',
                  }}
                />
              )}

              {showMaskOverlay && activeTab === 'background' && (
                <div
                  className="absolute inset-0 bg-red-600/40 mix-blend-screen transition-opacity duration-300 pointer-events-none"
                  style={{
                    maskImage: 'radial-gradient(circle at 48% 42%, transparent 0%, transparent 35%, black 65%)',
                    WebkitMaskImage: 'radial-gradient(circle at 48% 42%, transparent 0%, transparent 35%, black 65%)',
                  }}
                />
              )}

              {/* Overlay Toggle Control */}
              <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2">
                <button
                  onClick={() => setShowMaskOverlay(!showMaskOverlay)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md text-xs font-mono font-medium text-white border border-white/20 hover:bg-black transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-violet-400" />
                  <span>{showMaskOverlay ? 'Hide Mask Overlay' : 'Show Ruby Red Mask'}</span>
                </button>
              </div>

              <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-md bg-violet-950/80 backdrop-blur-md text-[11px] font-mono text-violet-300 border border-violet-500/30">
                SEGMENTATION MASK ACTIVE
              </div>
            </div>

            {/* Right: Capability Details */}
            <div className="lg:col-span-5 space-y-5">
              {showcaseItems
                .filter((item) => item.id === activeTab)
                .map((item) => (
                  <div key={item.id} className="space-y-4">
                    <span className="inline-block px-2.5 py-1 rounded bg-[#171e2e] text-violet-300 border border-[#2b354e] text-xs font-mono font-semibold">
                      {item.badge}
                    </span>

                    <h3 className="text-2xl font-bold text-white tracking-tight">
                      {item.tagline}
                    </h3>

                    <p className="text-sm text-slate-300 leading-relaxed font-normal">
                      {item.description}
                    </p>

                    <div className="space-y-2 pt-2 text-xs font-medium text-slate-300">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Zero server upload — 100% in-browser WebGL computation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Non-destructive local mask adjustment sliders</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Refine mask with interactive add/erase brush</span>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        onClick={() => onNavigate('/editor')}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-950/50 cursor-pointer"
                      >
                        <span>Launch Editing Workspace</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
