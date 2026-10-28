import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Star,
  Flag,
  XCircle,
  CheckCircle,
  Tag,
  Film,
} from 'lucide-react';
import { SamplePhoto } from '../data/samplePhotos';
import { PhotoProject } from '../types/editor';

export interface FilmstripItem {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  category?: string;
  isProject?: boolean;
}

interface FilmstripProps {
  items: FilmstripItem[];
  activeId: string;
  onSelect: (item: FilmstripItem) => void;
  onNext: () => void;
  onPrev: () => void;
  ratings: Record<string, number>;
  flags: Record<string, 'pick' | 'reject' | 'none'>;
  colorLabels: Record<string, 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'none'>;
  onSetRating: (id: string, rating: number) => void;
  onSetFlag: (id: string, flag: 'pick' | 'reject' | 'none') => void;
  onSetColorLabel: (
    id: string,
    color: 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'none'
  ) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Filmstrip: React.FC<FilmstripProps> = React.memo(({
  items,
  activeId,
  onSelect,
  onNext,
  onPrev,
  ratings,
  flags,
  colorLabels,
  onSetRating,
  onSetFlag,
  onSetColorLabel,
  isCollapsed,
  onToggleCollapse,
}) => {
  const currentIndex = items.findIndex((item) => item.id === activeId);
  const activeItem = items[currentIndex] || items[0];

  const getColorClass = (color?: string) => {
    switch (color) {
      case 'red':
        return 'bg-red-500';
      case 'yellow':
        return 'bg-amber-400';
      case 'green':
        return 'bg-emerald-500';
      case 'blue':
        return 'bg-blue-500';
      case 'purple':
        return 'bg-purple-500';
      default:
        return 'bg-transparent';
    }
  };

  if (isCollapsed) {
    return (
      <div className="h-7 w-full bg-[#0a0d13] border-t border-[#1b202c] px-4 flex items-center justify-between text-xs text-slate-400 select-none shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleCollapse}
            title="Expand Filmstrip"
            className="flex items-center gap-1 text-[11px] font-mono text-slate-300 hover:text-white transition-colors"
          >
            <ChevronUp className="w-3.5 h-3.5 text-violet-400" />
            <span>Filmstrip</span>
          </button>
          <span className="text-[11px] font-mono text-slate-500">|</span>
          <span className="text-[11px] font-mono text-slate-300 truncate max-w-[200px]">
            {activeItem ? activeItem.title : 'No Photo Selected'}
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            ({currentIndex >= 0 ? currentIndex + 1 : 0} of {items.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            disabled={currentIndex <= 0}
            title="Previous Photo"
            className="p-1 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onNext}
            disabled={currentIndex < 0 || currentIndex >= items.length - 1}
            title="Next Photo"
            className="p-1 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-28 w-full bg-[#0a0d14] border-t border-[#1b202c] flex flex-col select-none shrink-0 z-20 overflow-hidden">
      {/* Filmstrip Header / Controls Bar */}
      <div className="h-6 px-3 bg-[#0d101a] border-b border-[#181d2b] flex items-center justify-between text-[11px] font-mono text-slate-400 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleCollapse}
            title="Collapse Filmstrip"
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5 text-violet-400" />
            <span>FILMSTRIP</span>
          </button>
          <span className="text-slate-600">•</span>
          <span className="text-slate-300">
            {currentIndex >= 0 ? currentIndex + 1 : 0} / {items.length} Photos
          </span>
        </div>

        {/* Selected Photo Quick Metadata & Rating Bar */}
        {activeItem && (
          <div className="flex items-center gap-3">
            {/* Pick / Reject Flag */}
            <div className="flex items-center gap-1 bg-[#141824] px-1.5 py-0.5 rounded border border-[#202738]">
              <button
                onClick={() =>
                  onSetFlag(
                    activeItem.id,
                    flags[activeItem.id] === 'pick' ? 'none' : 'pick'
                  )
                }
                title="Flag as Pick"
                className={`p-0.5 hover:text-emerald-400 transition-colors ${
                  flags[activeItem.id] === 'pick' ? 'text-emerald-400' : 'text-slate-500'
                }`}
              >
                <CheckCircle className="w-3 h-3" />
              </button>
              <button
                onClick={() =>
                  onSetFlag(
                    activeItem.id,
                    flags[activeItem.id] === 'reject' ? 'none' : 'reject'
                  )
                }
                title="Flag as Reject"
                className={`p-0.5 hover:text-red-400 transition-colors ${
                  flags[activeItem.id] === 'reject' ? 'text-red-400' : 'text-slate-500'
                }`}
              >
                <XCircle className="w-3 h-3" />
              </button>
            </div>

            {/* Star Rating (1 to 5) */}
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const currentRating = ratings[activeItem.id] || 0;
                return (
                  <button
                    key={star}
                    onClick={() =>
                      onSetRating(activeItem.id, currentRating === star ? 0 : star)
                    }
                    title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                    className="p-0.5 text-slate-600 hover:text-amber-400 transition-colors"
                  >
                    <Star
                      className={`w-3 h-3 ${
                        star <= currentRating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Color Label Selector */}
            <div className="flex items-center gap-1">
              {(['red', 'yellow', 'green', 'blue', 'purple'] as const).map((col) => (
                <button
                  key={col}
                  onClick={() =>
                    onSetColorLabel(
                      activeItem.id,
                      colorLabels[activeItem.id] === col ? 'none' : col
                    )
                  }
                  title={`Color label ${col}`}
                  className={`w-2.5 h-2.5 rounded-full transition-transform ${getColorClass(
                    col
                  )} ${
                    colorLabels[activeItem.id] === col
                      ? 'scale-125 ring-1 ring-white'
                      : 'opacity-60 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Previous / Next navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            disabled={currentIndex <= 0}
            title="Previous Photo (Left Arrow)"
            className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onNext}
            disabled={currentIndex < 0 || currentIndex >= items.length - 1}
            title="Next Photo (Right Arrow)"
            className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Thumbnails Track */}
      <div className="flex-1 px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {items.map((item, index) => {
          const isActive = item.id === activeId;
          const rating = ratings[item.id] || 0;
          const flag = flags[item.id] || 'none';
          const colorLabel = colorLabels[item.id] || 'none';

          return (
            <div
              key={item.id}
              onClick={() => onSelect(item)}
              className={`group relative shrink-0 h-16 w-20 rounded-md overflow-hidden border transition-all cursor-pointer ${
                isActive
                  ? 'border-violet-500 ring-2 ring-violet-500/40 shadow-lg scale-[1.02]'
                  : 'border-[#1f2638] hover:border-slate-400 opacity-70 hover:opacity-100'
              }`}
            >
              <img
                src={item.thumbnailUrl || item.url}
                alt={item.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  if (item.id.includes('portrait'))
                    (e.currentTarget as HTMLImageElement).src =
                      '/samples/sample_portrait_editorial_1793160633779.jpg';
                  else if (
                    item.id.includes('landscape') ||
                    item.id.includes('desert') ||
                    item.id.includes('ocean')
                  )
                    (e.currentTarget as HTMLImageElement).src =
                      '/samples/sample_landscape_peaks_1793160633388.jpg';
                  else
                    (e.currentTarget as HTMLImageElement).src =
                      '/samples/sample_street_architecture_1793160634115.jpg';
                }}
              />

              {/* Top Bar Indicators (Flag & Color Label) */}
              <div className="absolute top-1 left-1 right-1 flex items-center justify-between pointer-events-none">
                {flag === 'pick' && (
                  <span className="p-0.5 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-400">
                    <CheckCircle className="w-2.5 h-2.5" />
                  </span>
                )}
                {flag === 'reject' && (
                  <span className="p-0.5 rounded bg-red-950/80 border border-red-500/50 text-red-400">
                    <XCircle className="w-2.5 h-2.5" />
                  </span>
                )}
                {colorLabel !== 'none' && (
                  <span
                    className={`w-2 h-2 rounded-full border border-black/50 ml-auto ${getColorClass(
                      colorLabel
                    )}`}
                  />
                )}
              </div>

              {/* Bottom Bar Title & Star Rating Overlay */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-1 flex items-center justify-between text-[9px] text-white">
                <span className="truncate font-mono font-medium">{item.title}</span>
                {rating > 0 && (
                  <div className="flex items-center text-amber-400 shrink-0">
                    <Star className="w-2.5 h-2.5 fill-amber-400" />
                    <span className="font-mono text-[8px] ml-0.5">{rating}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
