import React, { useState } from 'react';
import { X, Download, FileImage, Check } from 'lucide-react';
import { Adjustments } from '../types/editor';
import { renderImageAdjustments } from '../engine/pipeline';
import { getExportDimensions } from '../engine/cropUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceImage: HTMLImageElement | null;
  adjustments: Adjustments;
  defaultFilename: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  sourceImage,
  adjustments,
  defaultFilename,
}) => {
  const [format, setFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/jpeg');
  const [quality, setQuality] = useState<number>(92);
  const [scale, setScale] = useState<number>(1.0); // 1.0, 0.75, 0.5
  const [filename, setFilename] = useState<string>(
    defaultFilename ? defaultFilename.replace(/\.[^.]+$/, '') : 'lumaforge-edit'
  );
  const [isExporting, setIsExporting] = useState<boolean>(false);

  if (!isOpen || !sourceImage) return null;

  const origW = sourceImage.naturalWidth || sourceImage.width;
  const origH = sourceImage.naturalHeight || sourceImage.height;

  // Compute final dimensions after crop & scale
  const { width: finalW, height: finalH } = getExportDimensions(origW, origH, adjustments.crop, scale);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Create full-resolution offscreen export canvas
      const exportCanvas = document.createElement('canvas');

      // Non-destructive rendering pipeline executed at full chosen target resolution!
      renderImageAdjustments(sourceImage, exportCanvas, adjustments, {
        maxDimension: Math.max(finalW, finalH),
      });

      const mime = format;
      const q = format === 'image/png' ? undefined : quality / 100;
      const dataUrl = exportCanvas.toDataURL(mime, q);

      // Trigger download
      const ext = format === 'image/jpeg' ? 'jpg' : format === 'image/png' ? 'png' : 'webp';
      const cleanName = filename.trim() || 'lumaforge-edit';
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${cleanName}.${ext}`;
      a.click();
      onClose();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please check browser memory limits.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-md bg-[#131722] border border-[#262e40] rounded-xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#202738] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileImage className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Export Final Photograph</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Filename */}
          <div className="space-y-1.5">
            <label className="text-slate-400 font-medium">Output Filename</label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="w-full px-3 py-2 bg-[#0e1118] border border-[#262e40] rounded-lg text-slate-200 text-xs focus:outline-none focus:border-violet-500"
              placeholder="lumaforge-edit"
            />
          </div>

          {/* Format Selection */}
          <div className="space-y-1.5">
            <label className="text-slate-400 font-medium">Format</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'JPEG (Web)', val: 'image/jpeg' },
                { label: 'PNG (Lossless)', val: 'image/png' },
                { label: 'WebP (Modern)', val: 'image/webp' },
              ].map((item) => (
                <button
                  key={item.val}
                  onClick={() => setFormat(item.val as any)}
                  className={`py-2 px-2.5 rounded-lg border text-center transition-all ${
                    format === item.val
                      ? 'bg-violet-950/60 border-violet-500 text-white font-medium shadow-sm'
                      : 'bg-[#181d2a] hover:bg-[#202738] border-[#262e40] text-slate-400'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality Slider (Lossy formats) */}
          {format !== 'image/png' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-slate-400 font-medium">Export Quality</label>
                <span className="font-mono text-slate-300 tabular-nums">{quality}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                value={quality}
                onChange={(e) => setQuality(parseInt(e.target.value, 10))}
                className="w-full"
              />
            </div>
          )}

          {/* Scale / Resolution Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-slate-400 font-medium">Resolution Scaling</label>
              <span className="font-mono text-slate-400 tabular-nums">
                {finalW} × {finalH} px
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '100% Full Res', val: 1.0 },
                { label: '75% Crisp', val: 0.75 },
                { label: '50% Compact', val: 0.5 },
              ].map((item) => (
                <button
                  key={item.val}
                  onClick={() => setScale(item.val)}
                  className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                    scale === item.val
                      ? 'bg-violet-950/60 border-violet-500 text-white font-medium'
                      : 'bg-[#181d2a] hover:bg-[#202738] border-[#262e40] text-slate-400'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Metadata pill-free scannable info */}
          <div className="p-3 bg-[#0d1016] rounded-lg border border-[#1e2534] text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Original Source:</span>
              <span className="text-slate-200 font-mono">{origW} × {origH} px</span>
            </div>
            <div className="flex justify-between">
              <span>Render Engine:</span>
              <span className="text-slate-200">Non-Destructive Canvas Pipeline</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-[#202738] bg-[#0f121a] flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing Full Res...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Photo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
