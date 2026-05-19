/// <reference lib="webworker" />
import {
    Output,
    BufferTarget,
    Mp4OutputFormat,
    WebMOutputFormat,
    MovOutputFormat,
    VideoSampleSource,
    VideoSample
} from 'mediabunny';

let output: Output | null = null;
let target: BufferTarget | null = null;
let videoSource: VideoSampleSource | null = null;

let pendingFrames = 0;
let lastProgressUpdate = 0;

const sendProgress = (force = false) => {
    const now = Date.now();
    if (force || now - lastProgressUpdate > 50) {
        self.postMessage({ type: 'PROGRESS', data: { queueSize: pendingFrames } });
        lastProgressUpdate = now;
    }
};

const taskQueue: any[] = [];
let isProcessing = false;

const processQueue = async () => {
    if (isProcessing || taskQueue.length === 0) return;
    isProcessing = true;
    try {
        while (taskQueue.length > 0) {
            const data = taskQueue.shift();
            
            if (data.type === 'video') {
                const { bitmap, timestamp, duration } = data;
                try {
                    if (!videoSource) throw new Error("Video Source not initialized");
                    const frame = new VideoFrame(bitmap, { timestamp: Math.round(timestamp), duration: duration ? Math.round(duration) : undefined });
                    const sample = new VideoSample(frame);
                    try { await videoSource.add(sample); } 
                    finally { sample.close(); frame.close(); bitmap.close(); }
                    self.postMessage({ type: 'FRAME_DONE' });
                } catch (err: any) {
                    self.postMessage({ type: 'ERROR', error: err.message });
                }
                pendingFrames--;
                sendProgress(true);
            }
        }
    } finally {
        isProcessing = false;
    }
};

self.onmessage = async (e: MessageEvent) => {
    const { type, data } = e.data;
    try {
        if (type === 'CONFIG') {
            const config = data;
            target = new BufferTarget();

            let format;
            if (config.format === 'webm') format = new WebMOutputFormat();
            else if (config.format === 'mov') format = new MovOutputFormat();
            else format = new Mp4OutputFormat();

            output = new Output({ target, format });

            const codec = config.format === 'webm' ? 'vp9' : 'avc';

            videoSource = new VideoSampleSource({
                width: config.width,
                height: config.height,
                frameRate: config.fps,
                codec: codec,
                bitrate: config.bitrate || 10000000
            } as any);
            
            await output.addVideoTrack(videoSource);
            await output.start();
            
            self.postMessage({ type: 'READY' });
        }
        else if (type === 'ENCODE_FRAME') {
            pendingFrames++;
            sendProgress();
            taskQueue.push({ type: 'video', ...data });
            processQueue();
        }
        else if (type === 'FINALIZE') {
            const drainQueue = async () => {
                while (taskQueue.length > 0 || isProcessing) await new Promise(r => setTimeout(r, 50));
            };
            await drainQueue();

            try {
                if (videoSource) await videoSource.close();
                if (output) await output.finalize();

                let attempts = 0;
                while (!target?.buffer && attempts < 100) {
                    await new Promise(r => setTimeout(r, 100));
                    attempts++;
                }

                if (target && target.buffer) {
                    (self as any).postMessage({ type: 'COMPLETE', data: target.buffer }, [target.buffer]);
                } else {
                    throw new Error("Export failed: Buffer empty after finalize.");
                }
            } catch (err: any) {
                self.postMessage({ type: 'ERROR', error: `Finalize Error: ${err.message}` });
            }
        }
    } catch (err: any) {
        self.postMessage({ type: 'ERROR', error: err.message });
    }
};
