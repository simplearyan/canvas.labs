import { TypographyEngine } from './TypographyEngine';
import type { TypographyState } from './types';
import MediaWorker from '../../workers/mediabunny.worker.ts?worker';
import ZipWorker from '../../workers/zip.worker.ts?worker';
import type { ExportConfig } from '@/components/common/ExportModal';

export const typographyExportProject = async (
  config: ExportConfig,
  state: TypographyState,
  onProgress: (progress: number, status: string) => void,
  controller?: { isPaused: () => boolean; isCancelled: () => boolean }
): Promise<ArrayBuffer | Blob> => {
  const res = parseInt(config.resolution);
  let aspect = config.aspectRatio || '16:9';
  
  let targetW = 1920;
  let targetH = 1080;
  
  if (aspect === '16:9') {
    targetW = 1920;
    targetH = 1080;
  } else if (aspect === '9:16') {
    targetW = 1080;
    targetH = 1920;
  } else if (aspect === '1:1') {
    targetW = 1080;
    targetH = 1080;
  } else if (aspect === '4:5') {
    targetW = 1080;
    targetH = 1350;
  } else if (aspect === '3:4') {
    targetW = 1080;
    targetH = 1440;
  } else if (aspect === '4:3') {
    targetW = 1440;
    targetH = 1080;
  } else if (aspect === '2:1') {
    targetW = 2160;
    targetH = 1080;
  }
  
  const isLandscape = aspect === '16:9' || aspect === '4:3' || aspect === '2:1';
  const baseSize = isLandscape ? targetH : targetW;
  const multiplier = res / baseSize;
  
  targetW = Math.round(targetW * multiplier);
  targetH = Math.round(targetH * multiplier);

  const worker = config.format === 'zip' ? new ZipWorker() : new MediaWorker();

  onProgress(0, 'Initializing Web Worker...');

  worker.postMessage({
    type: 'CONFIG',
    data: {
      width: targetW,
      height: targetH,
      fps: config.fps,
      format: config.format,
      bitrate: targetH >= 2160 ? 40000000 : targetH >= 1440 ? 20000000 : targetH >= 1080 ? 10000000 : 5000000,
    },
  });

  await new Promise((resolve, reject) => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'READY') {
        worker.removeEventListener('message', handler);
        resolve(true);
      } else if (e.data.type === 'ERROR') {
        worker.removeEventListener('message', handler);
        reject(new Error(e.data.error));
      }
    };
    worker.addEventListener('message', handler);
  });

  const duration = state.duration || 5; // Total animation duration in seconds
  const totalFrames = Math.ceil(duration * config.fps);

  // Set up headless canvas for rendering
  const offscreenCanvas = new OffscreenCanvas(targetW, targetH);
  const typographyEngine = new TypographyEngine(offscreenCanvas);
  typographyEngine.setDimensions(targetW, targetH, 1);
  typographyEngine.updateState(state);

  for (let f = 0; f < totalFrames; f++) {
    if (controller?.isCancelled()) {
      worker.terminate();
      throw new Error('Export Cancelled');
    }
    while (controller?.isPaused()) {
      onProgress(Math.round((f / totalFrames) * 100), `Paused at Frame ${f + 1}...`);
      await new Promise((r) => setTimeout(r, 200));
      if (controller?.isCancelled()) {
        worker.terminate();
        throw new Error('Export Cancelled');
      }
    }

    const t = f / config.fps; // timeInSeconds for Typography Engine

    onProgress(Math.round((f / totalFrames) * 100), `Rendering Frame ${f + 1} of ${totalFrames}`);

    // Render frame onto offscreen canvas
    typographyEngine.renderFrame(t);

    // CRITICAL: Small yield for browser GPU flushing
    await new Promise((r) => setTimeout(r, 10));

    if (config.format === 'zip') {
      const blob = await offscreenCanvas.convertToBlob({ type: 'image/png' });
      worker.postMessage({
        type: 'ENCODE_FRAME',
        data: {
          blob,
          frameNumber: f
        }
      });
      // Small throttle for ZIP worker to avoid memory overload with huge blobs
      await new Promise(r => setTimeout(r, 2));
    } else {
      const bitmap = await createImageBitmap(offscreenCanvas);
      let frameDoneHandler: any;
      const p = new Promise((r) => {
        frameDoneHandler = (e: MessageEvent) => {
          if (e.data.type === 'FRAME_DONE') r(true);
        };
        worker.addEventListener('message', frameDoneHandler);
      });

      worker.postMessage(
        {
          type: 'ENCODE_FRAME',
          data: {
            bitmap,
            timestamp: Math.round(t * 1000000),
            duration: Math.round((1 / config.fps) * 1000000),
          },
        },
        [bitmap]
      );

      await p;
      worker.removeEventListener('message', frameDoneHandler);
    }
  }

  onProgress(100, 'Finalizing Encoding...');

  const finalPromise = new Promise<any>((resolve, reject) => {
    worker.onmessage = (e) => {
      if (e.data.type === 'COMPLETE') resolve(e.data.data);
      else if (e.data.type === 'ERROR') reject(new Error(e.data.error));
    };
  });

  worker.postMessage({ type: 'FINALIZE' });
  const result = await finalPromise;

  worker.terminate();
  return result; // ArrayBuffer for video or zip
};
