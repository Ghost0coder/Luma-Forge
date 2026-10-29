import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Adjustments, HistogramData, HistoryEntry, PhotoProject, Preset, AIAnalysisResult, LocalMask } from './types/editor';
import { getDefaultAdjustments, cloneAdjustments } from './engine/defaultAdjustments';
import { BUILT_IN_PRESETS } from './presets/builtInPresets';
import { applyPresetWithStrength } from './presets/presetUtils';
import { computeHistogram } from './engine/histogram';
import { analyzePhoto } from './services/aiService';
import { segmentSubject } from './engine/segmentation/aiSegmentation';
import {
  saveProject,
  getAllProjects,
  deleteProjectById,
  saveCustomPreset,
  getAllCustomPresets,
  deleteCustomPreset,
} from './services/db';
import { SAMPLE_PHOTOS, SamplePhoto } from './data/samplePhotos';

import { TopToolbar } from './components/TopToolbar';
import { LeftSidebar } from './components/LeftSidebar';
import { RightSidebar } from './components/RightSidebar';
import { CanvasViewport } from './components/CanvasViewport';
import { Filmstrip, FilmstripItem } from './components/Filmstrip';
import { ExportModal } from './components/ExportModal';
import { BatchModal } from './components/BatchModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { HomePage } from './pages/HomePage';
import { Analytics } from '@vercel/analytics/react';
import { Snapshot } from './types/editor';

export default function App() {
  // Routing state ('home' | 'editor')
  const [currentRoute, setCurrentRoute] = useState<'home' | 'editor'>(() => {
    return window.location.pathname === '/editor' ? 'editor' : 'home';
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname === '/editor' ? 'editor' : 'home');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (route: string) => {
    const target = route === '/editor' ? 'editor' : 'home';
    setCurrentRoute(target);
    const path = target === 'editor' ? '/editor' : '/';
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Main photo state
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string>('sample-portrait.jpg');
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Non-destructive adjustments
  const [adjustments, setAdjustments] = useState<Adjustments>(getDefaultAdjustments());

  // History stack
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      id: 'init',
      action: 'Import Photo',
      timestamp: Date.now(),
      adjustments: getDefaultAdjustments(),
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Projects & Library in IndexedDB
  const [projects, setProjects] = useState<PhotoProject[]>([]);

  // Presets
  const [customPresets, setCustomPresets] = useState<Preset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [presetStrength, setPresetStrength] = useState<number>(1.0);

  // Real-time Histogram
  const [histogramData, setHistogramData] = useState<HistogramData | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Comparison & View Mode
  const [comparisonMode, setComparisonMode] = useState<'off' | 'split' | 'side-by-side'>('off');
  const [isHoldingCompare, setIsHoldingCompare] = useState<boolean>(false);

  // UI state
  const [leftSidebarOpen, setLeftSidebarOpen] = useState<boolean>(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState<boolean>(true);
  const [leftTab, setLeftTab] = useState<'library' | 'presets' | 'history'>('presets');
  const [activeMaskId, setActiveMaskId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [zoomMode, setZoomMode] = useState<'fit' | '100%' | '200%' | 'custom'>('fit');

  // Snapshots & Filmstrip metadata state
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [flags, setFlags] = useState<Record<string, 'pick' | 'reject' | 'none'>>({});
  const [colorLabels, setColorLabels] = useState<Record<string, 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'none'>>({});
  const [isFilmstripCollapsed, setIsFilmstripCollapsed] = useState<boolean>(false);
  const [activePhotoId, setActivePhotoId] = useState<string>('sample-portrait');

  // AI Photographic Diagnosis & Segmentation
  const [isAIAnalyzing, setIsAIAnalyzing] = useState<boolean>(false);
  const [isSegmenting, setIsSegmenting] = useState<boolean>(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);

  // Modals
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isBatchOpen, setIsBatchOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  // Hidden file input for import
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Compute Filmstrip Items (combines sample photos & saved projects)
  const filmstripItems: FilmstripItem[] = [
    ...SAMPLE_PHOTOS.map((s) => ({
      id: s.id,
      title: s.title,
      url: s.url,
      category: s.category,
      isProject: false,
    })),
    ...projects.map((p) => ({
      id: p.id,
      title: p.name,
      url: p.imageDataUrl,
      thumbnailUrl: p.thumbnailUrl,
      isProject: true,
    })),
  ];

  const handleFilmstripSelect = (item: FilmstripItem) => {
    setActivePhotoId(item.id);
    if (item.isProject) {
      handleSelectProject(item.id);
    } else {
      const match = SAMPLE_PHOTOS.find((s) => s.id === item.id) || SAMPLE_PHOTOS[0];
      loadSamplePhoto(match);
    }
  };

  const handleFilmstripNext = () => {
    const currIdx = filmstripItems.findIndex((f) => f.id === activePhotoId);
    if (currIdx >= 0 && currIdx < filmstripItems.length - 1) {
      handleFilmstripSelect(filmstripItems[currIdx + 1]);
    }
  };

  const handleFilmstripPrev = () => {
    const currIdx = filmstripItems.findIndex((f) => f.id === activePhotoId);
    if (currIdx > 0) {
      handleFilmstripSelect(filmstripItems[currIdx - 1]);
    }
  };

  const handleSaveSnapshot = (name: string) => {
    const newSnap: Snapshot = {
      id: `snap-${Date.now()}`,
      name,
      timestamp: Date.now(),
      adjustments: cloneAdjustments(adjustments),
    };
    setSnapshots((prev) => [...prev, newSnap]);
  };

  const handleRestoreSnapshot = (snap: Snapshot) => {
    updateAdjustments(cloneAdjustments(snap.adjustments), `Restore Snapshot: ${snap.name}`);
  };

  const handleDeleteSnapshot = (id: string) => {
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
  };

  // Load initial IndexedDB data on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const storedProjects = await getAllProjects();
        setProjects(storedProjects);
        const storedPresets = await getAllCustomPresets();
        setCustomPresets(storedPresets);
      } catch (err) {
        console.error('Failed to load initial IndexedDB data:', err);
      }
    }
    loadInitialData();
  }, []);

  // Load default sample photo on initial load
  useEffect(() => {
    loadSamplePhoto(SAMPLE_PHOTOS[0]);
  }, []);

  // Load a sample photo
  const loadSamplePhoto = (sample: SamplePhoto) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => {
      console.warn('Sample image failed to load, falling back to local sample');
      if (sample.url !== SAMPLE_PHOTOS[0].url) {
        loadSamplePhoto(SAMPLE_PHOTOS[0]);
      }
    };
    img.onload = () => {
      setSourceImage(img);
      setCurrentFilename(`${sample.id}.jpg`);
      setCurrentProjectId(null);
      const defaultAdj = getDefaultAdjustments();
      setAdjustments(defaultAdj);
      setActivePresetId(null);
      setAiAnalysis(null);
      setHistory([
        {
          id: `hist-${Date.now()}`,
          action: `Load ${sample.title}`,
          timestamp: Date.now(),
          adjustments: defaultAdj,
        },
      ]);
      setHistoryIndex(0);
    };
    img.src = sample.url;
  };

  // Import user file (JPEG, PNG, WebP)
  const handleFileImport = (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPEG, PNG, or WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      alert('Failed to read selected image file. Please try a different photo.');
    };
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onerror = () => {
        alert('Could not decode or parse image file format.');
      };
      img.onload = async () => {
        setSourceImage(img);
        setCurrentFilename(file.name);
        const defaultAdj = getDefaultAdjustments();
        setAdjustments(defaultAdj);
        setActivePresetId(null);
        setAiAnalysis(null);

        const newProjectId = `proj-${Date.now()}`;
        setCurrentProjectId(newProjectId);

        const initialHistory: HistoryEntry[] = [
          {
            id: `hist-${Date.now()}`,
            action: `Import ${file.name}`,
            timestamp: Date.now(),
            adjustments: defaultAdj,
          },
        ];
        setHistory(initialHistory);
        setHistoryIndex(0);

        // Generate small thumbnail for IndexedDB catalog
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 120;
        thumbCanvas.height = 120;
        const tctx = thumbCanvas.getContext('2d');
        if (tctx) {
          tctx.drawImage(img, 0, 0, 120, 120);
        }
        const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);

        const newProj: PhotoProject = {
          id: newProjectId,
          name: file.name,
          imageDataUrl: dataUrl,
          thumbnailUrl: thumbUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
          fileSize: file.size,
          mimeType: file.type,
          adjustments: defaultAdj,
          history: initialHistory,
          historyIndex: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await saveProject(newProj);
        const updatedList = await getAllProjects();
        setProjects(updatedList);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop onto document
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileImport(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const dbSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveProjectToDBDebounced = useCallback(
    (projId: string, adj: Adjustments, hist: HistoryEntry[], idx: number) => {
      if (dbSaveTimerRef.current) {
        clearTimeout(dbSaveTimerRef.current);
      }
      dbSaveTimerRef.current = setTimeout(async () => {
        try {
          const proj = projects.find((p) => p.id === projId);
          if (proj) {
            const updated: PhotoProject = {
              ...proj,
              adjustments: adj,
              history: hist,
              historyIndex: idx,
              updatedAt: Date.now(),
            };
            await saveProject(updated);
            setProjects((prev) => prev.map((p) => (p.id === projId ? updated : p)));
          }
        } catch (err) {
          console.error('Failed to update project in IndexedDB:', err);
        }
      }, 600);
    },
    [projects]
  );

  // Push adjustment update onto history
  const updateAdjustments = useCallback(
    (newAdj: Adjustments, actionName: string) => {
      setAdjustments(newAdj);

      // Slice any future redo entries
      const nextHistory = history.slice(0, historyIndex + 1);
      const lastEntry = nextHistory[nextHistory.length - 1];
      const isContinuousAction =
        lastEntry &&
        lastEntry.action === actionName &&
        Date.now() - lastEntry.timestamp < 1200;

      if (isContinuousAction) {
        lastEntry.adjustments = cloneAdjustments(newAdj);
        lastEntry.timestamp = Date.now();
        setHistory(nextHistory);
        if (currentProjectId) {
          saveProjectToDBDebounced(currentProjectId, newAdj, nextHistory, nextHistory.length - 1);
        }
      } else {
        const newEntry: HistoryEntry = {
          id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          action: actionName,
          timestamp: Date.now(),
          adjustments: cloneAdjustments(newAdj),
        };

        nextHistory.push(newEntry);
        setHistory(nextHistory);
        setHistoryIndex(nextHistory.length - 1);

        if (currentProjectId) {
          saveProjectToDBDebounced(currentProjectId, newAdj, nextHistory, nextHistory.length - 1);
        }
      }
    },
    [history, historyIndex, currentProjectId, saveProjectToDBDebounced]
  );

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setAdjustments(cloneAdjustments(history[prevIdx].adjustments));
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setAdjustments(cloneAdjustments(history[nextIdx].adjustments));
    }
  }, [historyIndex, history]);

  // Jump to specific history state
  const handleJumpToHistory = (idx: number) => {
    if (idx >= 0 && idx < history.length) {
      setHistoryIndex(idx);
      setAdjustments(cloneAdjustments(history[idx].adjustments));
    }
  };

  // Reset all adjustments
  const handleReset = () => {
    const defaultAdj = getDefaultAdjustments();
    updateAdjustments(defaultAdj, 'Reset All Adjustments');
    setActivePresetId(null);
  };

  // Preset application with strength
  const handleApplyPreset = (preset: Preset, strength = 1.0) => {
    setActivePresetId(preset.id);
    setPresetStrength(strength);
    const newAdj = applyPresetWithStrength(adjustments, preset, strength);
    updateAdjustments(newAdj, `Apply Preset: ${preset.name}`);
  };

  const handlePresetStrengthChange = (strength: number) => {
    setPresetStrength(strength);
    const allPresets = [...BUILT_IN_PRESETS, ...customPresets];
    const preset = allPresets.find((p) => p.id === activePresetId);
    if (preset) {
      const baseAdj = historyIndex > 0 ? history[0].adjustments : getDefaultAdjustments();
      const newAdj = applyPresetWithStrength(baseAdj, preset, strength);
      setAdjustments(newAdj);
    }
  };

  // Custom preset saving
  const handleSaveCustomPreset = async (name: string, description: string) => {
    const newPreset: Preset = {
      id: `custom-${Date.now()}`,
      name,
      category: 'Custom',
      description,
      adjustments: cloneAdjustments(adjustments),
      createdAt: Date.now(),
      isCustom: true,
    };
    await saveCustomPreset(newPreset);
    const stored = await getAllCustomPresets();
    setCustomPresets(stored);
    setActivePresetId(newPreset.id);
  };

  const handleDeleteCustomPreset = async (id: string) => {
    await deleteCustomPreset(id);
    const stored = await getAllCustomPresets();
    setCustomPresets(stored);
    if (activePresetId === id) setActivePresetId(null);
  };

  const handleImportCustomPreset = async (preset: Preset) => {
    await saveCustomPreset(preset);
    const stored = await getAllCustomPresets();
    setCustomPresets(stored);
    handleApplyPreset(preset);
  };

  // Select project from library
  const handleSelectProject = (id: string) => {
    const proj = projects.find((p) => p.id === id);
    if (!proj) return;
    const img = new Image();
    img.onload = () => {
      setSourceImage(img);
      setCurrentFilename(proj.name);
      setCurrentProjectId(proj.id);
      setAdjustments(proj.adjustments);
      setHistory(proj.history || [{ id: '1', action: 'Loaded session', timestamp: Date.now(), adjustments: proj.adjustments }]);
      setHistoryIndex(proj.historyIndex || 0);
      setActivePresetId(null);
    };
    img.src = proj.imageDataUrl;
  };

  const handleDeleteProject = async (id: string) => {
    await deleteProjectById(id);
    const stored = await getAllProjects();
    setProjects(stored);
    if (currentProjectId === id) {
      loadSamplePhoto(SAMPLE_PHOTOS[0]);
    }
  };

  // Batch operations
  const handleBatchApplyPresetToProjects = async (projectIds: string[], preset: Preset) => {
    for (const projId of projectIds) {
      const proj = projects.find((p) => p.id === projId);
      if (proj) {
        const newAdj = applyPresetWithStrength(proj.adjustments, preset, 1.0);
        await saveProject({ ...proj, adjustments: newAdj, updatedAt: Date.now() });
      }
    }
    const stored = await getAllProjects();
    setProjects(stored);
  };

  const handleBatchPasteAdjustments = async (projectIds: string[], targetAdj: Adjustments) => {
    for (const projId of projectIds) {
      const proj = projects.find((p) => p.id === projId);
      if (proj) {
        await saveProject({ ...proj, adjustments: cloneAdjustments(targetAdj), updatedAt: Date.now() });
      }
    }
    const stored = await getAllProjects();
    setProjects(stored);
  };

  // Callback from CanvasViewport when frame renders: computes live histogram
  const animFrameRef = useRef<number | null>(null);

  const handleCanvasRendered = useCallback((canvas: HTMLCanvasElement) => {
    liveCanvasRef.current = canvas;
    if (animFrameRef.current !== null) return;
    animFrameRef.current = requestAnimationFrame(() => {
      animFrameRef.current = null;
      if (liveCanvasRef.current) {
        const hist = computeHistogram(liveCanvasRef.current);
        setHistogramData(hist);
      }
    });
  }, []);

  // AI Auto-Enhance runner
  const handleRunAIEnhance = async () => {
    if (!liveCanvasRef.current) return;
    setIsAIAnalyzing(true);
    try {
      const result = await analyzePhoto(liveCanvasRef.current);
      setAiAnalysis(result);
      if (result.suggestedAdjustments) {
        const merged: Adjustments = {
          ...adjustments,
          ...result.suggestedAdjustments,
        };
        updateAdjustments(merged, 'Auto-Enhance');
      }
    } catch (err) {
      console.error('Auto-Enhance failed:', err);
    } finally {
      setIsAIAnalyzing(false);
    }
  };

  // Subject / Background Segmentation runner
  const handleGenerateAISubjectMask = async (type: 'ai-subject' | 'ai-background') => {
    if (!sourceImage && !liveCanvasRef.current) return;
    setIsSegmenting(true);

    try {
      const source = liveCanvasRef.current || sourceImage!;
      const result = await segmentSubject(source);

      const isBg = type === 'ai-background';
      const maskId = `mask-ai-${Date.now()}`;
      const newMask: LocalMask = {
        id: maskId,
        name: isBg ? 'Background Mask' : 'Subject Mask',
        type,
        enabled: true,
        inverted: isBg,
        opacity: 1.0,
        showOverlay: true,
        maskBitmap: result.bitmap,
        maskWidth: result.width,
        maskHeight: result.height,
        refineMode: 'none',
        refineRadius: 0.06,
        refineStrokes: [],
        adjustments: {
          exposure: isBg ? -0.4 : 0.35,
          contrast: isBg ? -10 : 15,
          saturation: isBg ? -15 : 12,
          temperature: isBg ? -5 : 4,
          sharpness: isBg ? -20 : 15,
        },
      };

      const newMasks = [...adjustments.masks, newMask];
      updateAdjustments(
        { ...adjustments, masks: newMasks },
        `Add ${isBg ? 'Background' : 'Subject'} Mask`
      );
      setActiveMaskId(maskId);
    } catch (err) {
      console.error('Subject segmentation failed:', err);
      alert('Subject Segmentation failed. Please try again.');
    } finally {
      setIsSegmenting(false);
    }
  };

  // Keyboard shortcut listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl+Y or Cmd+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }
      // Compare: \ (backslash)
      if (e.key === '\\') {
        e.preventDefault();
        setIsHoldingCompare(true);
      }
      // Export: Cmd+E
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setIsExportOpen(true);
      }
      // Crop toggle: C
      if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setAdjustments((prev) => ({
          ...prev,
          crop: { ...prev.crop, active: !prev.crop.active },
        }));
      }
      // Mask Overlay toggle: O
      if (e.key.toLowerCase() === 'o' && !e.ctrlKey && !e.metaKey && activeMaskId) {
        e.preventDefault();
        setAdjustments((prev) => ({
          ...prev,
          masks: prev.masks.map((m) =>
            m.id === activeMaskId ? { ...m, showOverlay: !m.showOverlay } : m
          ),
        }));
      }
      // Tab: toggle sidebars
      if (e.key === 'Tab') {
        e.preventDefault();
        setLeftSidebarOpen((prev) => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === '\\') {
        setIsHoldingCompare(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleUndo, handleRedo]);

  if (currentRoute === 'home') {
    return (
      <HomePage
        onNavigate={handleNavigate}
        onSelectSample={(sample) => {
          loadSamplePhoto(sample);
          handleNavigate('/editor');
        }}
      />
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#07090d] text-slate-200 select-none"
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileImport(e.target.files[0]);
          }
        }}
        className="hidden"
      />

      {/* TOP TOOLBAR */}
      <TopToolbar
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onReset={handleReset}
        onImportClick={() => fileInputRef.current?.click()}
        onExportClick={() => setIsExportOpen(true)}
        onOpenBatch={() => setIsBatchOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        comparisonMode={comparisonMode}
        onComparisonChange={setComparisonMode}
        isHoldingCompare={isHoldingCompare}
        setIsHoldingCompare={setIsHoldingCompare}
        hasImage={!!sourceImage}
        onHomeClick={() => handleNavigate('/')}
        currentFilename={currentFilename}
      />

      {/* WORKSPACE 3-COLUMN LAYOUT */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT SIDEBAR: Library, Presets, History & Snapshots */}
        <LeftSidebar
          activeTab={leftTab}
          setActiveTab={setLeftTab}
          isOpen={leftSidebarOpen}
          onToggleOpen={() => setLeftSidebarOpen(!leftSidebarOpen)}
          onSelectSample={loadSamplePhoto}
          projects={projects}
          currentProjectId={currentProjectId}
          onSelectProject={handleSelectProject}
          onDeleteProject={handleDeleteProject}
          builtInPresets={BUILT_IN_PRESETS}
          customPresets={customPresets}
          activePresetId={activePresetId}
          presetStrength={presetStrength}
          onApplyPreset={handleApplyPreset}
          onPresetStrengthChange={handlePresetStrengthChange}
          onSaveCustomPreset={handleSaveCustomPreset}
          onImportCustomPreset={handleImportCustomPreset}
          onDeleteCustomPreset={handleDeleteCustomPreset}
          history={history}
          historyIndex={historyIndex}
          onJumpToHistory={handleJumpToHistory}
          sourceImage={sourceImage}
          snapshots={snapshots}
          onSaveSnapshot={handleSaveSnapshot}
          onRestoreSnapshot={handleRestoreSnapshot}
          onDeleteSnapshot={handleDeleteSnapshot}
          zoom={zoom}
          onSetZoom={(z) => {
            setZoom(z);
            setZoomMode(z === 1.0 ? '100%' : z === 2.0 ? '200%' : 'custom');
          }}
          onFit={() => setZoomMode('fit')}
        />

        {/* CENTER VIEWPORT: Canvas with Zoom, Pan, Split, Side-by-Side, Crop Overlay */}
        <CanvasViewport
          sourceImage={sourceImage}
          adjustments={adjustments}
          onChangeAdjustments={updateAdjustments}
          comparisonMode={comparisonMode}
          isHoldingCompare={isHoldingCompare}
          onCanvasRendered={handleCanvasRendered}
          activeMaskId={activeMaskId}
          zoom={zoom}
          onSetZoom={setZoom}
          zoomMode={zoomMode}
          onSetZoomMode={setZoomMode}
        />

        {/* RIGHT SIDEBAR: Live Histogram, Light, Color, Tone Curve, HSL, Detail, Geometry, Local Masks */}
        <RightSidebar
          adjustments={adjustments}
          onChangeAdjustments={updateAdjustments}
          histogramData={histogramData}
          onRunAIEnhance={handleRunAIEnhance}
          isAIAnalyzing={isAIAnalyzing}
          aiAnalysis={aiAnalysis}
          activeMaskId={activeMaskId}
          setActiveMaskId={setActiveMaskId}
          onGenerateAISubjectMask={handleGenerateAISubjectMask}
          isSegmenting={isSegmenting}
          isOpen={rightSidebarOpen}
          onToggleOpen={() => setRightSidebarOpen(!rightSidebarOpen)}
          sourceImage={sourceImage}
        />
      </div>

      {/* BOTTOM FILMSTRIP */}
      <Filmstrip
        items={filmstripItems}
        activeId={activePhotoId}
        onSelect={handleFilmstripSelect}
        onNext={handleFilmstripNext}
        onPrev={handleFilmstripPrev}
        ratings={ratings}
        flags={flags}
        colorLabels={colorLabels}
        onSetRating={(id, r) => setRatings((prev) => ({ ...prev, [id]: r }))}
        onSetFlag={(id, f) => setFlags((prev) => ({ ...prev, [id]: f }))}
        onSetColorLabel={(id, c) => setColorLabels((prev) => ({ ...prev, [id]: c }))}
        isCollapsed={isFilmstripCollapsed}
        onToggleCollapse={() => setIsFilmstripCollapsed(!isFilmstripCollapsed)}
      />

      {/* EXPORT MODAL */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        sourceImage={sourceImage}
        adjustments={adjustments}
        defaultFilename={currentFilename}
      />

      {/* BATCH WORKFLOW MODAL */}
      <BatchModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        projects={projects}
        currentAdjustments={adjustments}
        onBatchApplyPresetToProjects={handleBatchApplyPresetToProjects}
        onBatchPasteAdjustments={handleBatchPasteAdjustments}
      />

      {/* KEYBOARD SHORTCUTS MODAL */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* VERCEL WEB ANALYTICS */}
      <Analytics />
    </div>
  );
}
