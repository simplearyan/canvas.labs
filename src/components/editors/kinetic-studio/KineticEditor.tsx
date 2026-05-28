import { createSignal, createEffect, onCleanup, onMount, For, Show } from 'solid-js';
import Icon from '../../ui/Icon';
import type { KineticState, KineticSlide, KineticElement, KineticElementType } from '@/engines/kinetic-studio/types';
import { serializeKineticState, deserializeKineticState, generateId } from '@/engines/kinetic-studio/KineticEngineUtils';
import { renderFrame, SLIDE_DURATION } from '@/engines/kinetic-studio/KineticEngine';
import ExportModal from '@/components/common/ExportModal';
import SnapshotModal from '@/components/common/SnapshotModal';

export default function KineticEditor() {
  const getInitialData = () => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('data');
  };

  const [state, setState] = createSignal<KineticState>(deserializeKineticState(getInitialData()));

  // Editor UI State
  const [activeSlideIndex, setActiveSlideIndex] = createSignal(0);
  const [activeElementId, setActiveElementId] = createSignal<string | null>(null);
  const [leftTab, setLeftTab] = createSignal<'slides' | 'add' | 'audio' | 'settings'>('slides');
  const [rightTab, setRightTab] = createSignal<'layers' | 'props'>('props');
  const [mobileTab, setMobileTab] = createSignal<'slides' | 'add' | 'audio' | 'settings' | 'layers' | 'props'>('slides');
  const [aspectRatio, setAspectRatio] = createSignal<'16:9' | '9:16' | '1:1' | '4:5' | '3:4' | '4:3' | '2:1'>('16:9');
  const [isExportingSnapshot, setIsExportingSnapshot] = createSignal(false);
  
  createEffect(() => {
    const mt = mobileTab();
    if (mt === 'slides' || mt === 'add' || mt === 'audio' || mt === 'settings') setLeftTab(mt);
    if (mt === 'layers' || mt === 'props') setRightTab(mt);
  });
  
  // Playback State
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [globalTime, setGlobalTime] = createSignal(0);
  const [isExporting, setIsExporting] = createSignal(false);

  // Audio State
  const [audioFileLabel, setAudioFileLabel] = createSignal('');
  const [audioTrimIn, setAudioTrimIn] = createSignal(0);
  const [audioTrimOut, setAudioTrimOut] = createSignal(0);
  const [audioVolume, setAudioVolume] = createSignal(1);
  const [isMuted, setIsMuted] = createSignal(false);
  const [audioDuration, setAudioDuration] = createSignal(0);

  let audioCtx: AudioContext | null = null;
  let currentAudioBuffer: AudioBuffer | null = null;
  let currentAudioSource: AudioBufferSourceNode | null = null;
  let globalGainNode: GainNode | null = null;
  let exportAudioDest: MediaStreamAudioDestinationNode | null = null;
  let waveformCanvasRef: HTMLCanvasElement | undefined;
  
  let canvasRef: HTMLCanvasElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  let animationFrameId: number;
  let lastTimestamp = 0;

  // Derive max duration
  const maxDuration = () => state().slides.length * SLIDE_DURATION;

  // Persist State to URL
  createEffect(() => {
    if (typeof window === 'undefined') return;
    const encoded = serializeKineticState(state());
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('data', encoded);
    window.history.replaceState({}, '', newUrl.toString());
  });

  const updateSlide = (idx: number, data: Partial<KineticSlide>) => {
    setState(s => {
      const slides = [...s.slides];
      slides[idx] = { ...slides[idx], ...data };
      return { slides };
    });
  };

  const updateElement = (id: string, data: Partial<KineticElement>) => {
    setState(s => {
      const slides = s.slides.map(slide => ({
        ...slide,
        elements: slide.elements.map(el => el.id === id ? { ...el, ...data } : el)
      }));
      return { slides };
    });
  };

  const addSlide = () => {
    const newSlide: KineticSlide = {
      id: generateId(),
      bg: '#18181b',
      transition: 'slideLeft',
      transDuration: 0.5,
      elements: []
    };
    setState(s => ({ slides: [...s.slides, newSlide] }));
    setActiveSlideIndex(state().slides.length - 1);
    setActiveElementId(null);
    setGlobalTime(activeSlideIndex() * SLIDE_DURATION);
  };

  const deleteSlide = (idx: number) => {
    if (state().slides.length <= 1) return;
    setState(s => {
      const slides = [...s.slides];
      slides.splice(idx, 1);
      return { slides };
    });
    setActiveSlideIndex(Math.min(activeSlideIndex(), state().slides.length - 1));
    setActiveElementId(null);
    setGlobalTime(activeSlideIndex() * SLIDE_DURATION);
  };

  const addElement = (type: KineticElementType) => {
    const aspect = aspectRatio();
    let nativeW = 1920; let nativeH = 1080;
    if (aspect === '9:16') { nativeW = 1080; nativeH = 1920; }
    else if (aspect === '1:1') { nativeW = 1080; nativeH = 1080; }
    else if (aspect === '4:5') { nativeW = 1080; nativeH = 1350; }
    else if (aspect === '3:4') { nativeW = 1080; nativeH = 1440; }
    else if (aspect === '4:3') { nativeW = 1440; nativeH = 1080; }
    else if (aspect === '2:1') { nativeW = 2160; nativeH = 1080; }

    const startX = nativeW / 2;
    const startY = nativeH / 2;
    
    const newEl: KineticElement = {
      id: generateId(), type,
      x: startX, y: startY, rotation: 0, size: type === 'text' ? 80 : 150,
      fill: type === 'text' ? '#ffffff' : '#3b82f6',
      stroke: '#000000', strokeWidth: 0,
      shadowColor: '#000000', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
      animIn: 'scale', animInEase: 'easeOut', inDur: 0.5,
      animLoop: 'none', loopSpeed: 1.0,
      animOut: 'fade', animOutEase: 'easeIn', outDur: 0.5,
      start: 0, end: SLIDE_DURATION
    };

    if (type === 'text') {
      newEl.text = "NEW TEXT";
      newEl.font = "'Inter'";
      newEl.fontWeight = '700';
      newEl.letterSpacing = 0;
    }

    setState(s => {
      const slides = [...s.slides];
      slides[activeSlideIndex()].elements.push(newEl);
      return { slides };
    });
    
    setActiveElementId(newEl.id);
    setRightTab('props');
    setMobileTab('props');
  };

  const deleteElement = (id: string) => {
    setState(s => {
      const slides = s.slides.map((slide, idx) => {
        if (idx !== activeSlideIndex()) return slide;
        return { ...slide, elements: slide.elements.filter(e => e.id !== id) };
      });
      return { slides };
    });
    if (activeElementId() === id) setActiveElementId(null);
  };

  // Rendering
  const requestRender = () => {
    if (!canvasRef || !containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    // High DPI scaling
    const dpr = window.devicePixelRatio || 1;
    canvasRef.width = rect.width * dpr;
    canvasRef.height = rect.height * dpr;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const aspect = aspectRatio();
    let nativeW = 1920; let nativeH = 1080;
    if (aspect === '9:16') { nativeW = 1080; nativeH = 1920; }
    else if (aspect === '1:1') { nativeW = 1080; nativeH = 1080; }
    else if (aspect === '4:5') { nativeW = 1080; nativeH = 1350; }
    else if (aspect === '3:4') { nativeW = 1080; nativeH = 1440; }
    else if (aspect === '4:3') { nativeW = 1440; nativeH = 1080; }
    else if (aspect === '2:1') { nativeW = 2160; nativeH = 1080; }

    const scale = Math.min(rect.width / nativeW, rect.height / nativeH);
    const offsetX = (rect.width - nativeW * scale) / 2;
    const offsetY = (rect.height - nativeH * scale) / 2;

    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    renderFrame(ctx, globalTime(), nativeW, nativeH, state().slides, false, true, isPlaying(), activeElementId());

    // Call drawWaveform periodically if playing
    if (isPlaying() && audioCtx) {
      drawWaveform();
    }
  };

  createEffect(() => {
    aspectRatio();
    requestRender();
  });

  const exportSnapshotFrame = async (resParam: "1080" | "1440" | "2160", transparentParam: boolean) => {
    try {
      const res = parseInt(resParam);
      const aspect = aspectRatio();
      
      let targetW = 1920; let targetH = 1080;
      if (aspect === '9:16') { targetW = 1080; targetH = 1920; }
      else if (aspect === '1:1') { targetW = 1080; targetH = 1080; }
      else if (aspect === '4:5') { targetW = 1080; targetH = 1350; }
      else if (aspect === '3:4') { targetW = 1080; targetH = 1440; }
      else if (aspect === '4:3') { targetW = 1440; targetH = 1080; }
      else if (aspect === '2:1') { targetW = 2160; targetH = 1080; }
      
      const isLandscape = aspect === '16:9' || aspect === '4:3' || aspect === '2:1';
      const baseSize = isLandscape ? targetH : targetW;
      const multiplier = res / baseSize;
      
      targetW = Math.round(targetW * multiplier);
      targetH = Math.round(targetH * multiplier);

      const offscreen = new OffscreenCanvas(targetW, targetH);
      const offCtx = offscreen.getContext('2d') as CanvasRenderingContext2D;
      
      if (!transparentParam) {
        offCtx.fillStyle = isDarkTheme() ? '#000000' : '#ffffff';
        offCtx.fillRect(0, 0, targetW, targetH);
      }

      renderFrame(offCtx, globalTime(), targetW, targetH, state().slides, false, false, false, null);

      const blob = await offscreen.convertToBlob({ type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kinetic_snapshot_${resParam}p.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Failed to export snapshot: " + err.message);
    }
  };

  function AspectRatioCard(props: { value: '16:9' | '9:16' | '1:1' | '4:5' | '3:4' | '4:3' | '2:1', label: string, shape: string, orientation: string }) {
    const isActive = () => aspectRatio() === props.value;
    return (
      <button
        onClick={() => setAspectRatio(props.value)}
        class={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer group shadow-sm ${
          isActive()
            ? 'bg-emerald-50/70 border-emerald-500 dark:bg-emerald-500/10 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/10'
            : 'bg-white hover:bg-emerald-50/30 dark:bg-zinc-800 dark:hover:bg-zinc-700/50 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300'
        }`}
        type="button"
      >
        <div class="flex items-center justify-between gap-2 mb-3">
          <span class="text-[11px] font-bold tracking-tight">{props.label}</span>
          <div class={`relative rounded ${isActive() ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-600'} ${props.shape} flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity duration-200`}></div>
        </div>
        <span class={`text-[8px] uppercase tracking-wider font-semibold ${isActive() ? 'text-emerald-600 dark:text-emerald-500' : 'text-gray-400 dark:text-zinc-500'}`}>{props.orientation}</span>
      </button>
    );
  }

  createEffect(() => {
    state(); globalTime(); activeElementId();
    requestRender();
  });

  onMount(() => {
    const observer = new ResizeObserver(() => requestRender());
    if (containerRef) observer.observe(containerRef);

    // Interaction handling (Drag)
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const handlePointerDown = (e: PointerEvent) => {
      if (isPlaying() || !canvasRef || !containerRef) return;
      const rect = containerRef.getBoundingClientRect();
      const scale = Math.min(rect.width / 800, rect.height / 500);
      const offX = (rect.width - 800 * scale) / 2;
      const offY = (rect.height - 500 * scale) / 2;
      
      const x = (e.clientX - rect.left - offX) / scale;
      const y = (e.clientY - rect.top - offY) / scale;

      const slide = state().slides[activeSlideIndex()];
      let clickedEl: KineticElement | null = null;
      
      const ctx = canvasRef.getContext('2d');
      if (!ctx) return;

      // Reverse order for painter's algorithm hit test
      for (let i = slide.elements.length - 1; i >= 0; i--) {
        const el = slide.elements[i];
        let hw = 50, hh = 50;

        if (el.type === 'text' && el.text) {
          ctx.font = `${el.fontWeight || '700'} ${el.size}px ${el.font}`;
          hw = ctx.measureText(el.text).width / 2;
          hh = el.size / 2;
        } else if (el.type === 'rect') {
          hw = el.size * 1.5 / 2; hh = el.size / 2;
        } else if (el.type === 'circle') {
          hw = el.size / 2; hh = el.size / 2;
        }

        const angle = -(el.rotation || 0) * Math.PI / 180;
        const dx = x - el.x;
        const dy = y - el.y;
        const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
        const ry = dx * Math.sin(angle) + dy * Math.cos(angle);

        if (Math.abs(rx) <= hw && Math.abs(ry) <= hh) {
          clickedEl = el;
          break;
        }
      }

      if (clickedEl) {
        setActiveElementId(clickedEl.id);
        isDragging = true;
        dragOffsetX = x - clickedEl.x;
        dragOffsetY = y - clickedEl.y;
        setRightTab('props');
        setMobileTab('props');
      } else {
        setActiveElementId(null);
        setRightTab('props');
        setMobileTab('props');
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging || !activeElementId() || isPlaying() || !containerRef) return;
      const rect = containerRef.getBoundingClientRect();
      const scale = Math.min(rect.width / 800, rect.height / 500);
      const offX = (rect.width - 800 * scale) / 2;
      const offY = (rect.height - 500 * scale) / 2;
      
      const x = (e.clientX - rect.left - offX) / scale;
      const y = (e.clientY - rect.top - offY) / scale;
      
      updateElement(activeElementId()!, { x: x - dragOffsetX, y: y - dragOffsetY });
    };

    const handlePointerUp = () => { isDragging = false; };

    canvasRef?.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    onCleanup(() => {
      observer.disconnect();
      canvasRef?.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    });

    requestRender();
    document.fonts.ready.then(requestRender);
  });

  // Audio Engine
  const initAudio = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const stopAudio = () => {
    if (currentAudioSource) {
      try { currentAudioSource.stop(); } catch(e){}
      currentAudioSource.disconnect();
      currentAudioSource = null;
    }
  };

  const playAudio = (globalTimeOffset: number) => {
    if (!currentAudioBuffer || !audioCtx) return;
    stopAudio();
    
    currentAudioSource = audioCtx.createBufferSource();
    currentAudioSource.buffer = currentAudioBuffer;
    
    globalGainNode = audioCtx.createGain();
    globalGainNode.gain.value = isMuted() ? 0 : audioVolume();
    currentAudioSource.connect(globalGainNode);
    
    if (isExporting() && exportAudioDest) {
      globalGainNode.connect(exportAudioDest);
    } else {
      globalGainNode.connect(audioCtx.destination);
    }

    const trackDur = audioTrimOut() - audioTrimIn();
    if (trackDur <= 0) return;

    let playOffset = globalTimeOffset % trackDur;
    let startPos = audioTrimIn() + playOffset;
    
    currentAudioSource.loop = true;
    currentAudioSource.loopStart = audioTrimIn();
    currentAudioSource.loopEnd = audioTrimOut();

    currentAudioSource.start(0, startPos);
  };

  const drawWaveform = () => {
    if (!currentAudioBuffer || !waveformCanvasRef) return;
    const wCtx = waveformCanvasRef.getContext('2d');
    if (!wCtx) return;
    const rect = waveformCanvasRef.parentElement!.getBoundingClientRect();
    waveformCanvasRef.width = rect.width;
    waveformCanvasRef.height = rect.height;

    const data = currentAudioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / waveformCanvasRef.width);
    const amp = waveformCanvasRef.height / 2;

    wCtx.clearRect(0, 0, waveformCanvasRef.width, waveformCanvasRef.height);
    wCtx.fillStyle = '#10b981';

    for (let i = 0; i < waveformCanvasRef.width; i++) {
      let min = 1.0, max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      const y = (1 + min) * amp;
      const h = Math.max(1, (max - min) * amp);
      wCtx.fillRect(i, y, 1, h);
    }

    const dur = currentAudioBuffer.duration;
    const startX = (audioTrimIn() / dur) * waveformCanvasRef.width;
    const endX = (audioTrimOut() / dur) * waveformCanvasRef.width;

    wCtx.fillStyle = 'rgba(0,0,0,0.6)';
    wCtx.fillRect(0, 0, startX, waveformCanvasRef.height);
    wCtx.fillRect(endX, 0, waveformCanvasRef.width - endX, waveformCanvasRef.height);
  };

  createEffect(() => {
    audioTrimIn(); audioTrimOut();
    drawWaveform();
  });

  const handleAudioUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    initAudio();
    setAudioFileLabel(file.name);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      audioCtx!.decodeAudioData(evt.target!.result as ArrayBuffer, (buffer) => {
        currentAudioBuffer = buffer;
        setAudioDuration(buffer.duration);
        setAudioTrimIn(0);
        setAudioTrimOut(buffer.duration);
        drawWaveform();
      });
    };
    reader.readAsArrayBuffer(file);
  };

  let offCanvasExport: HTMLCanvasElement | null = null;
  let offCtxExport: CanvasRenderingContext2D | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];

  const gameLoop = (timestamp: number) => {
    if (!isPlaying()) { lastTimestamp = timestamp; return; }
    const dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    
    let newTime = globalTime() + dt;
    if (newTime >= maxDuration()) {
      if (isExporting()) {
        newTime = maxDuration();
      } else {
        newTime = 0; // Loop
        playAudio(0);
      }
    }
    setGlobalTime(newTime);
    
    const newActiveIdx = Math.floor(newTime / SLIDE_DURATION) % Math.max(1, state().slides.length);
    if (newActiveIdx !== activeSlideIndex() && !isExporting()) {
      setActiveSlideIndex(newActiveIdx || 0);
      setActiveElementId(null);
    }
    
    if (isExporting() && offCanvasExport && offCtxExport) {
      offCtxExport.save();
      offCtxExport.setTransform(1, 0, 0, 1, 0, 0);
      offCtxExport.clearRect(0, 0, offCanvasExport.width, offCanvasExport.height);
      renderFrame(offCtxExport, globalTime(), offCanvasExport.width, offCanvasExport.height, state().slides, false, false, true, null);
      offCtxExport.restore();
    }

    animationFrameId = requestAnimationFrame(gameLoop);
  };

  const togglePlay = () => {
    initAudio();
    setIsPlaying(!isPlaying());
    if (isPlaying()) {
      lastTimestamp = performance.now();
      setActiveElementId(null);
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      playAudio(globalTime());
      animationFrameId = requestAnimationFrame(gameLoop);
    } else {
      cancelAnimationFrame(animationFrameId);
      stopAudio();
      const currIdx = Math.floor(globalTime() / SLIDE_DURATION);
      if(currIdx !== activeSlideIndex()) setActiveSlideIndex(currIdx);
      requestRender();
    }
  };

  const exportVideo = async () => {
    if (isExporting() || (mediaRecorder && mediaRecorder.state === 'recording')) return;
    setIsExporting(true);

    const aspect = aspectRatio();
    let nativeW = 1920; let nativeH = 1080;
    if (aspect === '9:16') { nativeW = 1080; nativeH = 1920; }
    else if (aspect === '1:1') { nativeW = 1080; nativeH = 1080; }
    else if (aspect === '4:5') { nativeW = 1080; nativeH = 1350; }
    else if (aspect === '3:4') { nativeW = 1080; nativeH = 1440; }
    else if (aspect === '4:3') { nativeW = 1440; nativeH = 1080; }
    else if (aspect === '2:1') { nativeW = 2160; nativeH = 1080; }

    offCanvasExport = new OffscreenCanvas(nativeW, nativeH) as unknown as HTMLCanvasElement;
    offCtxExport = offCanvasExport.getContext('2d');

    try {
      initAudio();
      if(audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
      
      const stream = (offCanvasExport as any).captureStream(30);
      const tracks = [...stream.getVideoTracks()];

      if (currentAudioBuffer && audioCtx) {
        exportAudioDest = audioCtx.createMediaStreamDestination();
        tracks.push(...exportAudioDest.stream.getAudioTracks());
      }

      const combinedStream = new MediaStream(tracks);
      let options = { mimeType: 'video/webm; codecs=vp9' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/mp4' };
      }

      mediaRecorder = new MediaRecorder(combinedStream, options);
      recordedChunks = [];

      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: options.mimeType || 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `motion-export-${Date.now()}.${options.mimeType.includes('webm') ? 'webm' : 'mp4'}`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 100);
        
        setIsExporting(false);
        offCanvasExport = null;
        offCtxExport = null;
        exportAudioDest = null;
      };

      if(isPlaying()) togglePlay();
      setGlobalTime(0);
      setActiveElementId(null);
      mediaRecorder.start();
      togglePlay();

      setTimeout(() => {
        if (mediaRecorder?.state === 'recording') {
          togglePlay();
          mediaRecorder.stop();
          setGlobalTime(0);
        }
      }, maxDuration() * 1000 + 300);

    } catch (err) {
      console.error(err);
      setIsExporting(false);
    }
  };

  const activeSlide = () => state().slides[activeSlideIndex()];
  const activeElement = () => activeSlide()?.elements.find(e => e.id === activeElementId());

  return (
    <div class="w-full h-[calc(100vh-3.5rem)] flex flex-col bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 overflow-hidden font-sans">
      
      {/* HEADER SECTION */}
      <header class="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-white/10 shrink-0 z-30 relative shadow-sm">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-sm border border-emerald-200 dark:border-emerald-800">
            <Icon name="layers" class="w-4 h-4" />
          </div>
          <div>
            <h1 class="text-sm font-bold text-gray-900 dark:text-white tracking-tight leading-tight">Kinetic Studio</h1>
            <p class="text-[10px] text-gray-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Motion Graphics Editor</p>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <button onClick={() => setIsExportingSnapshot(true)} class="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 hover:border-emerald-300 dark:hover:border-white/20 text-xs font-semibold shadow-sm transition-all text-gray-700 dark:text-gray-300 cursor-pointer">
            <Icon name="camera" class="w-4 h-4 text-emerald-500" />
            <span class="hidden sm:inline">Snapshot</span>
          </button>
          
          <button onClick={() => setIsExporting(true)} class="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white border border-transparent shadow-md transition-all text-xs font-semibold cursor-pointer">
            <Icon name="download" class="w-4 h-4" />
            <span class="hidden sm:inline">Export Video</span>
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main class="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden relative z-10 p-2 sm:p-4 gap-4">
        
        {/* LEFT SIDEBAR */}
        <aside class={`w-full lg:w-64 h-[45vh] lg:h-auto bg-white/70 dark:bg-zinc-900/75 backdrop-blur-xl border border-gray-200 dark:border-white/10 flex-col-reverse lg:flex-col shrink-0 z-20 rounded-2xl overflow-hidden shadow-sm order-2 lg:order-1 ${
          (mobileTab() === 'slides' || mobileTab() === 'add') ? 'flex' : 'hidden lg:flex'
        }`}>
          <div class="hidden lg:flex border-t lg:border-t-0 lg:border-b border-gray-200 dark:border-white/5 bg-gray-100/50 dark:bg-black/20 shrink-0">
            <button class={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors uppercase tracking-wider ${leftTab() === 'slides' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300'}`} onClick={() => setLeftTab('slides')}>Slides</button>
            <button class={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors uppercase tracking-wider ${leftTab() === 'add' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300'}`} onClick={() => setLeftTab('add')}>Add</button>
            <button class={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors uppercase tracking-wider ${leftTab() === 'audio' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300'}`} onClick={() => setLeftTab('audio')}>Audio</button>
            <button class={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors uppercase tracking-wider ${leftTab() === 'settings' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300'}`} onClick={() => setLeftTab('settings')}>Settings</button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            <Show when={leftTab() === 'slides'}>
              <button onClick={addSlide} class="w-full py-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 hover:border-emerald-500 dark:hover:border-emerald-500 shadow-sm transition-all text-xs font-semibold flex justify-center items-center gap-2">
                <Icon name="plus-circle" class="w-4 h-4" /> New Slide
              </button>
              <div class="h-px bg-gray-200 dark:bg-white/5 my-1"></div>
              <div class="space-y-2">
                <For each={state().slides}>{(slide, idx) => (
                  <div 
                    class={`p-3 rounded-xl border transition-all cursor-pointer group ${idx() === activeSlideIndex() ? 'bg-emerald-50 dark:bg-black/40 border-emerald-500 shadow-inner' : 'bg-white dark:bg-black/20 border-gray-200 dark:border-white/5 hover:border-emerald-300 dark:hover:border-white/20'}`}
                    onClick={() => { setActiveSlideIndex(idx()); setActiveElementId(null); setGlobalTime(idx() * SLIDE_DURATION); }}
                  >
                    <div class="flex justify-between items-center mb-2">
                      <span class={`text-xs font-bold ${idx() === activeSlideIndex() ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-zinc-400'}`}>Slide {idx() + 1}</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteSlide(idx()); }} class="text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Icon name="trash-2" class="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div class="text-[10px] text-gray-500 dark:text-zinc-500 flex items-center gap-1.5">
                      <div class="w-3 h-3 rounded-full border border-gray-300 dark:border-white/20" style={{ background: slide.bg === 'transparent' ? '#fff' : slide.bg }}></div>
                      Trans: {slide.transition}
                    </div>
                  </div>
                )}</For>
              </div>
            </Show>

            <Show when={leftTab() === 'settings'}>
              <div class="flex flex-col gap-3">
                <label class="block text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Canvas Aspect Ratio</label>
                <div class="grid grid-cols-2 gap-2">
                  <AspectRatioCard value="16:9" label="16:9 Landscape" shape="w-8 h-4.5" orientation="Horizontal Video" />
                  <AspectRatioCard value="9:16" label="9:16 Portrait" shape="w-4.5 h-8" orientation="TikTok & Shorts" />
                  <AspectRatioCard value="1:1" label="1:1 Square" shape="w-6 h-6" orientation="Instagram Feed" />
                  <AspectRatioCard value="4:5" label="4:5 Portrait" shape="w-6.5 h-8" orientation="Social Media" />
                  <AspectRatioCard value="3:4" label="3:4 Standard" shape="w-6 h-8" orientation="Pinterest Pin" />
                  <AspectRatioCard value="4:3" label="4:3 Standard" shape="w-8 h-6" orientation="Classic Desktop" />
                  <AspectRatioCard value="2:1" label="2:1 Panoramic" shape="w-8 h-4" orientation="Panoramic Banner" />
                </div>
              </div>
            </Show>

            <Show when={leftTab() === 'add'}>
              <h3 class="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1 ml-1">Typography</h3>
              <button onClick={() => addElement('text')} class="w-full p-3 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 shadow-sm hover:border-emerald-400 dark:hover:border-white/20 flex items-center gap-3 text-sm font-medium transition-all">
                <div class="w-7 h-7 rounded-md bg-gray-100 dark:bg-black/40 flex items-center justify-center font-serif text-sm font-bold text-emerald-600 dark:text-emerald-400 border border-gray-200 dark:border-white/5 shadow-inner">T</div>
                Text Layer
              </button>
              
              <h3 class="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mt-4 mb-1 ml-1">Shapes</h3>
              <button onClick={() => addElement('rect')} class="w-full p-3 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 shadow-sm hover:border-blue-400 dark:hover:border-white/20 flex items-center gap-3 text-sm font-medium transition-all">
                <div class="w-7 h-7 rounded-md bg-gray-100 dark:bg-black/40 flex items-center justify-center border border-gray-200 dark:border-white/5 shadow-inner">
                  <div class="w-3.5 h-3.5 border-2 border-blue-500 rounded-[2px]"></div>
                </div>
                Rectangle
              </button>
              <button onClick={() => addElement('circle')} class="w-full p-3 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 shadow-sm hover:border-rose-400 dark:hover:border-white/20 flex items-center gap-3 text-sm font-medium transition-all">
                <div class="w-7 h-7 rounded-md bg-gray-100 dark:bg-black/40 flex items-center justify-center border border-gray-200 dark:border-white/5 shadow-inner">
                  <div class="w-3.5 h-3.5 border-2 border-rose-500 rounded-full"></div>
                </div>
                Circle
              </button>
            </Show>
          </div>
        </aside>

        {/* CENTER CANVASES */}
        <section class="flex-none h-[50vh] lg:h-auto lg:flex-1 flex flex-col relative min-w-0 min-h-0 bg-transparent order-1 lg:order-2">
          {/* Canvas Viewport */}
          <div class="flex-1 min-h-[300px] relative bg-gray-100/50 dark:bg-black/50 border border-gray-200 dark:border-white/5 rounded-xl shadow-inner overflow-hidden flex items-center justify-center p-4">
            <div ref={containerRef} class="w-full h-full relative flex items-center justify-center" id="kinetic-canvas-container">
              <canvas ref={canvasRef} class="absolute inset-0 w-full h-full cursor-pointer touch-none"></canvas>
            </div>
          </div>

          {/* Timeline Bar */}
          <div class="h-20 bg-white/70 dark:bg-zinc-900/75 backdrop-blur-xl border border-gray-200 dark:border-white/10 mx-2 sm:mx-6 mb-2 rounded-2xl flex items-center gap-4 sm:gap-6 px-4 sm:px-6 shrink-0 z-10 shadow-sm">
            <button onClick={togglePlay} class="text-emerald-600 dark:text-zinc-200 hover:scale-105 transition-transform flex items-center justify-center shrink-0 w-10 h-10">
              <Show when={!isPlaying()} fallback={<Icon name="pause" class="w-8 h-8 drop-shadow-sm" />}>
                <Icon name="play" class="w-8 h-8 drop-shadow-sm fill-current" />
              </Show>
            </button>
            <div class="font-mono text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 w-12 shrink-0 bg-gray-100 dark:bg-black/40 px-2 py-1 rounded border border-gray-200 dark:border-white/5 text-center shadow-inner">
              {globalTime().toFixed(1)}s
            </div>
              <input 
                type="range" 
                min="0" max={maxDuration()} step="0.01" 
                value={globalTime()} 
                onInput={(e) => {
                  const t = parseFloat(e.currentTarget.value);
                  setGlobalTime(t);
                  const newIdx = Math.floor(t / SLIDE_DURATION) % Math.max(1, state().slides.length);
                  if (newIdx !== activeSlideIndex()) {
                    setActiveSlideIndex(newIdx);
                    setActiveElementId(null);
                  }
                  if(isPlaying()) playAudio(t);
                }}
                class="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-gray-200 dark:bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500"
              />
            <button onClick={() => { setIsMuted(!isMuted()); if(globalGainNode) globalGainNode.gain.value = !isMuted() ? 0 : audioVolume(); }} class="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors shrink-0">
              <Icon name={isMuted() ? "volume-x" : "volume-2"} class="w-5 h-5" />
            </button>
            <button onClick={exportVideo} disabled={isExporting()} class="bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-zinc-950 px-4 py-1.5 rounded-full font-bold text-xs shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              <Show when={isExporting()} fallback={<><Icon name="download" class="w-3.5 h-3.5" /> Export</>}>
                Rendering...
              </Show>
            </button>
          </div>
        </section>

        {/* RIGHT SIDEBAR */}
        <aside class={`w-full lg:w-[320px] h-[45vh] lg:h-auto bg-white/70 dark:bg-zinc-900/75 backdrop-blur-xl border border-gray-200 dark:border-white/10 flex-col-reverse lg:flex-col shrink-0 z-20 rounded-2xl overflow-hidden shadow-sm order-3 lg:order-3 ${
          (mobileTab() === 'layers' || mobileTab() === 'props') ? 'flex' : 'hidden lg:flex'
        }`}>
          <div class="hidden lg:flex border-t lg:border-t-0 lg:border-b border-gray-200 dark:border-white/5 bg-gray-100/50 dark:bg-black/20 shrink-0">
            <button class={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors uppercase tracking-wider ${rightTab() === 'layers' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300'}`} onClick={() => setRightTab('layers')}>Layers</button>
            <button class={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors uppercase tracking-wider ${rightTab() === 'props' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300'}`} onClick={() => setRightTab('props')}>Properties</button>
          </div>

          <div class="flex-1 overflow-y-auto p-4 relative">
            <Show when={rightTab() === 'layers'}>
              <div class="space-y-2">
                <Show when={activeSlide()?.elements.length > 0} fallback={<div class="text-center text-gray-400 dark:text-zinc-600 text-xs mt-10">No layers on this slide.</div>}>
                  <For each={[...(activeSlide()?.elements || [])].reverse()}>{(el) => (
                    <div 
                      class={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${el.id === activeElementId() ? 'bg-emerald-50 dark:bg-black/40 border-emerald-500 shadow-inner' : 'bg-white dark:bg-black/20 border-gray-200 dark:border-white/5 hover:border-emerald-300 dark:hover:border-white/20'}`}
                      onClick={() => { setActiveElementId(el.id); setRightTab('props'); }}
                    >
                      <div class="flex items-center gap-3 overflow-hidden">
                        <div class="w-6 h-6 rounded bg-gray-100 dark:bg-black/50 text-[10px] flex items-center justify-center font-bold text-gray-500 dark:text-zinc-500 border border-gray-200 dark:border-white/5">
                          {el.type === 'text' ? 'T' : el.type === 'rect' ? '■' : '●'}
                        </div>
                        <div class={`text-xs font-semibold truncate ${el.id === activeElementId() ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-zinc-300'}`}>
                          {el.type === 'text' ? `"${el.text?.substring(0, 12)}"` : el.type.toUpperCase()}
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }} class="text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 p-1">
                        <Icon name="trash-2" class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}</For>
                </Show>
              </div>
            </Show>

            <Show when={rightTab() === 'props'}>
              <Show when={!activeElement()} fallback={
                <div class="space-y-6">
                  {/* Element Properties */}
                  <div class="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-white/10">
                    <div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-500/30">
                      <Icon name="settings-2" class="w-4 h-4" />
                    </div>
                    <div>
                      <h2 class="text-sm font-bold leading-tight">Element Settings</h2>
                      <p class="text-[10px] text-gray-500 dark:text-zinc-400">Customize appearance & motion</p>
                    </div>
                  </div>

                  <Show when={activeElement()?.type === 'text'}>
                    <div class="space-y-2">
                      <label class="text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest">Text Content</label>
                      <input 
                        type="text" 
                        value={activeElement()?.text || ''} 
                        onInput={(e) => updateElement(activeElementId()!, { text: e.currentTarget.value })}
                        class="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-sm font-medium focus:border-emerald-500 outline-none transition-colors" 
                      />
                    </div>
                    <div class="bg-gray-50 dark:bg-black/20 p-3 rounded-xl border border-gray-200 dark:border-white/5 shadow-inner space-y-3">
                      <div>
                        <label class="text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest mb-1 block">Font Family</label>
                        <select 
                          value={activeElement()?.font} 
                          onChange={(e) => updateElement(activeElementId()!, { font: e.currentTarget.value })}
                          class="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs font-semibold focus:border-emerald-500 outline-none"
                        >
                          <option value="'Inter'">Inter</option>
                          <option value="'Space Grotesk'">Space Grotesk</option>
                          <option value="'Plus Jakarta Sans'">Plus Jakarta Sans</option>
                          <option value="'Outfit'">Outfit</option>
                          <option value="'Caveat'">Caveat</option>
                        </select>
                      </div>
                      <div class="grid grid-cols-2 gap-3">
                        <div>
                          <label class="text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest mb-1 block">Weight</label>
                          <select 
                            value={activeElement()?.fontWeight} 
                            onChange={(e) => updateElement(activeElementId()!, { fontWeight: e.currentTarget.value })}
                            class="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                          >
                            <option value="400">Regular</option>
                            <option value="600">SemiBold</option>
                            <option value="700">Bold</option>
                            <option value="800">ExtraBold</option>
                          </select>
                        </div>
                        <div>
                          <label class="text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest mb-1 block">Spacing</label>
                          <input 
                            type="number" 
                            value={activeElement()?.letterSpacing} 
                            onInput={(e) => updateElement(activeElementId()!, { letterSpacing: parseFloat(e.currentTarget.value) || 0 })}
                            class="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs pl-2 focus:border-emerald-500 outline-none" 
                          />
                        </div>
                      </div>
                    </div>
                  </Show>

                  {/* General Appearance */}
                  <div class="bg-gray-50 dark:bg-black/20 p-3 rounded-xl border border-gray-200 dark:border-white/5 shadow-inner space-y-4">
                    <div class="grid grid-cols-2 gap-3 pt-1 mb-2 border-b border-gray-200 dark:border-white/5 pb-3">
                      <div>
                        <label class="text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest mb-1 block">Size</label>
                        <input 
                          type="number" 
                          value={activeElement()?.size} 
                          onInput={(e) => updateElement(activeElementId()!, { size: parseInt(e.currentTarget.value) || 10 })}
                          class="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs pl-2 focus:border-emerald-500 outline-none" 
                        />
                      </div>
                      <div>
                        <label class="text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest mb-1 block">Rotate °</label>
                        <input 
                          type="number" 
                          value={activeElement()?.rotation} 
                          onInput={(e) => updateElement(activeElementId()!, { rotation: parseFloat(e.currentTarget.value) || 0 })}
                          class="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs pl-2 focus:border-emerald-500 outline-none" 
                        />
                      </div>
                    </div>
                    
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-semibold text-gray-700 dark:text-zinc-300">Fill Color</span>
                      <input 
                        type="color" 
                        value={activeElement()?.fill} 
                        onChange={(e) => updateElement(activeElementId()!, { fill: e.currentTarget.value })}
                        class="w-7 h-7 rounded cursor-pointer bg-transparent border-0" 
                      />
                    </div>
                  </div>
                  
                </div>
              }>
                <div class="space-y-6">
                  {/* Slide Properties */}
                  <div class="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-white/10">
                    <div class="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30">
                      <Icon name="image" class="w-4 h-4" />
                    </div>
                    <div>
                      <h2 class="text-sm font-bold leading-tight">Slide Settings</h2>
                      <p class="text-[10px] text-gray-500 dark:text-zinc-400">Configure global slide visuals</p>
                    </div>
                  </div>

                  <div class="space-y-4">
                    <div class="flex items-center justify-between bg-gray-50 dark:bg-black/20 p-3 rounded-xl border border-gray-200 dark:border-white/5 shadow-inner">
                      <span class="text-xs font-semibold text-gray-700 dark:text-zinc-300">Background Color</span>
                      <input 
                        type="color" 
                        value={activeSlide()?.bg === 'transparent' ? '#000000' : activeSlide()?.bg} 
                        onInput={(e) => updateSlide(activeSlideIndex(), { bg: e.currentTarget.value })}
                        class="w-8 h-8 rounded cursor-pointer bg-transparent border-0" 
                      />
                    </div>

                    <div class="bg-gray-50 dark:bg-black/20 p-3 rounded-xl border border-gray-200 dark:border-white/5 shadow-inner space-y-3">
                      <h3 class="text-[10px] font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest">Transition (Out)</h3>
                      <div>
                        <label class="text-[10px] text-gray-500 dark:text-zinc-400 block mb-1">Effect Type</label>
                        <select 
                          value={activeSlide()?.transition}
                          onChange={(e) => updateSlide(activeSlideIndex(), { transition: e.currentTarget.value as any })}
                          class="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                        >
                          <option value="none">None (Cut)</option>
                          <option value="fade">Crossfade</option>
                          <option value="slideLeft">Slide Left</option>
                          <option value="slideUp">Slide Up</option>
                        </select>
                      </div>
                      <div>
                        <label class="text-[10px] text-gray-500 dark:text-zinc-400 block mb-1 flex justify-between">
                          <span>Duration</span> <span class="text-emerald-600 dark:text-emerald-400">{activeSlide()?.transDuration}s</span>
                        </label>
                        <input 
                          type="range" 
                          min="0.1" max="2.0" step="0.1" 
                          value={activeSlide()?.transDuration} 
                          onInput={(e) => updateSlide(activeSlideIndex(), { transDuration: parseFloat(e.currentTarget.value) })}
                          class="w-full accent-emerald-500 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-500" 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Show>
            </Show>
          </div>
        </aside>

        {/* MOBILE UNIFIED TABS */}
        <div class="flex lg:hidden w-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden shrink-0 shadow-sm order-4">
          <button 
            class={`flex-1 py-3 text-[10px] sm:text-xs font-bold transition-colors uppercase tracking-wider flex flex-col items-center gap-1 ${mobileTab() === 'slides' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-500 dark:text-zinc-500'}`} 
            onClick={() => setMobileTab('slides')}
          >
            Slides
          </button>
          <button 
            class={`flex-1 py-3 text-[10px] sm:text-xs font-bold transition-colors uppercase tracking-wider flex flex-col items-center gap-1 ${mobileTab() === 'add' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-500 dark:text-zinc-500'}`} 
            onClick={() => setMobileTab('add')}
          >
            Add
          </button>
          <button 
            class={`flex-1 py-3 text-[10px] sm:text-xs font-bold transition-colors uppercase tracking-wider flex flex-col items-center gap-1 ${mobileTab() === 'audio' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-500 dark:text-zinc-500'}`} 
            onClick={() => setMobileTab('audio')}
          >
            Audio
          </button>
          <button 
            class={`flex-1 py-3 text-[10px] sm:text-xs font-bold transition-colors uppercase tracking-wider flex flex-col items-center gap-1 ${mobileTab() === 'layers' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-500 dark:text-zinc-500'}`} 
            onClick={() => setMobileTab('layers')}
          >
            Layers
          </button>
          <button 
            class={`flex-1 py-3 text-[10px] sm:text-xs font-bold transition-colors uppercase tracking-wider flex flex-col items-center gap-1 ${mobileTab() === 'props' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : 'text-gray-500 dark:text-zinc-500'}`} 
            onClick={() => setMobileTab('props')}
          >
            Props
          </button>
        </div>
      </main>
      
      {/* MODALS */}
      <ExportModal
        isOpen={isExporting()}
        onClose={() => setIsExporting(false)}
        store={{ ...state(), duration: maxDuration() } as any}
        aspectRatio={aspectRatio()}
        projectTitle="Kinetic_Studio_Export"
        onExport={exportVideo}
      />
      
      <SnapshotModal
        isOpen={isExportingSnapshot()}
        onClose={() => setIsExportingSnapshot(false)}
        onExport={exportSnapshotFrame}
      />
    </div>
  );
}
