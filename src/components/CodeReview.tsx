import React, { useState } from 'react';
import { GRID_MS } from '../types';
import type { Beep } from '../types';

interface CodeReviewProps {
  beep: Beep;
}

const CodeReview: React.FC<CodeReviewProps> = ({ beep }) => {
  const [copying, setCopying] = useState(false);

  const generateCode = () => {
    const totalCells = (beep.durationSec * 1000) / GRID_MS;
    const sequences: { freq: number; duration: number }[] = [];

    let currentFreq = -1;
    let currentDuration = 0;

    for (let i = 0; i < totalCells; i++) {
      const startMs = i * GRID_MS;
      const note = beep.notes.find(n => n.startMs === startMs);
      const freq = note ? Math.round(note.freq) : 0;

      if (i === 0) {
        currentFreq = freq;
        currentDuration = GRID_MS;
      } else if (freq === currentFreq) {
        currentDuration += GRID_MS;
      } else {
        sequences.push({ freq: currentFreq, duration: Math.round(currentDuration) });
        currentFreq = freq;
        currentDuration = GRID_MS;
      }
    }
    // Push last sequence
    if (currentDuration > 0) {
      sequences.push({ freq: currentFreq, duration: Math.round(currentDuration) });
    }

    const arrayItems = sequences.map(s => `    {${String(s.freq).padStart(4)}, ${String(s.duration).padStart(4)}}`).join(',\n');
    
    return `// Beep Design: ${beep.name}\n// Grid: ${GRID_MS}ms, Duration: ${beep.durationSec}s\n// Format: { Frequency(Hz), Duration(ms) }\nconst uint32_t beep_${beep.name.replace(/[^a-zA-Z0-9]/g, '_')}[] = {\n${arrayItems},\n    {0, 0} // End Mark\n};`;
  };

  const code = generateCode();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const downloadWav = async () => {
    const sr = 44100;
    const duration = beep.durationSec;
    const offlineCtx = new OfflineAudioContext(1, sr * duration, sr);

    // Merge notes for legato playback in WAV
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
      const osc = offlineCtx.createOscillator();
      const gain = offlineCtx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(note.freq, note.startMs / 1000);
      
      const attack = 0.001;
      const release = 0.001;

      gain.gain.setValueAtTime(0, note.startMs / 1000);
      gain.gain.linearRampToValueAtTime(0.2, note.startMs / 1000 + attack);
      gain.gain.setValueAtTime(0.2, (note.startMs + note.durationMs) / 1000 - release);
      gain.gain.linearRampToValueAtTime(0, (note.startMs + note.durationMs) / 1000);
      
      osc.connect(gain);
      gain.connect(offlineCtx.destination);
      
      osc.start(note.startMs / 1000);
      osc.stop((note.startMs + note.durationMs) / 1000);
    });

    const renderedBuffer = await offlineCtx.startRendering();
    
    // Convert to WAV Blob
    const buffer = renderedBuffer.getChannelData(0);
    const wavBlob = writeWav(buffer, sr);
    
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    
    // Format timestamp
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const safeName = (beep.name || 'Untitled').replace(/\s+/g, '_');
    
    a.download = `${safeName}_${timestamp}.wav`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
  };

  const downloadText = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Format timestamp
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const safeName = (beep.name || 'Untitled').replace(/\s+/g, '_');
    
    a.download = `beep_${safeName}_${timestamp}.cpp`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
  };

  // Minimal WAV writer
  const writeWav = (samples: Float32Array, sr: number) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 32 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM - Integer
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sr, true);
    view.setUint32(28, sr * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
    
    return new Blob([view], { type: 'audio/wav' });
  };

  return (
    <div className="flex flex-row w-full h-full space-x-6 font-mono overflow-hidden">
      <div className="flex-1 flex flex-col bg-gray-950/60 rounded-lg border border-gray-800 p-3 overflow-hidden min-w-0">
        <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">C Array Output</span>
            <div className="flex space-x-2">
              <button 
                  onClick={handleCopy}
                  className={`text-[10px] px-2 py-1 rounded transition-all ${
                      copying ? 'bg-green-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
              >
                  {copying ? 'COPIED!' : 'COPY CODE'}
              </button>
              <button 
                  onClick={downloadText}
                  className="text-[10px] px-2 py-1 rounded transition-all bg-gray-800 text-gray-400 hover:bg-blue-600 hover:text-white"
              >
                  DOWNLOAD
              </button>
            </div>
        </div>
        <pre className="text-[11px] text-blue-400 overflow-auto flex-1 leading-relaxed custom-scrollbar">
          {code}
        </pre>
      </div>

      <div className="w-[300px] p-4 bg-gray-900 rounded-xl border border-gray-800 shadow-xl space-y-3 shrink-0">
        <h3 className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-1">Export Audio</h3>
        <button 
            onClick={downloadWav}
            className="w-full bg-gray-800 hover:bg-gray-700 transition-all border border-gray-700 hover:border-blue-500/50 text-[11px] font-bold py-3 rounded-lg flex items-center justify-center space-x-2 text-gray-200"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            <span>DOWNLOAD .WAV</span>
        </button>
        <p className="text-[9px] text-gray-600 italic">
            WAV is rendered at 44.1kHz Mono Square wave.
        </p>
      </div>
    </div>
  );
};

export default CodeReview;
