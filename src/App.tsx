import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Adjustments,
  HistogramData,
  HistoryEntry,
  PhotoProject,
  Preset,
  AIAnalysisResult,
  LocalMask,
  Snapshot,
  WorkspaceMode,
  SelectionState,
  RetouchState,
  BackgroundRemovalState,
  PresetCategory,
} from './types/editor';
import { getDefaultAdjustments, cloneAdjustments } from './engine/defaultAdjustments';
import { BUILT_IN_PRESETS } from './presets/builtInPresets';
import { applyPresetWithStrength } from './presets/presetUtils';
import { clearPresetThumbnailCache } from './engine/presetThumbnailEngine';
import { computeHistogram } from './engine/histogram';
import { analyzePhoto, checkAIStatus, removeObjectOrWatermark } from './services/aiService';
import { segmentSubject } from './engine/segmentation/aiSegmentation';
import { detectAndSegmentPeople } from './engine/segmentation/peopleSegmentation';
import {
  invertSelectionMask,
  expandSelectionMask,
  contractSelectionMask,
  featherSelectionMask,
  applyAdjustmentsToSelection,
} from './engine/selection/selectionEngine';
import { extractSubjectMask, exportTransparentPNG } from './engine/segmentation/backgroundRemover';
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
import { SelectPanel } from './components/workspaces/SelectPanel';
import { RemovePanel } from './components/workspaces/RemovePanel';
import { BackgroundPanel } from './components/workspaces/BackgroundPanel';
import { Analytics } from '@vercel/analytics/react';

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

  // Workspace Mode: 'develop' | 'select' | 'remove' | 'background'
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('develop');

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
  const [presetPreviewAdjustments, setPresetPreviewAdjustments] = useState<Adjustments | null>(null);

  // Compute active displayed adjustments (live preview overrides current saved adjustments non-destructively)
  const displayAdjustments = presetPreviewAdjustments || adjustments;

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

  // 1. Traditional Object Selection Workspace State
  const [selectionState, setSelectionState] = useState<SelectionState>({
    mode: 'brush',
    operation: 'add',
    brushSize: 40,
    brushFeather: 10,
    tolerance: 30,
    contiguous: true,
    polygonPoints: [],
    lassoPoints: [],
    maskBitmap: null,
    maskWidth: 1200,
    maskHeight: 800,
    hasSelection: false,
    isDetectingPeople: false,
    personInfo: null,
    localAdjustments: {
      exposure: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      sharpness: 0,
    },
  });

  // 2. Retouch (Object & Watermark Removal) Workspace State
  const [retouchState, setRetouchState] = useState<RetouchState>({
    brushSize: 32,
    hardness: 80,
    feather: 8,
    mode: 'add',
    toolMode: 'person',
    maskBitmap: null,
    maskWidth: 1200,
    maskHeight: 800,
    hasMask: false,
    isProcessing: false,
    algorithm: 'ai',
    error: null,
    successMessage: null,
  });

  // 3. Background Removal Workspace State
  const [backgroundState, setBackgroundState] = useState<BackgroundRemovalState>({
    enabled: false,
    isProcessing: false,
    modelType: 'none',
    maskBitmap: null,
    maskWidth: 384,
    maskHeight: 384,
    mode: 'transparent',
    color: '#ffffff',
    blurRadius: 12,
    customBgUrl: null,
    feather: 4,
    edgeShift: 0,
    error: null,
  });

  const [serverAIConfigured, setServerAIConfigured] = useState<boolean>(false);

  // Check server AI status on mount
  useEffect(() => {
    checkAIStatus()
      .then((status) => {
        setServerAIConfigured(status.configured);
      })
      .catch(() => {
        setServerAIConfigured(false);
      });
  }, []);

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
      setPresetPreviewAdjustments(null);
      clearPresetThumbnailCache();
      setAiAnalysis(null);

      // Reset workspace masks to match new photo dimensions
      setSelectionState((prev) => ({
        ...prev,
        maskBitmap: null,
        maskWidth: img.width,
        maskHeight: img.height,
        hasSelection: false,
        isDetectingPeople: false,
        personInfo: null,
        polygonPoints: [],
        lassoPoints: [],
      }));
      setRetouchState((prev) => ({
        ...prev,
        maskBitmap: null,
        maskWidth: img.width,
        maskHeight: img.height,
        hasMask: false,
        toolMode: 'person',
        error: null,
        successMessage: null,
      }));
      setBackgroundState((prev) => ({
        ...prev,
        maskBitmap: null,
        modelType: 'none',
        error: null,
      }));

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
        setPresetPreviewAdjustments(null);
        clearPresetThumbnailCache();
        setAiAnalysis(null);

        // Reset workspace masks
        setSelectionState((prev) => ({
          ...prev,
          maskBitmap: null,
          maskWidth: img.width,
          maskHeight: img.height,
          hasSelection: false,
          isDetectingPeople: false,
          personInfo: null,
          polygonPoints: [],
          lassoPoints: [],
        }));
        setRetouchState((prev) => ({
          ...prev,
          maskBitmap: null,
          maskWidth: img.width,
          maskHeight: img.height,
          hasMask: false,
          toolMode: 'person',
          error: null,
          successMessage: null,
        }));
        setBackgroundState((prev) => ({
          ...prev,
          maskBitmap: null,
          modelType: 'none',
          error: null,
        }));

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
          width: img.width,
          height: img.height,
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

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      const targetState = history[newIdx].adjustments;
      setHistoryIndex(newIdx);
      setAdjustments(cloneAdjustments(targetState));
      if (currentProjectId) {
        saveProjectToDBDebounced(currentProjectId, targetState, history, newIdx);
      }
    }
  }, [historyIndex, history, currentProjectId, saveProjectToDBDebounced]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      const targetState = history[newIdx].adjustments;
      setHistoryIndex(newIdx);
      setAdjustments(cloneAdjustments(targetState));
      if (currentProjectId) {
        saveProjectToDBDebounced(currentProjectId, targetState, history, newIdx);
      }
    }
  }, [historyIndex, history, currentProjectId, saveProjectToDBDebounced]);

  // Reset to initial unedited photo
  const handleReset = () => {
    const defaultAdj = getDefaultAdjustments();
    updateAdjustments(defaultAdj, 'Reset Adjustments');
  };

  // Jump to specific point in history
  const handleJumpToHistory = (index: number) => {
    if (index >= 0 && index < history.length) {
      setHistoryIndex(index);
      setAdjustments(cloneAdjustments(history[index].adjustments));
      if (currentProjectId) {
        saveProjectToDBDebounced(currentProjectId, history[index].adjustments, history, index);
      }
    }
  };

  // Select project from library
  const handleSelectProject = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;

    const img = new Image();
    img.onload = () => {
      setSourceImage(img);
      setCurrentFilename(proj.name);
      setCurrentProjectId(proj.id);
      clearPresetThumbnailCache();
      setPresetPreviewAdjustments(null);
      setAdjustments(cloneAdjustments(proj.adjustments));
      setHistory(proj.history.length > 0 ? proj.history : [
        {
          id: `hist-${Date.now()}`,
          action: `Open ${proj.name}`,
          timestamp: Date.now(),
          adjustments: proj.adjustments,
        },
      ]);
      setHistoryIndex(proj.historyIndex || 0);
      setSnapshots(proj.snapshots || []);

      // Update workspace dimensions
      setSelectionState((prev) => ({
        ...prev,
        maskBitmap: null,
        maskWidth: img.width,
        maskHeight: img.height,
        hasSelection: false,
        isDetectingPeople: false,
        personInfo: null,
        polygonPoints: [],
        lassoPoints: [],
      }));
      setRetouchState((prev) => ({
        ...prev,
        maskBitmap: null,
        maskWidth: img.width,
        maskHeight: img.height,
        hasMask: false,
        toolMode: 'person',
        error: null,
        successMessage: null,
      }));
    };
    img.src = proj.imageDataUrl;
  };

  // Delete project from library
  const handleDeleteProject = async (projectId: string) => {
    await deleteProjectById(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (currentProjectId === projectId) {
      loadSamplePhoto(SAMPLE_PHOTOS[0]);
    }
  };

  // Apply preset with slider strength
  const handleApplyPreset = (preset: Preset, strength = presetStrength) => {
    setPresetPreviewAdjustments(null);
    setActivePresetId(preset.id);
    const updated = applyPresetWithStrength(adjustments, preset, strength);
    updateAdjustments(updated, `Apply Preset: ${preset.name}`);
  };

  const handlePreviewPreset = (preset: Preset | null) => {
    if (!preset) {
      setPresetPreviewAdjustments(null);
    } else {
      setPresetPreviewAdjustments(applyPresetWithStrength(adjustments, preset, presetStrength));
    }
  };

  const handleResetPreset = () => {
    setPresetPreviewAdjustments(null);
    setActivePresetId(null);
    setPresetStrength(1.0);
    const defaultAdj = getDefaultAdjustments();
    updateAdjustments(defaultAdj, 'Reset Adjustments');
  };

  const handlePresetStrengthChange = (strength: number) => {
    setPresetStrength(strength);
    if (!activePresetId) return;
    const allPresets = [...BUILT_IN_PRESETS, ...customPresets];
    const match = allPresets.find((p) => p.id === activePresetId);
    if (match) {
      const updated = applyPresetWithStrength(adjustments, match, strength);
      updateAdjustments(updated, `Preset Strength (${Math.round(strength * 100)}%)`);
    }
  };

  // Save current adjustments as a custom preset
  const handleSaveCustomPreset = async (name: string, description: string, category: PresetCategory = 'Custom') => {
    const newPreset: Preset = {
      id: `custom-preset-${Date.now()}`,
      name,
      category,
      description: description || 'Custom user defined photographic style profile',
      adjustments: cloneAdjustments(adjustments),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isCustom: true,
      version: 1,
    };
    await saveCustomPreset(newPreset);
    setCustomPresets((prev) => [newPreset, ...prev]);
  };

  const handleUpdateCustomPreset = async (updated: Preset) => {
    await saveCustomPreset(updated);
    setCustomPresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleImportCustomPreset = async (presetOrPack: Preset | Preset[]) => {
    const list = Array.isArray(presetOrPack) ? presetOrPack : [presetOrPack];
    for (const p of list) {
      await saveCustomPreset(p);
    }
    setCustomPresets((prev) => [...list, ...prev]);
  };

  const handleDeleteCustomPreset = async (presetId: string) => {
    await deleteCustomPreset(presetId);
    setCustomPresets((prev) => prev.filter((p) => p.id !== presetId));
  };

  // Batch paste current adjustments across selected library projects
  const handleBatchPasteAdjustments = async (targetProjectIds: string[]) => {
    for (const id of targetProjectIds) {
      const proj = projects.find((p) => p.id === id);
      if (proj) {
        const nextHist = [
          ...proj.history,
          {
            id: `hist-${Date.now()}`,
            action: 'Batch Applied Adjustments',
            timestamp: Date.now(),
            adjustments: cloneAdjustments(adjustments),
          },
        ];
        const updated: PhotoProject = {
          ...proj,
          adjustments: cloneAdjustments(adjustments),
          history: nextHist,
          historyIndex: nextHist.length - 1,
          updatedAt: Date.now(),
        };
        await saveProject(updated);
      }
    }
    const fresh = await getAllProjects();
    setProjects(fresh);
  };

  // Batch apply preset across target projects
  const handleBatchApplyPresetToProjects = async (targetProjectIds: string[], preset: Preset) => {
    for (const id of targetProjectIds) {
      const proj = projects.find((p) => p.id === id);
      if (proj) {
        const mergedAdj = applyPresetWithStrength(proj.adjustments, preset, 1.0);
        const nextHist = [
          ...proj.history,
          {
            id: `hist-${Date.now()}`,
            action: `Batch Preset: ${preset.name}`,
            timestamp: Date.now(),
            adjustments: mergedAdj,
          },
        ];
        const updated: PhotoProject = {
          ...proj,
          adjustments: mergedAdj,
          history: nextHist,
          historyIndex: nextHist.length - 1,
          updatedAt: Date.now(),
        };
        await saveProject(updated);
      }
    }
    const fresh = await getAllProjects();
    setProjects(fresh);
  };

  // Canvas rendered callback: update live canvas ref and recompute live histogram
  const handleCanvasRendered = useCallback((canvas: HTMLCanvasElement) => {
    liveCanvasRef.current = canvas;
    const hist = computeHistogram(canvas);
    setHistogramData(hist);
  }, []);

  // Run AI Photographic Diagnosis
  const handleRunAIEnhance = async () => {
    if (!liveCanvasRef.current) return;
    setIsAIAnalyzing(true);
    try {
      const result = await analyzePhoto(liveCanvasRef.current);
      setAiAnalysis(result);
      if (result.suggestedAdjustments) {
        const enhanced = {
          ...adjustments,
          ...result.suggestedAdjustments,
        };
        updateAdjustments(enhanced, 'AI Auto Enhance');
      }
    } catch (err) {
      console.error('AI analysis error:', err);
    } finally {
      setIsAIAnalyzing(false);
    }
  };

  // Run AI Subject / Background Mask Generation
  const handleGenerateAISubjectMask = async (type: 'ai-subject' | 'ai-background') => {
    if (!liveCanvasRef.current) return;
    setIsSegmenting(true);
    try {
      const result = await segmentSubject(liveCanvasRef.current);
      const newMaskId = `mask-ai-${Date.now()}`;
      const newMask: LocalMask = {
        id: newMaskId,
        name: type === 'ai-subject' ? 'Subject Isolation Mask' : 'Background Mask',
        type,
        enabled: true,
        inverted: type === 'ai-background',
        opacity: 1.0,
        maskBitmap: result.bitmap,
        maskWidth: result.width,
        maskHeight: result.height,
        showOverlay: true,
        refineMode: 'none',
        adjustments: {
          exposure: type === 'ai-subject' ? 0.35 : -0.25,
          contrast: type === 'ai-subject' ? 12 : -5,
          saturation: type === 'ai-subject' ? 8 : -10,
          temperature: 0,
          sharpness: type === 'ai-subject' ? 20 : 0,
        },
      };

      const updated = {
        ...adjustments,
        masks: [...adjustments.masks, newMask],
      };
      updateAdjustments(updated, `Generate ${type === 'ai-subject' ? 'Subject' : 'Background'} Mask`);
      setActiveMaskId(newMaskId);
    } catch (err) {
      console.error('Segmentation error:', err);
    } finally {
      setIsSegmenting(false);
    }
  };

  // ================= WORKSPACE 1: SELECTION HANDLERS =================
  const handleInvertSelection = () => {
    if (!selectionState.maskBitmap) return;
    const inverted = invertSelectionMask(selectionState.maskBitmap);
    setSelectionState((prev) => ({ ...prev, maskBitmap: inverted }));
  };

  const handleExpandSelection = () => {
    if (!selectionState.maskBitmap) return;
    const expanded = expandSelectionMask(
      selectionState.maskBitmap,
      selectionState.maskWidth,
      selectionState.maskHeight,
      4
    );
    setSelectionState((prev) => ({ ...prev, maskBitmap: expanded }));
  };

  const handleContractSelection = () => {
    if (!selectionState.maskBitmap) return;
    const contracted = contractSelectionMask(
      selectionState.maskBitmap,
      selectionState.maskWidth,
      selectionState.maskHeight,
      4
    );
    setSelectionState((prev) => ({ ...prev, maskBitmap: contracted }));
  };

  const handleFeatherSelection = () => {
    if (!selectionState.maskBitmap) return;
    const feathered = featherSelectionMask(
      selectionState.maskBitmap,
      selectionState.maskWidth,
      selectionState.maskHeight,
      4
    );
    setSelectionState((prev) => ({ ...prev, maskBitmap: feathered }));
  };

  const handleClearSelection = () => {
    setSelectionState((prev) => ({
      ...prev,
      maskBitmap: null,
      hasSelection: false,
      isDetectingPeople: false,
      personInfo: null,
      polygonPoints: [],
      lassoPoints: [],
    }));
  };

  const handleRunSelectPeople = async () => {
    const target = sourceImage || liveCanvasRef.current;
    if (!target) return;

    setSelectionState((prev) => ({
      ...prev,
      mode: 'select-people',
      isDetectingPeople: true,
    }));

    try {
      const result = await detectAndSegmentPeople(target);
      setSelectionState((prev) => ({
        ...prev,
        mode: 'select-people',
        isDetectingPeople: false,
        maskBitmap: result.mask,
        maskWidth: result.width,
        maskHeight: result.height,
        hasSelection: result.detected,
        personInfo: {
          detected: result.detected,
          count: result.peopleCount,
          model: result.model,
          statusMessage: result.message,
        },
      }));

      // Pre-fill retouch state in case user wants to jump directly to remove
      if (result.detected) {
        setRetouchState((prev) => ({
          ...prev,
          toolMode: 'person',
          maskBitmap: [...result.mask],
          maskWidth: result.width,
          maskHeight: result.height,
          hasMask: true,
          error: null,
          successMessage: null,
        }));
      }
    } catch (err: any) {
      console.error('Failed to run person segmentation:', err);
      setSelectionState((prev) => ({
        ...prev,
        isDetectingPeople: false,
        personInfo: {
          detected: false,
          count: 0,
          model: 'none',
          statusMessage: 'Person detection failed. Please try manual brush selection.',
        },
      }));
    }
  };

  const handleGoToRemove = () => {
    if (selectionState.maskBitmap && selectionState.hasSelection) {
      setRetouchState((prev) => ({
        ...prev,
        toolMode: 'person',
        maskBitmap: [...selectionState.maskBitmap!],
        maskWidth: selectionState.maskWidth,
        maskHeight: selectionState.maskHeight,
        hasMask: true,
        error: null,
        successMessage: null,
      }));
    }
    setWorkspaceMode('remove');
  };

  const handleConvertToMask = () => {
    if (!selectionState.maskBitmap) return;
    const newMaskId = `mask-sel-${Date.now()}`;
    const newMask: LocalMask = {
      id: newMaskId,
      name: selectionState.personInfo?.detected
        ? `People Mask (${selectionState.personInfo.count === 1 ? '1 Person' : `${selectionState.personInfo.count} People`})`
        : `Selection (${selectionState.mode})`,
      type: 'brush',
      enabled: true,
      inverted: false,
      opacity: 1,
      maskBitmap: selectionState.maskBitmap,
      maskWidth: selectionState.maskWidth,
      maskHeight: selectionState.maskHeight,
      showOverlay: true,
      refineMode: 'none',
      adjustments: { ...selectionState.localAdjustments },
    };

    const updated = {
      ...adjustments,
      masks: [...adjustments.masks, newMask],
    };
    updateAdjustments(updated, 'Convert Selection to Develop Mask');
    setActiveMaskId(newMaskId);
    setWorkspaceMode('develop');
  };

  const handleApplySelectionToning = () => {
    const target = sourceImage || liveCanvasRef.current;
    if (!target || !selectionState.maskBitmap) return;

    const fullW = (target as HTMLImageElement).naturalWidth || target.width;
    const fullH = (target as HTMLImageElement).naturalHeight || target.height;

    const offscreen = document.createElement('canvas');
    offscreen.width = fullW;
    offscreen.height = fullH;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(target, 0, 0, fullW, fullH);

    applyAdjustmentsToSelection(
      ctx,
      selectionState.maskWidth,
      selectionState.maskHeight,
      selectionState.maskBitmap,
      selectionState.localAdjustments
    );

    const updatedUrl = offscreen.toDataURL('image/jpeg', 0.98);
    const newImg = new Image();
    newImg.onload = () => {
      setSourceImage(newImg);
      updateAdjustments(adjustments, 'Apply Selection Toning');
      handleClearSelection();
    };
    newImg.src = updatedUrl;
  };

  // ================= WORKSPACE 2: RETOUCH HANDLERS =================
  const handleExecuteRemoval = async () => {
    const targetSource = sourceImage || liveCanvasRef.current;
    if (!targetSource || !retouchState.maskBitmap) return;

    setRetouchState((prev) => ({
      ...prev,
      isProcessing: true,
      error: null,
      successMessage: null,
    }));

    try {
      const result = await removeObjectOrWatermark(
        targetSource,
        retouchState.maskBitmap,
        retouchState.maskWidth,
        retouchState.maskHeight,
        retouchState.algorithm
      );

      if (result.success && result.image) {
        const newImg = new Image();
        newImg.onload = () => {
          setSourceImage(newImg);
          const toolLabel = retouchState.toolMode === 'person' ? 'Person' : 'Object';
          const methodLabel = result.method === 'gemini' ? 'Gemini 3.1 Flash Lite' : 'Manual Local Patch';
          updateAdjustments(adjustments, `Remove ${toolLabel} (${methodLabel})`);

          setRetouchState((prev) => ({
            ...prev,
            maskBitmap: null,
            hasMask: false,
            isProcessing: false,
            error: null,
            successMessage: result.message || `${toolLabel} removed successfully.`,
          }));

          // Also clear any linked selection
          setSelectionState((prev) => ({
            ...prev,
            maskBitmap: null,
            hasSelection: false,
            personInfo: null,
          }));
        };
        newImg.src = result.image;
      } else {
        // Truthful reporting: do NOT pretend removal succeeded. Preserve mask so user can adjust or retry.
        setRetouchState((prev) => ({
          ...prev,
          isProcessing: false,
          error: result.message || 'Removal could not be completed. Your selection mask has been preserved.',
          successMessage: null,
        }));
      }
    } catch (err: any) {
      setRetouchState((prev) => ({
        ...prev,
        isProcessing: false,
        error: err.message || 'Removal failed. Try using Local Patch.',
        successMessage: null,
      }));
    }
  };

  const handleClearRetouchMask = () => {
    setRetouchState((prev) => ({
      ...prev,
      maskBitmap: null,
      hasMask: false,
      error: null,
    }));
  };

  // ================= WORKSPACE 3: BACKGROUND REMOVAL HANDLERS =================
  const handleRunBackgroundSegmentation = async () => {
    if (!sourceImage && !liveCanvasRef.current) return;
    setBackgroundState((prev) => ({ ...prev, isProcessing: true, error: null }));

    try {
      const canvas = liveCanvasRef.current || sourceImage!;
      const result = await extractSubjectMask(canvas as any);

      setBackgroundState((prev) => ({
        ...prev,
        enabled: true,
        isProcessing: false,
        modelType: result.modelType,
        maskBitmap: result.mask,
        maskWidth: result.width,
        maskHeight: result.height,
      }));
    } catch (err: any) {
      setBackgroundState((prev) => ({
        ...prev,
        isProcessing: false,
        error: err.message || 'Background segmentation failed.',
      }));
    }
  };

  const handleExportTransparentPNG = () => {
    const target = sourceImage || liveCanvasRef.current;
    if (!target || !backgroundState.maskBitmap) return;
    const baseName = currentFilename.replace(/\.[^/.]+$/, '');
    exportTransparentPNG(
      target,
      backgroundState.maskBitmap,
      backgroundState.maskWidth,
      backgroundState.maskHeight,
      `${baseName}-isolated.png`
    );
  };

  const handleApplyBackgroundToProject = () => {
    if (!backgroundState.maskBitmap) return;
    const updated: Adjustments = {
      ...adjustments,
      backgroundRemoval: { ...backgroundState },
    };
    updateAdjustments(updated, 'Apply Background Removal');
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
  }, [handleUndo, handleRedo, activeMaskId]);

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
        workspaceMode={workspaceMode}
        onWorkspaceChange={setWorkspaceMode}
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
          onPreviewPreset={handlePreviewPreset}
          onResetPreset={handleResetPreset}
          onSaveCustomPreset={handleSaveCustomPreset}
          onUpdateCustomPreset={handleUpdateCustomPreset}
          onImportCustomPreset={handleImportCustomPreset}
          onDeleteCustomPreset={handleDeleteCustomPreset}
          history={history}
          historyIndex={historyIndex}
          onJumpToHistory={handleJumpToHistory}
          sourceImage={sourceImage}
          currentAdjustments={displayAdjustments}
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

        {/* CENTER VIEWPORT: Canvas with Zoom, Pan, Split, Side-by-Side, Crop Overlay, and Workspace Overlays */}
        <CanvasViewport
          sourceImage={sourceImage}
          adjustments={displayAdjustments}
          onChangeAdjustments={updateAdjustments}
          comparisonMode={comparisonMode}
          isHoldingCompare={isHoldingCompare}
          onCanvasRendered={handleCanvasRendered}
          activeMaskId={activeMaskId}
          zoom={zoom}
          onSetZoom={setZoom}
          zoomMode={zoomMode}
          onSetZoomMode={setZoomMode}
          workspaceMode={workspaceMode}
          selectionState={selectionState}
          onUpdateSelectionState={(updates) => setSelectionState((prev) => ({ ...prev, ...updates }))}
          retouchState={retouchState}
          onUpdateRetouchState={(updates) => setRetouchState((prev) => ({ ...prev, ...updates }))}
          backgroundState={backgroundState}
          onAcceptSelection={handleConvertToMask}
          onClearSelection={handleClearSelection}
          onGoToRemove={handleGoToRemove}
        />

        {/* RIGHT SIDEBAR: Switch based on Workspace Mode */}
        {workspaceMode === 'develop' && (
          <RightSidebar
            adjustments={displayAdjustments}
            onChangeAdjustments={updateAdjustments}
            histogramData={histogramData}
            onRunAIEnhance={handleRunAIEnhance}
            isAIAnalyzing={isAIAnalyzing}
            aiAnalysis={aiAnalysis}
            activeMaskId={activeMaskId}
            setActiveMaskId={setActiveMaskId}
            onGenerateAISubjectMask={handleGenerateAISubjectMask}
            onSelectPeople={() => {
              setWorkspaceMode('select');
              handleRunSelectPeople();
            }}
            isSegmenting={isSegmenting}
            isOpen={rightSidebarOpen}
            onToggleOpen={() => setRightSidebarOpen(!rightSidebarOpen)}
            sourceImage={sourceImage}
          />
        )}

        {workspaceMode === 'select' && (
          <div className={`w-80 h-full shrink-0 transition-all ${rightSidebarOpen ? 'block' : 'hidden'}`}>
            <SelectPanel
              selectionState={selectionState}
              onUpdateSelectionState={(updates) => setSelectionState((prev) => ({ ...prev, ...updates }))}
              onRunSelectPeople={handleRunSelectPeople}
              onInvert={handleInvertSelection}
              onExpand={handleExpandSelection}
              onContract={handleContractSelection}
              onFeather={handleFeatherSelection}
              onClear={handleClearSelection}
              onConvertToMask={handleConvertToMask}
              onApplyAdjustments={handleApplySelectionToning}
              onGoToRemove={handleGoToRemove}
            />
          </div>
        )}

        {workspaceMode === 'remove' && (
          <div className={`w-80 h-full shrink-0 transition-all ${rightSidebarOpen ? 'block' : 'hidden'}`}>
            <RemovePanel
              retouchState={retouchState}
              onUpdateRetouchState={(updates) => setRetouchState((prev) => ({ ...prev, ...updates }))}
              onExecuteRemoval={handleExecuteRemoval}
              onClearMask={handleClearRetouchMask}
              onRunSelectPeople={handleRunSelectPeople}
              isDetectingPeople={selectionState.isDetectingPeople}
              serverAIConfigured={serverAIConfigured}
              isHoldingCompare={isHoldingCompare}
              setIsHoldingCompare={setIsHoldingCompare}
            />
          </div>
        )}

        {workspaceMode === 'background' && (
          <div className={`w-80 h-full shrink-0 transition-all ${rightSidebarOpen ? 'block' : 'hidden'}`}>
            <BackgroundPanel
              backgroundState={backgroundState}
              onUpdateBackgroundState={(updates) => setBackgroundState((prev) => ({ ...prev, ...updates }))}
              onRunSegmentation={handleRunBackgroundSegmentation}
              onExportTransparentPNG={handleExportTransparentPNG}
              onApplyToProject={handleApplyBackgroundToProject}
            />
          </div>
        )}
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
