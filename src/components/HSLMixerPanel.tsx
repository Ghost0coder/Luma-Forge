import React, { useState } from 'react';
import { HSLColorName, HSLMixer } from '../types/editor';

interface HSLMixerPanelProps {
  mixer: HSLMixer;
  onChange: (mixer: HSLMixer) => void;
}

const COLOR_CHANNELS: { key: HSLColorName; label: string; dotColor: string }[] = [
  { key: 'red', label: 'Red', dotColor: '#ef4444' },
  { key: 'orange', label: 'Orange', dotColor: '#f97316' },
  { key: 'yellow', label: 'Yellow', dotColor: '#eab308' },
  { key: 'green', label: 'Green', dotColor: '#22c55e' },
  { key: 'aqua', label: 'Aqua', dotColor: '#06b6d4' },
  { key: 'blue', label: 'Blue', dotColor: '#3b82f6' },
  { key: 'purple', label: 'Purple', dotColor: '#a855f7' },
  { key: 'magenta', label: 'Magenta', dotColor: '#ec4899' },
];

export const HSLMixerPanel: React.FC<HSLMixerPanelProps> = React.memo(({ mixer, onChange }) => {
  const [selectedChannel, setSelectedChannel] = useState<HSLColorName>('red');
  const [activeProperty, setActiveProperty] = useState<'all' | 'hue' | 'saturation' | 'luminance'>('all');

  const channelData = mixer[selectedChannel];

  const handleUpdate = (prop: 'hue' | 'saturation' | 'luminance', val: number) => {
    onChange({
      ...mixer,
      [selectedChannel]: {
        ...mixer[selectedChannel],
        [prop]: val,
      },
    });
  };

  const handleResetChannel = (ch: HSLColorName) => {
    onChange({
      ...mixer,
      [ch]: { hue: 0, saturation: 0, luminance: 0 },
    });
  };

  return (
    <div className="space-y-3">
      {/* 8 Color Channel Buttons */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
        {COLOR_CHANNELS.map((ch) => {
          const isSelected = ch.key === selectedChannel;
          const hasEdits =
            mixer[ch.key].hue !== 0 ||
            mixer[ch.key].saturation !== 0 ||
            mixer[ch.key].luminance !== 0;

          return (
            <button
              key={ch.key}
              onClick={() => setSelectedChannel(ch.key)}
              title={ch.label}
              className={`flex flex-col items-center py-1.5 px-1 rounded-md border transition-all ${
                isSelected
                  ? 'bg-[#1b2230] border-violet-500 shadow-sm'
                  : 'bg-[#121620] hover:bg-[#181d2a] border-[#202738]'
              }`}
            >
              <div className="relative">
                <span
                  className="w-3.5 h-3.5 rounded-full block border border-black/40"
                  style={{ backgroundColor: ch.dotColor }}
                />
                {hasEdits && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-violet-400" />
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 truncate max-w-full">
                {ch.label.slice(0, 3)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Property Mode Tabs: All, Hue, Saturation, Luminance */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300 capitalize">
          {selectedChannel} Adjustments
        </span>
        <button
          onClick={() => handleResetChannel(selectedChannel)}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
        >
          Reset {selectedChannel}
        </button>
      </div>

      {/* Sliders */}
      <div className="space-y-2.5">
        {/* Hue */}
        {(activeProperty === 'all' || activeProperty === 'hue') && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Hue Shift</span>
              <span className="font-mono text-slate-300 tabular-nums">
                {channelData.hue > 0 ? `+${channelData.hue}` : channelData.hue}
              </span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={channelData.hue}
              onDoubleClick={() => handleUpdate('hue', 0)}
              onChange={(e) => handleUpdate('hue', parseInt(e.target.value, 10))}
              className="w-full"
            />
          </div>
        )}

        {/* Saturation */}
        {(activeProperty === 'all' || activeProperty === 'saturation') && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Saturation</span>
              <span className="font-mono text-slate-300 tabular-nums">
                {channelData.saturation > 0 ? `+${channelData.saturation}` : channelData.saturation}
              </span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={channelData.saturation}
              onDoubleClick={() => handleUpdate('saturation', 0)}
              onChange={(e) => handleUpdate('saturation', parseInt(e.target.value, 10))}
              className="w-full"
            />
          </div>
        )}

        {/* Luminance */}
        {(activeProperty === 'all' || activeProperty === 'luminance') && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Luminance</span>
              <span className="font-mono text-slate-300 tabular-nums">
                {channelData.luminance > 0 ? `+${channelData.luminance}` : channelData.luminance}
              </span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              value={channelData.luminance}
              onDoubleClick={() => handleUpdate('luminance', 0)}
              onChange={(e) => handleUpdate('luminance', parseInt(e.target.value, 10))}
              className="w-full"
            />
          </div>
        )}
      </div>
    </div>
  );
});

