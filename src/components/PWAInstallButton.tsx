import React, { useState, useEffect } from 'react';
import { Download, Share2, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(iosDevice);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  if (!deferredPrompt && !isIOS) return null;

  return (
    <>
      <button
        onClick={handleInstallClick}
        title="Install LumaForge PWA"
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-violet-300 bg-violet-950/60 hover:bg-violet-900/80 border border-violet-800/60 rounded-md transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>

      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl bg-[#141822] border border-[#2b3345] p-5 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#232936]">
              <h3 className="text-sm font-semibold text-white">Install on iPhone / iPad</h3>
              <button
                onClick={() => setShowIOSModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 space-y-2.5 text-xs text-slate-300">
              <p className="flex items-start gap-2">
                <span className="font-semibold text-violet-400">1.</span>
                <span>
                  Tap the <Share2 className="inline w-3.5 h-3.5 text-violet-400 mx-0.5" /> <strong>Share</strong> button in Safari's bottom toolbar.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-semibold text-violet-400">2.</span>
                <span>
                  Scroll down and tap <strong>Add to Home Screen</strong>.
                </span>
              </p>
              <p className="flex items-start gap-2">
                <span className="font-semibold text-violet-400">3.</span>
                <span>Open LumaForge from your home screen for full-screen offline editing.</span>
              </p>
            </div>
            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-4 w-full py-1.5 text-xs font-medium bg-[#1e2432] hover:bg-[#283042] text-white rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
