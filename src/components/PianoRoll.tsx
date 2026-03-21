import React, { useRef, useEffect, useState, useMemo } from 'react';
import { GRID_MS, getScale } from '../types';
import type { Beep, Note } from '../types';

let globalAudioCtx: AudioContext | null = null;

const getGlobalAudioCtx = () => {
  if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
    globalAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Safari/iOS Unlock Trick
    const osc = globalAudioCtx.createOscillator();
    const gain = globalAudioCtx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(globalAudioCtx.destination);
    osc.start(0);
    osc.stop(globalAudioCtx.currentTime + 0.001);
    
    globalAudioCtx.resume();
  }
  return globalAudioCtx;
};

// Simple Auto-correlation pitch detection
function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  let SIZE = buf.length;
  let rms = 0;

  for (let i = 0; i < SIZE; i++) {
    let val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1; // quiet

  let r1 = 0, r2 = SIZE - 1, thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }

  buf = buf.slice(r1, r2);
  SIZE = buf.length;

  let c = new Float32Array(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++)
    for (let j = 0; j < SIZE - i; j++)
      c[i] = c[i] + buf[j] * buf[j + i];

  let d = 0; while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  let T0 = maxpos;

  return sampleRate / T0;
}


interface PianoRollProps {
  beep: Beep;
  onUpdate: (updatedBeep: Beep) => void;
  onToggleSidebar?: () => void;
  onSave?: () => void;
  onDiscard?: () => void;
  isDirty?: boolean;
}

const PianoRoll: React.FC<PianoRollProps> = ({ beep, onUpdate, onToggleSidebar, onSave, onDiscard, isDirty }) => {
  const scale = useMemo(() => getScale(), []);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const animationRef = useRef<number | null>(null);
  const activeOscillatorsRef = useRef<OscillatorNode[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const wavInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null);

  // Mic Recording State
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [micProgress, setMicProgress] = useState(0); 
  const [micSpeed, setMicSpeed] = useState(1); // 1x, 2x, 3x
  const [micCountdown, setMicCountdown] = useState<number | null>(null);
  const micCountdownRef = useRef<number | null>(null);
  const micIntervalRef = useRef<number | null>(null);
  const recordedFrequenciesRef = useRef<number[]>([]);

  const totalCells = (beep.durationSec * 1000) / GRID_MS;

  // Initialize Audio
  // Removed old getAudioCtx

  const playNote = (freq: number, duration: number = 0.1) => {
    const ctx = getGlobalAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'square';
    
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, now);
    
    // Safari-safe envelope targeting 'now' accurately
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, now);
    gain.gain.setTargetAtTime(0.2, now, 0.01);
    gain.gain.setTargetAtTime(0, now + duration - 0.01, 0.01);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + duration);
  };

  const handleMouseDown = (cellIndex: number, freq: number, hasNote: boolean) => {
    setIsDragging(true);
    const mode = hasNote ? 'remove' : 'add';
    setDragMode(mode);
    applyTool(cellIndex, freq, mode);
  };

  const handleMouseEnter = (cellIndex: number, freq: number) => {
    if (isDragging && dragMode) {
      applyTool(cellIndex, freq, dragMode);
    }
  };

  const applyTool = (cellIndex: number, freq: number, mode: 'add' | 'remove') => {
    const startMs = cellIndex * GRID_MS;
    const existingNote = beep.notes.find(n => n.startMs === startMs);
    
    let newNotes = [...beep.notes];
    if (mode === 'add') {
      if (existingNote && existingNote.freq === freq) return;
      newNotes = newNotes.filter(n => n.startMs !== startMs);
      newNotes.push({ freq, durationMs: GRID_MS, startMs });
      playNote(freq, 0.05);
    } else {
      if (existingNote && existingNote.freq === freq) {
        newNotes = newNotes.filter(n => n.startMs !== startMs);
      }
    }
    
    if (JSON.stringify(newNotes) !== JSON.stringify(beep.notes)) {
      onUpdate({ ...beep, notes: newNotes });
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setDragMode(null);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  const startPlayback = () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    
    const ctx = getGlobalAudioCtx();
    ctx.resume(); // Synchronous resume on user gesture
    
    setIsPlaying(true);
    
    // Use 150ms buffer
    const schedulingOffset = 0.15;
    const now = ctx.currentTime;
    const uiStartPerfTime = performance.now();
    
    activeOscillatorsRef.current = [];
    
    const totalCells = (beep.durationSec * 1000) / GRID_MS;
    const mergedNotes: { freq: number; durationMs: number; startMs: number }[] = [];
    
    let currentNote: { freq: number; durationMs: number; startMs: number } | null = null;
    
    for (let i = 0; i < totalCells; i++) {
        const startMs = i * GRID_MS;
        const note = beep.notes.find(n => n.startMs === startMs);
        const f = note ? note.freq : 0;
        
        if (f === 0) {
            if (currentNote) {
                mergedNotes.push(currentNote);
                currentNote = null;
            }
            continue;
        }
        
        if (currentNote && currentNote.freq === f) {
            currentNote.durationMs += GRID_MS;
        } else {
            if (currentNote) mergedNotes.push(currentNote);
            currentNote = { freq: f, durationMs: GRID_MS, startMs };
        }
    }
    if (currentNote) mergedNotes.push(currentNote);

    mergedNotes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const start = now + schedulingOffset + note.startMs / 1000;
      const end = now + schedulingOffset + (note.startMs + note.durationMs) / 1000;
      
      osc.frequency.value = note.freq;
      osc.frequency.setValueAtTime(note.freq, start);
      
      const attack = 0.005; 
      const release = 0.005;
      
      gain.gain.value = 0;
      gain.gain.setValueAtTime(0, start);
      gain.gain.setTargetAtTime(0.2, start, attack);
      gain.gain.setTargetAtTime(0, end - release, release);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(start);
      osc.stop(end);
      
      activeOscillatorsRef.current.push(osc);
    });

    const updateProgress = () => {
      const elapsed = performance.now() - uiStartPerfTime - (schedulingOffset * 1000);
      const totalDuration = beep.durationSec * 1000;
      
      if (elapsed >= totalDuration) {
        stopPlayback();
        return;
      }
      setCurrentTime(elapsed < 0 ? 0 : elapsed);
      animationRef.current = requestAnimationFrame(updateProgress);
    };
    animationRef.current = requestAnimationFrame(updateProgress);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    
    activeOscillatorsRef.current.forEach(osc => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // Ignored
      }
    });
    activeOscillatorsRef.current = [];
  };

  useEffect(() => {
    if (containerRef.current) {
      let targetIndex = 0;
      if (beep.notes.length > 0) {
        const firstNote = [...beep.notes].sort((a,b) => a.startMs - b.startMs)[0];
        const noteEntry = scale.find(s => Math.abs(s.freq - firstNote.freq) < 1);
        if (noteEntry) targetIndex = noteEntry.index;
      }
      const visualIndex = scale.findIndex(s => s.index === targetIndex);
      if (visualIndex >= 0) {
        const rowHeight = 24;
        const scrollOffset = (visualIndex * rowHeight) - (containerRef.current.clientHeight / 2) + (rowHeight / 2);
        containerRef.current.scrollTop = scrollOffset;
      }
    }
  }, [beep.id, scale]);

  const startMicRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = getGlobalAudioCtx();
      if (ctx.state === 'suspended') await ctx.resume();
      
      // Start Countdown
      let count = 3;
      setMicCountdown(count);
      
      const countInterval = window.setInterval(() => {
        count--;
        micCountdownRef.current = count;
        if (count === 1) {
          beginRecording(stream, ctx);
        }
        
        if (count === 0) {
          clearInterval(countInterval);
          setMicCountdown(null);
          micCountdownRef.current = null;
        } else {
          setMicCountdown(count);
        }
      }, 1000);

    } catch (err) {
      console.error("Mic error:", err);
      alert("Microphone access is required.");
    }
  };

  const beginRecording = (stream: MediaStream, ctx: AudioContext) => {
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);
    recordedFrequenciesRef.current = [];
    setMicProgress(0);

    // Record a bit more than planned to allow for silence skip
    // Plan: pattern duration * speed + roughly 1.5s extra
    const baseSteps = totalCells * micSpeed;
    const extraSteps = Math.floor(1500 / GRID_MS) * micSpeed; 
    const targetSteps = baseSteps + extraSteps;
    
    let step = 0;
    let hasStartedUI = false;

    micIntervalRef.current = window.setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      const freq = autoCorrelate(buffer, ctx.sampleRate);
      recordedFrequenciesRef.current.push(freq > 0 ? freq : 0);
      
      // Control UI: only start showing red bar when countdown is null
      if (micCountdownRef.current === null || micCountdownRef.current === 0) {
        if (!hasStartedUI) {
          setIsRecordingMic(true);
          hasStartedUI = true;
        }
        step++;
        setMicProgress((step / baseSteps) * 100);
      }

      if (step >= baseSteps || recordedFrequenciesRef.current.length >= targetSteps) {
        stopMicRecording(stream);
      }
    }, GRID_MS);
  };

  const stopMicRecording = (stream?: MediaStream) => {
    if (micIntervalRef.current) {
      clearInterval(micIntervalRef.current);
      micIntervalRef.current = null;
    }
    if (stream) stream.getTracks().forEach(t => t.stop());
    processRecordedNotes(recordedFrequenciesRef.current, micSpeed);
    setIsRecordingMic(false);
    setMicProgress(0);
  };

  const handleWavImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // reset file input
    e.target.value = "";
    
    try {
        const ctx = getGlobalAudioCtx();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        
        // Use mono (channel 0)
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        // Analyze at GRID_MS steps
        const stepSize = Math.floor(sampleRate * (GRID_MS / 1000));
        const windowSize = 2048; 
        
        const freqs: number[] = [];
        for (let i = 0; i < channelData.length; i += stepSize) {
            // Get slice for autoCorrelate
            const end = Math.min(i + windowSize, channelData.length);
            const slice = channelData.slice(i, end);
            
            // If slice is too small for autoCorrelate, pad or skip? 
            // autoCorrelate handles sizes
            const freq = autoCorrelate(slice, sampleRate);
            freqs.push(freq > 0 ? freq : 0);
        }
        
        // Process with speed 1 (1x)
        processRecordedNotes(freqs, 1);
    } catch (err) {
        console.error("WAV Import Failed", err);
        alert("Failed to read audio file. Please ensure it is a valid WAV.");
    }
  };

  const processRecordedNotes = (allRawFreqs: number[], speed: number) => {
    if (allRawFreqs.length === 0) return;

    // Head-Perfecting: Find first note and skip silence
    const firstSoundIdx = allRawFreqs.findIndex(f => f > 0);
    if (firstSoundIdx === -1) return; // No sound found

    // Take current duration worth of frequencies starting from first sound
    const rawFreqs = allRawFreqs.slice(firstSoundIdx, firstSoundIdx + (totalCells * speed));

    // Downsample (Average/Pick in window of micSpeed)
    const processedFreqs: number[] = [];
    for (let i = 0; i < totalCells; i++) {
        const window = rawFreqs.slice(i * micSpeed, (i + 1) * micSpeed);
        const validPitches = window.filter(f => f > 0);
        if (validPitches.length > (micSpeed / (micSpeed === 1 ? 2 : 3))) { // More lenient for slow rec
            const avg = validPitches.reduce((a, b) => a + b, 0) / validPitches.length;
            processedFreqs.push(avg);
        } else {
            processedFreqs.push(0);
        }
    }

    // Find reference pitch from first sound
    const firstValidFreq = processedFreqs.find(f => f > 0);
    if (!firstValidFreq) return;

    const baseScaleFreq = scale.find(s => s.index === 0)?.freq || 4186;
    const newNotes: Note[] = [];

    processedFreqs.forEach((f, i) => {
      if (f > 0) {
        const interval = 12 * Math.log2(f / firstValidFreq);
        const targetFreq = Math.round(baseScaleFreq * Math.pow(2, Math.round(interval) / 12));
        const nearest = scale.reduce((prev, curr) => 
            Math.abs(curr.freq - targetFreq) < Math.abs(prev.freq - targetFreq) ? curr : prev
        );

        newNotes.push({
          freq: nearest.freq,
          durationMs: GRID_MS,
          startMs: i * GRID_MS
        });
      }
    });

    onUpdate({ ...beep, notes: newNotes });
  };

  return (
    <div className="p-4 lg:p-8 h-full flex flex-col">
      {/* Controls Bar */}
      <div className="mb-4 lg:mb-6 flex flex-wrap items-center gap-3 lg:gap-6 shrink-0">
        {onToggleSidebar && (
          <button 
            onClick={onToggleSidebar}
            className="lg:hidden p-2 text-gray-400 hover:text-white bg-gray-800 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        )}

        <div className="flex flex-col space-y-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Sound Name</span>
            {beep.lastUpdatedAt && (
              <span className="text-[9px] text-gray-700 font-mono tracking-tight whitespace-nowrap ml-2">
                {new Date(beep.lastUpdatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
          <input 
            type="text"
            value={beep.name}
            onChange={e => onUpdate({...beep, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '')})}
            className="bg-gray-950 border border-gray-800 focus:border-blue-500/50 outline-none rounded-lg px-3 py-2 text-sm text-blue-400 font-mono w-32 lg:w-48 transition-all"
          />
        </div>

        <div className="hidden lg:block h-10 w-px bg-gray-800 mx-2" />

        <div className="flex flex-col space-y-1">
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest pl-1">Pitch Shift</span>
          <div className="flex space-x-1 lg:space-x-2">
            <button onClick={() => onUpdate({ ...beep, notes: beep.notes.map(n => ({ ...n, freq: n.freq * 2 })) })} className="text-[10px] bg-gray-800 hover:bg-gray-700 font-mono py-1.5 lg:py-2 px-2 lg:px-3 rounded-lg border border-gray-700 text-gray-400 hover:text-white">OCT+</button>
            <button onClick={() => onUpdate({ ...beep, notes: beep.notes.map(n => ({ ...n, freq: n.freq / 2 })) })} className="text-[10px] bg-gray-800 hover:bg-gray-700 font-mono py-1.5 lg:py-2 px-2 lg:px-3 rounded-lg border border-gray-700 text-gray-400 hover:text-white">OCT-</button>
            <div className="w-px h-6 bg-gray-800 self-center mx-1" />
            <button onClick={() => onUpdate({ ...beep, notes: beep.notes.map(n => ({ ...n, freq: Math.round(n.freq * Math.pow(2, 1/12)) })) })} className="text-[10px] bg-gray-800 hover:bg-gray-700 font-mono py-1.5 lg:py-2 px-2 lg:px-3 rounded-lg border border-gray-700 text-gray-400 hover:text-white">NOTE+</button>
            <button onClick={() => onUpdate({ ...beep, notes: beep.notes.map(n => ({ ...n, freq: Math.round(n.freq / Math.pow(2, 1/12)) })) })} className="text-[10px] bg-gray-800 hover:bg-gray-700 font-mono py-1.5 lg:py-2 px-2 lg:px-3 rounded-lg border border-gray-700 text-gray-400 hover:text-white">NOTE-</button>
          </div>
        </div>

        <div className="h-10 w-px bg-gray-800 mx-2" />

        <div className="flex flex-col space-y-1">
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest pl-1">Live Input</span>
          <div className="flex items-center space-x-2">
            <select 
              value={micSpeed}
              onChange={e => setMicSpeed(Number(e.target.value))}
              className="bg-gray-950 text-[10px] border border-gray-800 outline-none rounded px-2 py-1.5 text-indigo-400 font-bold"
              disabled={isRecordingMic || micCountdown !== null}
            >
              <option value={1}>1x Speed</option>
              <option value={2}>2x Slow</option>
              <option value={3}>3x Slow</option>
            </select>
            <button 
                onClick={isRecordingMic ? () => stopMicRecording() : startMicRecording}
                disabled={micCountdown !== null}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-bold transition-all ${isRecordingMic ? 'bg-red-500 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-500'} text-white text-xs disabled:opacity-50`}
            >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" /></svg>
                <span>{isRecordingMic ? 'STOP' : (micCountdown !== null ? `IN ${micCountdown}...` : 'MIC REC')}</span>
            </button>
            <input 
              type="file" 
              accept=".wav,.mp3" 
              className="hidden" 
              ref={wavInputRef} 
              onChange={handleWavImport}
            />
            <button 
                onClick={() => wavInputRef.current?.click()}
                disabled={isRecordingMic || micCountdown !== null}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg font-bold bg-indigo-900/50 hover:bg-indigo-800 transition-all text-white text-xs disabled:opacity-50 border border-indigo-500/30"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" /></svg>
                <span>WAV IMP</span>
            </button>
          </div>
        </div>

        <div className="h-10 w-px bg-gray-800 mx-2" />

        <div className="flex flex-col space-y-1">
          <span className="text-[10px] font-bold text-transparent select-none uppercase tracking-widest pl-1">Actions</span>
          <div className="flex space-x-2">
            <button 
              onClick={startPlayback}
              className={`flex items-center justify-center space-x-2 px-6 py-2 rounded-lg font-bold transition-all ${isPlaying ? 'bg-red-500 shadow-red-500/20' : 'bg-green-600 shadow-green-600/20'} text-white text-xs whitespace-nowrap`}
            >
              <span>{isPlaying ? 'STOP' : 'PLAY PATTERN'}</span>
            </button>
            <button 
              onClick={onSave}
              disabled={!isDirty}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap text-xs ${isDirty ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-gray-800 text-gray-600 cursor-not-allowed hidden lg:flex'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              <span className="hidden lg:inline">{isDirty ? 'SAVE CHANGES' : 'SAVED'}</span>
              <span className="lg:hidden">{isDirty ? 'SAVE' : 'SAVED'}</span>
            </button>
            {isDirty && (
              <button 
                onClick={onDiscard}
                title="Discard Changes"
                className="flex items-center justify-center px-3 py-2 rounded-lg font-bold transition-all bg-red-950/80 hover:bg-red-900 border border-red-900/50 text-red-200 text-xs whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col space-y-1 ml-auto">
          <span className="text-[10px] font-bold text-transparent select-none uppercase tracking-widest pl-1">Config</span>
          <div className="flex items-center space-x-3 bg-gray-800/40 p-1 rounded-lg border border-gray-800">
             <span className="text-[10px] font-bold text-gray-500 px-3 uppercase">Duration</span>
             <select 
              value={beep.durationSec}
              onChange={e => onUpdate({...beep, durationSec: Number(e.target.value)})}
              className="bg-gray-950 text-sm border-0 outline-none rounded px-2 py-1 text-blue-400 font-bold"
             >
               {[1,2,3,4,5].map(v => <option key={v} value={v}>{v}s</option>)}
             </select>
          </div>
        </div>

        <div className="flex flex-col space-y-1">
          <span className="text-[10px] font-bold text-transparent select-none uppercase tracking-widest pl-1">Erase</span>
          <button 
            onClick={() => onUpdate({...beep, notes: []})}
            className="text-[10px] text-gray-500 hover:text-red-400 transition-colors uppercase font-bold tracking-widest border border-gray-800 px-4 py-2 rounded-lg h-[32px] flex items-center justify-center"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="relative border border-gray-800 rounded-xl overflow-hidden shadow-2xl bg-gray-950 flex-1 flex flex-col">
        {/* Recording Progress Overlay */}
        {(isRecordingMic || micCountdown !== null) && (
          <div className="absolute top-0 left-0 right-0 z-50 h-1 bg-gray-800">
            <div 
              className={`h-full ${micCountdown !== null ? 'bg-indigo-500' : 'bg-red-500'} shadow-[0_0_10px_currentColor] transition-all duration-300`} 
              style={{ width: micCountdown !== null ? '100%' : `${micProgress}%` }}
            />
          </div>
        )}
        
        {micCountdown !== null && (
          <div className="absolute inset-0 z-40 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center">
            <div className="text-8xl font-black text-white animate-ping drop-shadow-2xl">
              {micCountdown}
            </div>
          </div>
        )}
        
        <div className="relative flex-1 overflow-auto scroll-smooth custom-scrollbar" ref={containerRef}>
          <div className="relative" style={{ width: `${totalCells * 40 + 80}px`, height: `${scale.length * 24}px` }}>
            <div className="sticky left-0 top-0 z-20 w-20 bg-gray-950/95 border-r border-gray-800 h-full flex flex-col backdrop-blur-sm">
              {scale.map((s) => (
                <div key={s.index} className={`h-[24px] flex items-center px-3 text-[9px] font-mono border-b border-gray-900/50 ${s.name.includes('#') ? 'bg-gray-900/40 text-gray-600' : 'text-gray-400'}`}>
                  {s.name}{s.octave}
                </div>
              ))}
            </div>

            <div 
              className="absolute left-20 top-0 h-full"
              style={{ display: 'grid', gridTemplateColumns: `repeat(${totalCells}, 40px)`, gridTemplateRows: `repeat(${scale.length}, 24px)` }}
            >
              {scale.map((s, rowIndex) => (
                Array.from({ length: totalCells }).map((_, colIndex) => {
                  const startMs = colIndex * GRID_MS;
                  const note = beep.notes.find(n => n.startMs === startMs);
                  const isActive = note && Math.abs(note.freq - s.freq) < 1;
                  const isOtherActive = note && !isActive;

                  return (
                    <div 
                      key={`${rowIndex}-${colIndex}`}
                      className={`border-r border-b border-gray-900/30 transition-colors relative ${s.name.includes('#') ? 'bg-gray-900/20' : ''} ${colIndex % 4 === 0 ? 'border-l-[1.5px] border-l-gray-800/50' : ''}`}
                      onMouseDown={() => handleMouseDown(colIndex, s.freq, !!isActive)}
                      onMouseEnter={() => handleMouseEnter(colIndex, s.freq)}
                    >
                      {isActive && <div className="absolute inset-0 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)] z-10 rounded-sm border border-blue-400/50" />}
                      {isOtherActive && <div className="absolute inset-0 bg-gray-800/30" />}
                    </div>
                  );
                })
              ))}
              
              {isPlaying && (
                <div className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 shadow-[0_0_10px_#facc15] z-30 pointer-events-none" style={{ left: `${(currentTime / GRID_MS) * 40}px` }} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-gray-500 font-mono text-[10px] uppercase tracking-wider">
          <div className="flex space-x-8">
            <div className="flex items-center space-x-2"><div className="w-2 h-2 bg-blue-500 rounded-sm" /><span>Note</span></div>
            <div className="flex items-center space-x-2"><div className="w-2 h-2 bg-gray-800 rounded-sm" /><span>Empty</span></div>
          </div>
          <div>1 Grid = {GRID_MS}ms (1/16s)</div>
      </div>
    </div>
  );
};

export default PianoRoll;
