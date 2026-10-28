import { Adjustments, HistogramData } from '../types/editor';
import { renderImageAdjustments, processPixelData } from './pipeline';
import { computeHistogramFromImageData } from './histogram';
import { RenderWorkerJobMessage, RenderWorkerResponseMessage } from './renderWorker';

type RenderCallback = (
  targetCanvas: HTMLCanvasElement,
  histogramData: HistogramData,
  jobId: number
) => void;

class WorkerManager {
  private worker: Worker | null = null;
  private isWorkerSupported = true;
  private isBusy = false;
  private latestJobId = 0;
  private pendingJob: {
    jobId: number;
    sourceImage: HTMLImageElement | HTMLCanvasElement;
    targetCanvas: HTMLCanvasElement;
    adjustments: Adjustments;
    options: { maxDimension?: number };
    callback: RenderCallback;
  } | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      if (typeof Worker !== 'undefined') {
        this.worker = new Worker(new URL('./renderWorker.ts', import.meta.url), {
          type: 'module',
        });

        this.worker.onmessage = (e: MessageEvent<RenderWorkerResponseMessage>) => {
          this.handleWorkerResponse(e.data);
        };

        this.worker.onerror = (err) => {
          console.warn('Render Web Worker error, falling back to main-thread rendering:', err);
          this.isWorkerSupported = false;
          this.terminateWorker();
        };
      } else {
        this.isWorkerSupported = false;
      }
    } catch (err) {
      console.warn('Failed to initialize Web Worker, using main-thread fallback:', err);
      this.isWorkerSupported = false;
      this.worker = null;
    }
  }

  private terminateWorker() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  private activeTargetCanvas: HTMLCanvasElement | null = null;
  private activeCallback: RenderCallback | null = null;

  public requestRender(
    sourceImage: HTMLImageElement | HTMLCanvasElement,
    targetCanvas: HTMLCanvasElement,
    adjustments: Adjustments,
    options: { maxDimension?: number } = {},
    callback: RenderCallback
  ): number {
    this.latestJobId++;
    const jobId = this.latestJobId;

    if (!this.isWorkerSupported || !this.worker) {
      // Main-thread synchronous fallback
      renderImageAdjustments(sourceImage, targetCanvas, adjustments, options);
      const ctx = targetCanvas.getContext('2d', { willReadFrequently: true });
      let histData: HistogramData = {
        red: new Array(256).fill(0),
        green: new Array(256).fill(0),
        blue: new Array(256).fill(0),
        luminance: new Array(256).fill(0),
        maxCount: 1,
        highlightClipping: 0,
        shadowClipping: 0,
      };
      if (ctx) {
        try {
          const imgData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
          histData = computeHistogramFromImageData(
            imgData.data,
            targetCanvas.width,
            targetCanvas.height
          );
        } catch {
          // ignore readback error
        }
      }
      callback(targetCanvas, histData, jobId);
      return jobId;
    }

    if (this.isBusy) {
      // Coalesce rapid slider movements: replace pending job with latest requested state
      this.pendingJob = {
        jobId,
        sourceImage,
        targetCanvas,
        adjustments,
        options,
        callback,
      };
      return jobId;
    }

    this.dispatchWorkerJob(jobId, sourceImage, targetCanvas, adjustments, options, callback);
    return jobId;
  }

  private dispatchWorkerJob(
    jobId: number,
    sourceImage: HTMLImageElement | HTMLCanvasElement,
    targetCanvas: HTMLCanvasElement,
    adjustments: Adjustments,
    options: { maxDimension?: number },
    callback: RenderCallback
  ) {
    if (!this.worker) return;

    this.isBusy = true;
    this.activeTargetCanvas = targetCanvas;
    this.activeCallback = callback;

    try {
      // 1. Prepare geometry sampling on an offscreen buffer (fast < 0.5ms operation)
      const origW =
        sourceImage instanceof HTMLImageElement ? sourceImage.naturalWidth : sourceImage.width;
      const origH =
        sourceImage instanceof HTMLImageElement ? sourceImage.naturalHeight : sourceImage.height;

      if (!origW || !origH) {
        this.isBusy = false;
        return;
      }

      const crop = adjustments.crop;
      const isRotated90 = crop.stepRotation === 90 || crop.stepRotation === 270;
      const uncroppedW = isRotated90 ? origH : origW;
      const uncroppedH = isRotated90 ? origW : origH;

      const cropX = crop.active ? Math.max(0, Math.min(1, crop.x)) : 0;
      const cropY = crop.active ? Math.max(0, Math.min(1, crop.y)) : 0;
      const cropW = crop.active ? Math.max(0.05, Math.min(1 - cropX, crop.width)) : 1;
      const cropH = crop.active ? Math.max(0.05, Math.min(1 - cropY, crop.height)) : 1;

      let renderW = Math.round(uncroppedW * cropW);
      let renderH = Math.round(uncroppedH * cropH);

      if (options.maxDimension && (renderW > options.maxDimension || renderH > options.maxDimension)) {
        const scale = options.maxDimension / Math.max(renderW, renderH);
        renderW = Math.max(16, Math.round(renderW * scale));
        renderH = Math.max(16, Math.round(renderH * scale));
      }

      const offCanvas = document.createElement('canvas');
      offCanvas.width = renderW;
      offCanvas.height = renderH;
      const gctx = offCanvas.getContext('2d', { willReadFrequently: true });
      if (!gctx) {
        this.isBusy = false;
        return;
      }

      gctx.save();
      gctx.clearRect(0, 0, renderW, renderH);
      gctx.translate(renderW / 2, renderH / 2);
      if (crop.rotation !== 0) gctx.rotate((crop.rotation * Math.PI) / 180);
      gctx.scale(crop.flipH ? -1 : 1, crop.flipV ? -1 : 1);
      if (crop.stepRotation !== 0) gctx.rotate((crop.stepRotation * Math.PI) / 180);

      const sx = cropX * origW;
      const sy = cropY * origH;
      const sw = cropW * origW;
      const sh = cropH * origH;
      const drawW = isRotated90 ? renderH : renderW;
      const drawH = isRotated90 ? renderW : renderH;

      gctx.drawImage(sourceImage, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
      gctx.restore();

      const imgData = gctx.getImageData(0, 0, renderW, renderH);

      const message: RenderWorkerJobMessage = {
        jobId,
        imageData: imgData,
        adjustments,
        renderW,
        renderH,
      };

      // Send to Web Worker with zero-copy buffer transfer
      this.worker.postMessage(message, [imgData.data.buffer]);
    } catch (err) {
      console.warn('Failed to dispatch render job to Web Worker:', err);
      this.isBusy = false;
      // Fallback
      renderImageAdjustments(sourceImage, targetCanvas, adjustments, options);
      const ctx = targetCanvas.getContext('2d');
      if (ctx) {
        const imgData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
        const hist = computeHistogramFromImageData(imgData.data, targetCanvas.width, targetCanvas.height);
        callback(targetCanvas, hist, jobId);
      }
    }
  }

  private handleWorkerResponse(response: RenderWorkerResponseMessage) {
    const { jobId, imageData, histogramData } = response;
    this.isBusy = false;

    // Discard stale renders if a newer render job has already been requested
    if (jobId >= this.latestJobId && this.activeTargetCanvas) {
      const target = this.activeTargetCanvas;
      if (target.width !== imageData.width || target.height !== imageData.height) {
        target.width = imageData.width;
        target.height = imageData.height;
      }
      const ctx = target.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.putImageData(imageData, 0, 0);
      }
      if (this.activeCallback) {
        this.activeCallback(target, histogramData, jobId);
      }
    }

    // Process next pending job if user moved sliders while worker was busy
    if (this.pendingJob) {
      const next = this.pendingJob;
      this.pendingJob = null;
      this.dispatchWorkerJob(
        next.jobId,
        next.sourceImage,
        next.targetCanvas,
        next.adjustments,
        next.options,
        next.callback
      );
    }
  }

  public dispose() {
    this.terminateWorker();
    this.pendingJob = null;
    this.activeTargetCanvas = null;
    this.activeCallback = null;
  }
}

export const workerManager = new WorkerManager();
