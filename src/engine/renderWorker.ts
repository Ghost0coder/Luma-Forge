import { Adjustments, HistogramData } from '../types/editor';
import { processPixelData } from './pipeline';
import { computeHistogramFromImageData } from './histogram';

export interface RenderWorkerJobMessage {
  jobId: number;
  imageData: ImageData;
  adjustments: Adjustments;
  renderW: number;
  renderH: number;
}

export interface RenderWorkerResponseMessage {
  jobId: number;
  imageData: ImageData;
  histogramData: HistogramData;
  renderTimeMs: number;
}

self.onmessage = (e: MessageEvent<RenderWorkerJobMessage>) => {
  const { jobId, imageData, adjustments, renderW, renderH } = e.data;
  const startTime = performance.now();

  // Process image pixels non-destructively in-place in worker thread
  processPixelData(imageData.data, renderW, renderH, adjustments);

  // Compute live 256-bin histogram in worker thread
  const histogramData = computeHistogramFromImageData(imageData.data, renderW, renderH);

  const renderTimeMs = performance.now() - startTime;

  const response: RenderWorkerResponseMessage = {
    jobId,
    imageData,
    histogramData,
    renderTimeMs,
  };

  // Transfer pixel buffer back to main thread with 0ms copy overhead
  (self as any).postMessage(response, [imageData.data.buffer]);
};
