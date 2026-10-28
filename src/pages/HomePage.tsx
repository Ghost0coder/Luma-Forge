import React from 'react';
import { Navbar } from '../components/home/Navbar';
import { HeroSection } from '../components/home/HeroSection';
import { FeaturesSection } from '../components/home/FeaturesSection';
import { AIShowcaseSection } from '../components/home/AIShowcaseSection';
import { PresetsShowcase } from '../components/home/PresetsShowcase';
import { HowItWorksSection } from '../components/home/HowItWorksSection';
import { PhotoGallerySection } from '../components/home/PhotoGallerySection';
import { CTASection } from '../components/home/CTASection';
import { Footer } from '../components/home/Footer';

interface HomePageProps {
  onNavigate: (route: string) => void;
  onSelectSample?: (sample: any) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onSelectSample }) => {
  return (
    <div className="min-h-screen w-full bg-[#07090d] text-slate-200 selection:bg-violet-600 selection:text-white font-sans">
      <Navbar onNavigate={onNavigate} />
      <main>
        <HeroSection onNavigate={onNavigate} />
        <FeaturesSection onNavigate={onNavigate} />
        <AIShowcaseSection onNavigate={onNavigate} />
        <PresetsShowcase onNavigate={onNavigate} />
        <HowItWorksSection />
        <PhotoGallerySection onNavigate={onNavigate} onSelectSample={onSelectSample} />
        <CTASection onNavigate={onNavigate} />
      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  );
};
