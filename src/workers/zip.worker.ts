/// <reference lib="webworker" />
import JSZip from 'jszip';

let zip: JSZip | null = null;
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
            
            try {
                if (!zip) throw new Error("JSZip not initialized");
                
                // data.blob is the PNG Blob, data.frameNumber is the index
                const arrayBuffer = await data.blob.arrayBuffer();
                const paddedNumber = data.frameNumber.toString().padStart(5, '0');
                zip.file(`frame_${paddedNumber}.png`, arrayBuffer);
                
                self.postMessage({ type: 'FRAME_DONE' });
            } catch (err: any) {
                self.postMessage({ type: 'ERROR', error: err.message });
            }
            pendingFrames--;
            sendProgress(true);
        }
    } finally {
        isProcessing = false;
    }
};

self.onmessage = async (e: MessageEvent) => {
    const { type, data } = e.data;
    try {
        if (type === 'CONFIG') {
            zip = new JSZip();
            self.postMessage({ type: 'READY' });
        }
        else if (type === 'ENCODE_FRAME') {
            pendingFrames++;
            sendProgress();
            taskQueue.push(data);
            processQueue();
        }
        else if (type === 'FINALIZE') {
            const drainQueue = async () => {
                while (taskQueue.length > 0 || isProcessing) await new Promise(r => setTimeout(r, 50));
            };
            await drainQueue();

            try {
                if (!zip) throw new Error("Zip is empty");
                
                // Generate the zip blob
                const content = await zip.generateAsync({ type: "blob" });
                const arrayBuffer = await content.arrayBuffer();
                
                (self as any).postMessage({ type: 'COMPLETE', data: arrayBuffer }, [arrayBuffer]);
            } catch (err: any) {
                self.postMessage({ type: 'ERROR', error: `Finalize Error: ${err.message}` });
            }
        }
    } catch (err: any) {
        self.postMessage({ type: 'ERROR', error: err.message });
    }
};
