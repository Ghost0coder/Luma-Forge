import React, { useState } from 'react';
import { HistogramData } from '../types/editor';
import { AlertCircle } from 'lucide-react';

interface HistogramViewProps {
  data: HistogramData | null;
}

export const HistogramView: React.FC<HistogramViewProps> = ({ data }) => {
  const [channel, setChannel] = useState<'all' | 'rgb' | 'lum'>('all');

  if (!data || data.maxCount <= 0) {
    return (
      <div className="h-28 w-full bg-[#0b0d13] rounded-lg border border-[#202738] flex items-center justify-center text-xs text-slate-600">
        No histogram data
      </div>
    );
  }

  const { red, green, blue, luminance, maxCount, highlightClipping, shadowClipping } = data;
  const height = 90;
  const width = 256;

  // Build SVG polygon points
  const buildPath = (bins: number[]): string => {
    let pts = `0,${height}`;
    for (let i = 0; i < 256; i++) {
      const hNorm = Math.min(height, (bins[i] / maxCount) * height);
      pts += ` ${i},${height - hNorm}`;
    }
    pts += ` 255,${height}`;
    return pts;
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-slate-300">Histogram</span>
          {/* Shadow clipping warning */}
          {shadowClipping > 0.5 && (
            <span
              title={`Shadows clipped: ${shadowClipping}%`}
              className="flex items-center gap-0.5 text-[10px] text-blue-400 font-mono"
            >
              <AlertCircle className="w-3 h-3" />
              <span>{shadowClipping}%</span>
            </span>
          )}
          {/* Highlight clipping warning */}
          {highlightClipping > 0.5 && (
            <span
              title={`Highlights blown: ${highlightClipping}%`}
              className="flex items-center gap-0.5 text-[10px] text-red-400 font-mono"
            >
              <AlertCircle className="w-3 h-3" />
              <span>{highlightClipping}%</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 bg-[#141822] p-0.5 rounded text-[10px]">
          <button
            onClick={() => setChannel('all')}
            className={`px-1.5 py-0.5 rounded ${
              channel === 'all' ? 'bg-[#222a3b] text-white' : 'text-slate-400'
            }`}
          >
            RGB
          </button>
          <button
            onClick={() => setChannel('lum')}
            className={`px-1.5 py-0.5 rounded ${
              channel === 'lum' ? 'bg-[#222a3b] text-white' : 'text-slate-400'
            }`}
          >
            Luma
          </button>
        </div>
      </div>

      <div className="relative w-full h-24 bg-[#0b0d13] rounded-lg border border-[#202738] overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {channel === 'all' && (
            <>
              {/* Red */}
              <polygon
                points={buildPath(red)}
                fill="rgba(239, 68, 68, 0.35)"
                stroke="#ef4444"
                strokeWidth="1"
              />
              {/* Green */}
              <polygon
                points={buildPath(green)}
                fill="rgba(34, 197, 94, 0.35)"
                stroke="#22c55e"
                strokeWidth="1"
              />
              {/* Blue */}
              <polygon
                points={buildPath(blue)}
                fill="rgba(56, 189, 248, 0.35)"
                stroke="#38bdf8"
                strokeWidth="1"
              />
            </>
          )}

          {channel === 'lum' && (
            <polygon
              points={buildPath(luminance)}
              fill="rgba(255, 255, 255, 0.25)"
              stroke="#f1f5f9"
              strokeWidth="1.5"
            />
          )}
        </svg>

        {/* Shadow & Highlight warning corner indicator chips */}
        {shadowClipping > 0.5 && (
          <div
            title="Shadow clipping active"
            className="absolute bottom-1 left-1 w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500"
          />
        )}
        {highlightClipping > 0.5 && (
          <div
            title="Highlight clipping active"
            className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-red-500 shadow-sm shadow-red-500"
          />
        )}
      </div>
    </div>
  );
};
