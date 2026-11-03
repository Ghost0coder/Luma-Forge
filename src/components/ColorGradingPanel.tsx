import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ColorGrading, ColorGradingWheel } from '../types/editor';
import { hslToRgb } from '../engine/colorScience';
import { RotateCcw } from 'lucide-react';

interface ColorGradingPanelProps {
  colorGrading: ColorGrading;
  onChange: (grading: ColorGrading) => void;
}

type GradingTarget = 'shadows' | 'midtones' | 'highlights' | 'global';

interface WheelProps {
  label: string;
  wheel: ColorGradingWheel;
  onChange: (wheel: ColorGradingWheel) => void;
  onReset: () => void;
  size?: number;
}

/**
 * Interactive Circular Color Wheel
 * Radius represents saturation (0 to 100), angle represents hue (0 to 360).
 */
const InteractiveColorWheel: React.FC<WheelProps> = ({
  label,
  wheel,
  onChange,
  onReset,
  size = 140,
}) => {
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const radius = size / 2;
  const padding = 10;
  const maxR = radius - padding;

  // Convert hue & saturation to Cartesian coordinates (center at radius, radius)
  const angleRad = (wheel.hue * Math.PI) / 180;
  const satNorm = Math.min(1, Math.max(0, wheel.saturation / 100));
  const puckX = radius + satNorm * maxR * Math.cos(angleRad);
  const puckY = radius + satNorm * maxR * Math.sin(angleRad);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handlePointerMove(e);
    if ('setPointerCapture' in e.currentTarget) {
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        // fallback
      }
    }
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      if (!wheelRef.current) return;
      const rect = wheelRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = e.clientX - cx;
      const dy = e.clientY - cy;

      const dist = Math.hypot(dx, dy);
      const sat = Math.round(Math.min(100, (dist / maxR) * 100));

      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      const hue = Math.round(angle);

      onChange({
        ...wheel,
        hue,
        saturation: sat,
      });
    },
    [maxR, onChange, wheel]
  );

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    if ('releasePointerCapture' in e.currentTarget && e.currentTarget.hasPointerCapture(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    if (!isDragging) return;
    const onWindowMove = (e: PointerEvent) => handlePointerMove(e);
    const onWindowUp = () => setIsDragging(false);
    window.addEventListener('pointermove', onWindowMove);
    window.addEventListener('pointerup', onWindowUp);
    return () => {
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
    };
  }, [isDragging, handlePointerMove]);

  // Current color preview for puck
  const [pr, pg, pb] = hslToRgb(wheel.hue, wheel.saturation > 0 ? 1 : 0, 0.5);
  const rgbString = `rgb(${Math.round(pr * 255)}, ${Math.round(pg * 255)}, ${Math.round(pb * 255)})`;

  return (
    <div className="flex flex-col items-center select-none">
      <div className="flex items-center justify-between w-full px-1 mb-1 text-[11px]">
        <span className="font-semibold text-slate-300">{label}</span>
        <button
          type="button"
          onClick={onReset}
          title={`Reset ${label}`}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span>Reset</span>
        </button>
      </div>

      <div
        ref={wheelRef}
        onPointerDown={handlePointerDown}
        onPointerMove={isDragging ? handlePointerMove : undefined}
        onPointerUp={handlePointerUp}
        onDoubleClick={onReset}
        style={{ width: size, height: size }}
        className="relative rounded-full cursor-crosshair border border-[#2b3548] shadow-inner touch-none overflow-hidden"
      >
        {/* Conic Hue Gradient */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, #f00 0deg, #ff0 60deg, #0f0 120deg, #0ff 180deg, #00f 240deg, #f0f 300deg, #f00 360deg)',
          }}
        />

        {/* Radial Desaturation Overlay (White center) */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(circle at center, rgba(128,128,128,1) 0%, rgba(128,128,128,0.7) 35%, rgba(128,128,128,0) 80%)',
          }}
        />

        {/* Outer Dark Ring Mask */}
        <div className="absolute inset-0 rounded-full border border-black/40 pointer-events-none" />

        {/* Center Target Crosshairs */}
        <div className="absolute left-1/2 top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 pointer-events-none" />

        {/* Draggable Indicator Puck */}
        <div
          style={{
            left: puckX,
            top: puckY,
            backgroundColor: wheel.saturation > 0 ? rgbString : '#ffffff',
          }}
          className={`absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_4px_rgba(0,0,0,0.8)] pointer-events-none transition-transform ${
            isDragging ? 'scale-125' : ''
          }`}
        />
      </div>

      {/* Numerical Sliders for Precision */}
      <div className="w-full mt-2 space-y-1.5 text-[10px]">
        {/* Hue */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Hue</span>
          <span className="font-mono text-slate-300 tabular-nums">{wheel.hue}°</span>
        </div>
        <input
          type="range"
          min="0"
          max="360"
          value={wheel.hue}
          onChange={(e) => onChange({ ...wheel, hue: parseInt(e.target.value, 10) })}
          onDoubleClick={() => onChange({ ...wheel, hue: 0 })}
          className="w-full h-1 bg-gradient-to-r from-red-500 via-green-500 via-blue-500 to-red-500 rounded-lg appearance-none cursor-pointer"
        />

        {/* Saturation */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Saturation</span>
          <span className="font-mono text-slate-300 tabular-nums">{wheel.saturation}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={wheel.saturation}
          onChange={(e) => onChange({ ...wheel, saturation: parseInt(e.target.value, 10) })}
          onDoubleClick={() => onChange({ ...wheel, saturation: 0 })}
          className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
        />

        {/* Luminance */}
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Luminance</span>
          <span className="font-mono text-slate-300 tabular-nums">
            {wheel.luminance > 0 ? `+${wheel.luminance}` : wheel.luminance}
          </span>
        </div>
        <input
          type="range"
          min="-100"
          max="100"
          value={wheel.luminance}
          onChange={(e) => onChange({ ...wheel, luminance: parseInt(e.target.value, 10) })}
          onDoubleClick={() => onChange({ ...wheel, luminance: 0 })}
          className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
};

export const ColorGradingPanel: React.FC<ColorGradingPanelProps> = React.memo(({
  colorGrading,
  onChange,
}) => {
  const [activeTab, setActiveTab] = useState<GradingTarget | 'overview'>('overview');

  const updateWheel = (target: GradingTarget, updated: ColorGradingWheel) => {
    onChange({
      ...colorGrading,
      [target]: updated,
    });
  };

  const resetWheel = (target: GradingTarget) => {
    onChange({
      ...colorGrading,
      [target]: { hue: 0, saturation: 0, luminance: 0 },
    });
  };

  const resetAllGrading = () => {
    onChange({
      shadows: { hue: 0, saturation: 0, luminance: 0 },
      midtones: { hue: 0, saturation: 0, luminance: 0 },
      highlights: { hue: 0, saturation: 0, luminance: 0 },
      global: { hue: 0, saturation: 0, luminance: 0 },
      blending: 50,
      balance: 0,
      strength: 100,
    });
  };

  return (
    <div className="space-y-3 select-none">
      {/* Target Selector Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-[#141822] p-0.5 rounded-md border border-[#202738] text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-2 py-0.5 rounded font-medium transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            3-Way
          </button>
          {(['shadows', 'midtones', 'highlights', 'global'] as GradingTarget[]).map((target) => (
            <button
              key={target}
              type="button"
              onClick={() => setActiveTab(target)}
              className={`px-2 py-0.5 rounded font-medium transition-colors capitalize cursor-pointer ${
                activeTab === target
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {target === 'global' ? 'Global' : target.slice(0, 4)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={resetAllGrading}
          title="Reset all color grading wheels and parameters"
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span>Reset All</span>
        </button>
      </div>

      {/* Main Wheel View */}
      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <InteractiveColorWheel
            label="Shadows"
            wheel={colorGrading.shadows}
            onChange={(w) => updateWheel('shadows', w)}
            onReset={() => resetWheel('shadows')}
            size={110}
          />
          <InteractiveColorWheel
            label="Midtones"
            wheel={colorGrading.midtones}
            onChange={(w) => updateWheel('midtones', w)}
            onReset={() => resetWheel('midtones')}
            size={110}
          />
          <InteractiveColorWheel
            label="Highlights"
            wheel={colorGrading.highlights}
            onChange={(w) => updateWheel('highlights', w)}
            onReset={() => resetWheel('highlights')}
            size={110}
          />
        </div>
      ) : (
        <div className="max-w-[200px] mx-auto py-1">
          <InteractiveColorWheel
            label={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            wheel={colorGrading[activeTab] || { hue: 0, saturation: 0, luminance: 0 }}
            onChange={(w) => updateWheel(activeTab, w)}
            onReset={() => resetWheel(activeTab)}
            size={160}
          />
        </div>
      )}

      {/* Global Color Grading Sliders: Blending, Balance, Strength */}
      <div className="pt-2 border-t border-[#1c2230] space-y-2 text-xs">
        {/* Blending */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400" title="Smoothness of transition between shadow and highlight regions">
              Blending
            </span>
            <span className="font-mono text-slate-300 tabular-nums">{colorGrading.blending ?? 50}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={colorGrading.blending ?? 50}
            onDoubleClick={() => onChange({ ...colorGrading, blending: 50 })}
            onChange={(e) => onChange({ ...colorGrading, blending: parseInt(e.target.value, 10) })}
            className="w-full"
          />
        </div>

        {/* Balance */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400" title="Shifts balance toward shadows (-) or highlights (+)">
              Balance
            </span>
            <span className="font-mono text-slate-300 tabular-nums">
              {(colorGrading.balance ?? 0) > 0 ? `+${colorGrading.balance}` : colorGrading.balance ?? 0}
            </span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            value={colorGrading.balance ?? 0}
            onDoubleClick={() => onChange({ ...colorGrading, balance: 0 })}
            onChange={(e) => onChange({ ...colorGrading, balance: parseInt(e.target.value, 10) })}
            className="w-full"
          />
        </div>

        {/* Overall Grading Strength */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400" title="Master strength of all color grading wheels">
              Grading Strength
            </span>
            <span className="font-mono text-slate-300 tabular-nums">{colorGrading.strength ?? 100}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={colorGrading.strength ?? 100}
            onDoubleClick={() => onChange({ ...colorGrading, strength: 100 })}
            onChange={(e) => onChange({ ...colorGrading, strength: parseInt(e.target.value, 10) })}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
});
