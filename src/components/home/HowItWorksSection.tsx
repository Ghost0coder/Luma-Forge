import React from 'react';
import { Upload, Sliders, Download } from 'lucide-react';

export const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Import',
      subtitle: 'Bring in a photo and start with your original image.',
      description:
        'Drag and drop any JPEG, PNG, or WebP photo into the workspace. LumaForge creates an uncompressed local copy in IndexedDB.',
      icon: Upload,
    },
    {
      num: '02',
      title: 'Create',
      subtitle: 'Refine light, color, details, and local adjustments.',
      description:
        'Shape exposure, adjust 8-channel HSL color mix, tweak tone curves, or generate MediaPipe AI subject masks with non-destructive undo/redo.',
      icon: Sliders,
    },
    {
      num: '03',
      title: 'Export',
      subtitle: 'Save your finished photograph in your preferred supported format.',
      description:
        'Export at full native resolution in JPEG, PNG, or WebP with configurable quality compression, scaling, and custom metadata file naming.',
      icon: Download,
    },
  ];

  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-[#07090d] relative border-t border-[#171c28]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <span className="text-xs font-mono font-semibold tracking-widest text-violet-400 uppercase">
            STREAMLINED WORKFLOW
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            How LumaForge Works
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            From raw import to final export, your photos stay 100% private in your browser with non-destructive state preservation.
          </p>
        </div>

        {/* 3-Step Horizontal Timeline on Desktop / Vertical Stack on Mobile */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector Line on Desktop */}
          <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-violet-600/30 via-violet-500/50 to-violet-600/30 pointer-events-none" />

          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="relative rounded-2xl bg-[#0f131d] border border-[#1e2638] p-6 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Step Number & Icon */}
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black font-mono text-violet-400">
                      {step.num}
                    </span>
                    <div className="w-10 h-10 rounded-lg bg-[#161b28] border border-[#273046] flex items-center justify-center">
                      <Icon className="w-5 h-5 text-violet-300" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-white">{step.title}</h3>
                  <p className="text-xs font-semibold text-violet-300 leading-snug">
                    {step.subtitle}
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed font-normal">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
