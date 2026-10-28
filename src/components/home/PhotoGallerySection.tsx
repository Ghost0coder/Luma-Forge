import React, { useState } from 'react';
import { Sliders, Sparkles } from 'lucide-react';
import { SAMPLE_PHOTOS } from '../../data/samplePhotos';
import samplePortrait from '../../assets/images/sample_portrait_editorial_1793160633779.jpg';
import sampleLandscape from '../../assets/images/sample_landscape_peaks_1793160633388.jpg';
import sampleStreet from '../../assets/images/sample_street_architecture_1793160634115.jpg';

interface PhotoGallerySectionProps {
  onNavigate: (route: string) => void;
  onSelectSample?: (sample: any) => void;
}

export const PhotoGallerySection: React.FC<PhotoGallerySectionProps> = ({
  onNavigate,
  onSelectSample,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const galleryImages = [
    {
      id: 'sample-portrait',
      title: 'Natural Light Portrait',
      category: 'Portrait',
      url: samplePortrait,
      aspect: 'aspect-[3/4]',
      iso: 'ISO 100',
      shutter: '1/400s',
      lens: '85mm f/1.4',
    },
    {
      id: 'sample-landscape',
      title: 'Alpine Sunrise Peaks',
      category: 'Landscape',
      url: sampleLandscape,
      aspect: 'aspect-[16/10]',
      iso: 'ISO 200',
      shutter: '1/125s',
      lens: '24mm f/8',
    },
    {
      id: 'sample-street',
      title: 'Twilight City Reflections',
      category: 'Street',
      url: sampleStreet,
      aspect: 'aspect-[4/3]',
      iso: 'ISO 800',
      shutter: '1/60s',
      lens: '35mm f/2.0',
    },

    {
      id: 'gallery-architecture',
      title: 'Monolithic Geometry',
      category: 'Architecture',
      url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
      aspect: 'aspect-[3/4]',
      iso: 'ISO 100',
      shutter: '1/250s',
      lens: '16mm f/5.6',
    },
    {
      id: 'gallery-nature',
      title: 'Misty Redwood Forest',
      category: 'Nature',
      url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80',
      aspect: 'aspect-[4/3]',
      iso: 'ISO 400',
      shutter: '1/100s',
      lens: '50mm f/2.8',
    },
    {
      id: 'gallery-desert',
      title: 'Minimalist Desert Dunes',
      category: 'Landscape',
      url: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80',
      aspect: 'aspect-[16/10]',
      iso: 'ISO 100',
      shutter: '1/1000s',
      lens: '70mm f/11',
    },
  ];

  const categories = ['All', 'Portrait', 'Landscape', 'Street', 'Architecture', 'Nature'];

  const filteredImages =
    activeCategory === 'All'
      ? galleryImages
      : galleryImages.filter((img) => img.category === activeCategory);

  const handleLaunchSample = (img: typeof galleryImages[0]) => {
    // Find matching sample photo if exists or pass custom
    const match = SAMPLE_PHOTOS.find((s) => s.id === img.id) || {
      id: img.id,
      title: img.title,
      category: img.category as any,
      url: img.url,
    };
    if (onSelectSample) {
      onSelectSample(match);
    }
    onNavigate('/editor');
  };

  return (
    <section id="gallery" className="py-20 lg:py-28 bg-[#090b11] relative border-t border-[#171c28]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <span className="text-xs font-mono font-semibold tracking-widest text-violet-400 uppercase">
            EDITORIAL SHOWCASE
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Made for Every Style of Photography
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Click any photograph to load it instantly inside the LumaForge editing workspace.
          </p>
        </div>

        {/* Category Pills */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-950/40'
                  : 'bg-[#121623] text-slate-400 hover:text-white border border-[#232b3e]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Masonry Gallery Columns */}
        {filteredImages.length === 0 ? (
          <div className="mt-12 text-center py-12 text-slate-400 text-sm">
            No photographs found in this category.
          </div>
        ) : (
          <div className="mt-12 columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
            {filteredImages.map((img) => (
              <div
                key={img.id}
                className="break-inside-avoid mb-6 inline-block w-full group relative rounded-2xl overflow-hidden bg-[#0e121c] border border-[#1e2638] hover:border-violet-500/50 transition-all duration-300 shadow-lg"
              >
                {/* Photo Image Container */}
                <div className={`w-full ${img.aspect} overflow-hidden relative bg-slate-950`}>
                  <img
                    src={img.url}
                    alt={img.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      if (img.id === 'sample-portrait')
                        (e.currentTarget as HTMLImageElement).src =
                          '/samples/sample_portrait_editorial_1793160633779.jpg';
                      else if (img.id === 'sample-landscape')
                        (e.currentTarget as HTMLImageElement).src =
                          '/samples/sample_landscape_peaks_1793160633388.jpg';
                      else if (img.id === 'sample-street')
                        (e.currentTarget as HTMLImageElement).src =
                          '/samples/sample_street_architecture_1793160634115.jpg';
                    }}
                  />

                  {/* Dark Gradient Overlay on Image Bottom for Depth */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-40 group-hover:opacity-70 transition-opacity pointer-events-none" />

                  {/* Top Category Badge */}
                  <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md text-[11px] font-mono text-violet-300 border border-white/10 shadow-sm">
                    {img.category}
                  </div>
                </div>

                {/* Card Information & Actions Footer */}
                <div className="p-4 sm:p-5 space-y-3 bg-[#0e121c] border-t border-[#182030]">
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug group-hover:text-violet-300 transition-colors">
                    {img.title}
                  </h3>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span>{img.iso}</span>
                    <span>•</span>
                    <span>{img.shutter}</span>
                    <span>•</span>
                    <span>{img.lens}</span>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={() => handleLaunchSample(img)}
                      className="w-full py-2.5 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-violet-950/60 cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Edit in LumaForge</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
