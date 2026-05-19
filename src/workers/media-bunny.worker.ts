// Media Bunny WebWorker
// Handles heavy encoding (GIF/WebM/MP4) off the main thread.

self.onmessage = async (e) => {
  const { action, payload } = e.data;
  
  if (action === 'START_EXPORT') {
    // Simulated encoding loop
    const { format, resolution } = payload;
    
    // Simulating a progress tick every 100ms
    for (let i = 0; i <= 100; i += 5) {
      await new Promise(r => setTimeout(r, 100));
      self.postMessage({ type: 'PROGRESS', percent: i });
    }
    
    // Simulating final output
    self.postMessage({ 
      type: 'COMPLETE', 
      url: 'blob:simulated-url', 
      message: `Exported ${format} at ${resolution}p successfully.`
    });
  }
};
