import React, { useState, useRef } from 'react';
import { ArrowRight, Sparkles, Sliders, ShieldCheck, Cpu, Zap } from 'lucide-react';
import sampleLandscape from '../../assets/images/sample_landscape_peaks_1793160633388.jpg';

interface HeroSectionProps {
  onNavigate: (route: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onNavigate }) => {
  const [sliderPos, setSliderPos] = useState<number>(52);
  const isDraggingRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percentage);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current || e.buttons === 1) {
      handleMove(e.clientX);
    }
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-16 lg:pb-28 bg-[#07090d]">
      {/* Subtle Background Glow Spheres */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/10 blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute top-1/3 right-10 w-[350px] h-[350px] bg-indigo-500/10 blur-[100px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#121624] border border-[#273048] text-xs font-mono tracking-widest text-violet-300 uppercase shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
            <span>YOUR CREATIVE VISION. NO LIMITS.</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
            Every Photo Has a Story.{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-purple-300 to-indigo-300">
              Make Yours Unforgettable.
            </span>
          </h1>

          {/* Supporting Text */}
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto font-normal">
            Professional photo editing meets standard-setting color science. Shape light, refine color, and bring your creative vision to life with LumaForge.
          </p>

          {/* Primary & Secondary CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={() => onNavigate('/editor')}
              className="w-full sm:w-auto px-7 py-3.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 rounded-xl shadow-xl shadow-violet-950/60 hover:shadow-violet-900/80 transition-all flex items-center justify-center gap-2.5 cursor-pointer transform hover:-translate-y-0.5"
            >
              <span>Start Editing Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                const el = document.getElementById('features');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto px-6 py-3.5 text-sm font-semibold text-slate-300 hover:text-white bg-[#111520] hover:bg-[#1a2030] border border-[#262f44] rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-violet-400" />
              <span>Explore Features</span>
            </button>
          </div>

          {/* 3 Concise Value Statements */}
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-xs font-medium text-slate-300">
            <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-[#0e121c] border border-[#1d2436]">
              <Zap className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span>Professional editing tools</span>
            </div>
            <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-[#0e121c] border border-[#1d2436]">
              <Cpu className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span>High-precision color science</span>
            </div>
            <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-[#0e121c] border border-[#1d2436]">
              <ShieldCheck className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span>Your photos, your control</span>
            </div>
          </div>
        </div>

        {/* Hero Interactive Before / After Split Slider Comparison Element */}
        <div className="mt-12 lg:mt-16 max-w-5xl mx-auto">
          <div className="p-2 sm:p-3 rounded-2xl bg-[#0f131d] border border-[#1f2738] shadow-2xl shadow-black/80">
            <div
              ref={containerRef}
              onMouseDown={() => {
                isDraggingRef.current = true;
              }}
              onMouseUp={() => {
                isDraggingRef.current = false;
              }}
              onMouseMove={handleMouseMove}
              onTouchMove={handleTouchMove}
              className="relative w-full aspect-[16/9] rounded-xl overflow-hidden cursor-ew-resize select-none group bg-[#07090d]"
            >
              {/* After (LumaForge Edited Cinematic Version) */}
              <img
                src={sampleLandscape}
                alt="LumaForge Edited Preview"
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                style={{
                  filter: 'contrast(1.18) saturate(1.28) brightness(1.05)',
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/samples/sample_landscape_peaks_1793160633388.jpg';
                }}
              />

              {/* Before (RAW Original Unedited Version) - Clipped via Slider */}
              <img
                src={sampleLandscape}
                alt="RAW Original Preview"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                style={{
                  filter: 'contrast(0.85) saturate(0.7) brightness(0.9) sepia(0.15)',
                  clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/samples/sample_landscape_peaks_1793160633388.jpg';
                }}
              />

              {/* Divider Line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] z-20 pointer-events-none"
                style={{ left: `${sliderPos}%` }}
              >
                {/* Drag Handle Button */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-violet-600 text-white border-2 border-white flex items-center justify-center shadow-lg text-xs font-bold pointer-events-none">
                  ↔
                </div>
              </div>

              {/* Badges */}
              <div className="absolute top-3 left-3 z-30 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-[11px] font-mono font-medium text-slate-300 border border-white/10">
                RAW ORIGINAL
              </div>
              <div className="absolute top-3 right-3 z-30 px-2.5 py-1 rounded-md bg-violet-900/80 backdrop-blur-md text-[11px] font-mono font-bold text-violet-200 border border-violet-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-violet-300" />
                LUMAFORGE EDITED
              </div>

              {/* Drag Prompt */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-medium text-slate-300 border border-white/10 pointer-events-none opacity-90 group-hover:opacity-100 transition-opacity">
                Drag slider to compare Before & After
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

