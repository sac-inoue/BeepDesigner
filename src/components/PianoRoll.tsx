import React, { useRef, useEffect, useState, useMemo } from 'react';
import { GRID_MS, getScale } from '../types';
import type { Beep, Note, NoteEntry } from '../types';

interface PianoRollProps {
  beep: Beep;
  onUpdate: (updatedBeep: Beep) => void;
  onToggleSidebar?: () => void;
}

const PianoRoll: React.FC<PianoRollProps> = ({ beep, onUpdate, onToggleSidebar }) => {
  const scale = useMemo(() => getScale(), []);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null);

  const totalCells = (beep.durationSec * 1000) / GRID_MS;

  // Initialize Audio
  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const playNote = (freq: number, duration: number = 0.1) => {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  const toggleNote = (cellIndex: number, freq: number) => {
    const startMs = cellIndex * GRID_MS;
    const existingNoteIndex = beep.notes.findIndex(n => n.startMs === startMs);
    
    const newNotes = [...beep.notes];
    
    if (existingNoteIndex >= 0) {
      if (newNotes[existingNoteIndex].freq === freq) {
        // Same note, remove it
        newNotes.splice(existingNoteIndex, 1);
      } else {
        // Different freq, update
        newNotes[existingNoteIndex] = { freq, durationMs: GRID_MS, startMs };
        playNote(freq);
      }
    } else {
      // Add new
      newNotes.push({ freq, durationMs: GRID_MS, startMs });
      playNote(freq);
    }

    onUpdate({ ...beep, notes: newNotes });
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
      // Remove any note at this time slot (single note constraint)
      newNotes = newNotes.filter(n => n.startMs !== startMs);
      newNotes.push({ freq, durationMs: GRID_MS, startMs });
      playNote(freq, 0.05); // Short feedback
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
    
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    
    setIsPlaying(true);
    startTimeRef.current = ctx.currentTime;
    
    // Merge notes for legato playback
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
      osc.frequency.setValueAtTime(note.freq, ctx.currentTime + note.startMs / 1000);
      
      // Short attack/release to prevent clicks
      const attack = 0.001; 
      const release = 0.001;
      
      gain.gain.setValueAtTime(0, ctx.currentTime + note.startMs / 1000);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + note.startMs / 1000 + attack);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + (note.startMs + note.durationMs) / 1000 - release);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + (note.startMs + note.durationMs) / 1000);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + note.startMs / 1000);
      osc.stop(ctx.currentTime + (note.startMs + note.durationMs) / 1000);
    });

    const updateProgress = () => {
      const elapsed = (ctx.currentTime - startTimeRef.current) * 1000;
      if (elapsed >= beep.durationSec * 1000) {
        setIsPlaying(false);
        setCurrentTime(0);
        return;
      }
      setCurrentTime(elapsed);
      animationRef.current = requestAnimationFrame(updateProgress);
    };
    animationRef.current = requestAnimationFrame(updateProgress);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    // Web Audio API stop is tricky without node references, but since it's short, it's ok for now. 
    // Usually you'd keep track of nodes to stop them.
    // Let's do a simple hack to stop sound by closing context if needed or just letting it finish.
    // For a real app, I'd track all active oscillators.
    if (audioCtxRef.current) {
        audioCtxRef.current.close().then(() => {
            audioCtxRef.current = null;
        });
    }
  };

  useEffect(() => {
    // Scroll to the first note, or C4 if empty
    if (containerRef.current) {
      let targetIndex = 0; // Relative to C4 (index 0)
      
      if (beep.notes.length > 0) {
        // Find first note
        const firstNote = [...beep.notes].sort((a,b) => a.startMs - b.startMs)[0];
        const noteEntry = scale.find(s => Math.abs(s.freq - firstNote.freq) < 1);
        if (noteEntry) {
          targetIndex = noteEntry.index;
        }
      }

      const visualIndex = scale.findIndex(s => s.index === targetIndex);
      if (visualIndex >= 0) {
        const rowHeight = 24;
        const scrollOffset = (visualIndex * rowHeight) - (containerRef.current.clientHeight / 2) + (rowHeight / 2);
        containerRef.current.scrollTop = scrollOffset;
      }
    }
  }, [beep.id, scale]);

  return (
    <div className="p-8 h-full flex flex-col">
      {/* Controls Bar */}
      <div className="mb-4 lg:mb-6 flex flex-wrap items-center gap-3 lg:gap-6 shrink-0">
        {onToggleSidebar && (
          <button 
            onClick={onToggleSidebar}
            className="lg:hidden p-2 text-gray-400 hover:text-white bg-gray-800 rounded-lg"
            title="Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        )}

        <div className="flex flex-col space-y-1">
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest pl-1">Sound Name</span>
          <input 
            type="text"
            value={beep.name}
            onChange={e => onUpdate({...beep, name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '')})}
            className="bg-gray-950 border border-gray-800 focus:border-blue-500/50 outline-none rounded-lg px-3 py-2 text-sm text-blue-400 font-mono w-32 lg:w-48 transition-all"
            placeholder="Pattern Name"
          />
        </div>

        <div className="hidden lg:block h-10 w-px bg-gray-800 mx-2" />

        <div className="flex flex-col space-y-1">
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest pl-1">Pitch Shift</span>
          <div className="flex space-x-1 lg:space-x-2">
            <button 
                onClick={() => {
                  const newNotes = beep.notes.map(n => ({ ...n, freq: n.freq * 2 }));
                  onUpdate({ ...beep, notes: newNotes });
                }}
                className="text-[10px] bg-gray-800 hover:bg-gray-700 transition-all font-mono py-1.5 lg:py-2 px-2 lg:px-3 rounded-lg border border-gray-700 text-gray-400 hover:text-white"
                title="Octave Up"
            >
                OCT+
            </button>
            <button 
                onClick={() => {
                  const newNotes = beep.notes.map(n => ({ ...n, freq: n.freq / 2 }));
                  onUpdate({ ...beep, notes: newNotes });
                }}
                className="text-[10px] bg-gray-800 hover:bg-gray-700 transition-all font-mono py-1.5 lg:py-2 px-2 lg:px-3 rounded-lg border border-gray-700 text-gray-400 hover:text-white"
                title="Octave Down"
            >
                OCT-
            </button>
            <div className="w-px h-6 bg-gray-800 self-center mx-1" />
            <button 
                onClick={() => {
                  const ratio = Math.pow(2, 1/12);
                  const newNotes = beep.notes.map(n => ({ ...n, freq: Math.round(n.freq * ratio) }));
                  onUpdate({ ...beep, notes: newNotes });
                }}
                className="text-[10px] bg-gray-800 hover:bg-gray-700 transition-all font-mono py-1.5 lg:py-2 px-2 lg:px-3 rounded-lg border border-gray-700 text-gray-400 hover:text-white"
                title="Note Up (+1 Semitone)"
            >
                NOTE+
            </button>
            <button 
                onClick={() => {
                  const ratio = Math.pow(2, 1/12);
                  const newNotes = beep.notes.map(n => ({ ...n, freq: Math.round(n.freq / ratio) }));
                  onUpdate({ ...beep, notes: newNotes });
                }}
                className="text-[10px] bg-gray-800 hover:bg-gray-700 transition-all font-mono py-1.5 lg:py-2 px-2 lg:px-3 rounded-lg border border-gray-700 text-gray-400 hover:text-white"
                title="Note Down (-1 Semitone)"
            >
                NOTE-
            </button>
          </div>
        </div>

        <div className="h-10 w-px bg-gray-800 mx-2" />

        <button 
          onClick={startPlayback}
          className={`flex items-center space-x-2 px-6 py-2 rounded-full font-black tracking-widest transition-all ${
            isPlaying ? 'bg-red-500 hover:bg-red-400' : 'bg-green-600 hover:bg-green-500'
          } text-white shadow-lg`}
        >
          {isPlaying ? (
            <><div className="w-3 h-3 bg-white" /> <span>STOP</span></>
          ) : (
            <><div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[10px] border-l-white" /> <span>PLAY</span></>
          )}
        </button>

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

        <button 
          onClick={() => onUpdate({...beep, notes: []})}
          className="text-[10px] text-gray-500 hover:text-red-400 transition-colors uppercase font-bold tracking-widest border border-gray-800 hover:border-red-500/20 px-4 py-2 rounded-lg"
        >
          Clear All
        </button>
      </div>

      <div className="relative border border-gray-800 rounded-xl overflow-hidden shadow-2xl bg-gray-950 select-none flex-1">
        
        {/* Scrollable Container */}
        <div className="absolute inset-0 overflow-auto scroll-smooth custom-scrollbar" ref={containerRef}>
          <div 
            className="relative"
            style={{ 
              width: `${totalCells * 40 + 80}px`, // 40px per cell, 80px for headers
              height: `${scale.length * 24}px`
            }}
          >
            {/* Headers (Y-Axis) */}
            <div className="sticky left-0 top-0 z-20 w-20 bg-gray-950/95 border-r border-gray-800 h-full flex flex-col backdrop-blur-sm">
              {scale.map((s, i) => (
                <div 
                  key={s.index} 
                  className={`h-[24px] flex items-center px-3 text-[9px] font-mono border-b border-gray-900/50 ${
                    s.name.includes('#') ? 'bg-gray-900/40 text-gray-600' : 'text-gray-400'
                  }`}
                  title={`${s.freq} Hz`}
                >
                  {s.name}{s.octave}
                </div>
              ))}
            </div>

            {/* Grid Area */}
            <div 
              className="absolute left-20 top-0 h-full"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${totalCells}, 40px)`,
                gridTemplateRows: `repeat(${scale.length}, 24px)`
              }}
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
                      className={`border-r border-b border-gray-900/30 transition-colors relative ${
                        s.name.includes('#') ? 'bg-gray-900/20' : ''
                      } ${colIndex % 4 === 0 ? 'border-l-[1.5px] border-l-gray-800/50' : ''}`}
                      onMouseDown={() => handleMouseDown(colIndex, s.freq, !!isActive)}
                      onMouseEnter={() => handleMouseEnter(colIndex, s.freq)}
                    >
                      {isActive && (
                        <div className="absolute inset-0 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)] z-10 rounded-sm border border-blue-400/50" />
                      )}
                      {isOtherActive && (
                        <div className="absolute inset-0 bg-gray-800/30" />
                      )}
                    </div>
                  );
                })
              ))}
              
              {/* Playback Cursor */}
              {isPlaying && (
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 shadow-[0_0_10px_#facc15] z-30 transition-none pointer-events-none"
                  style={{ left: `${(currentTime / GRID_MS) * 40}px` }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-gray-500 font-mono text-[10px] uppercase tracking-wider">
          <div className="flex space-x-8">
            <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-sm" />
                <span>Note</span>
            </div>
            <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-800 rounded-sm" />
                <span>Empty (Rest)</span>
            </div>
          </div>
          <div>
            1 Grid = {GRID_MS}ms (1/16s)
          </div>
      </div>
    </div>
  );
};

export default PianoRoll;
