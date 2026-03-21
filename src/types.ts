export interface Note {
  freq: number;
  durationMs: number;
  startMs: number;
}

export interface Beep {
  id: string;
  name: string;
  durationSec: number;
  notes: Note[];
}

export interface Project {
  projectName: string;
  version: string;
  beeps: Beep[];
}

// grid unit (16th note equivalent)
export const GRID_MS = 62.5;

// Base frequency (C4, but mapped to musical C8 standard)
export const BASE_FREQ = 4186;

// Note Names
export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * Calculate frequency for a given note index away from C4 (0)
 */
export const calculateFreq = (index: number): number => {
  return Math.round(BASE_FREQ * Math.pow(Math.pow(2, 1 / 12), index));
};

export interface NoteEntry {
  name: string;
  octave: number;
  freq: number;
  index: number; // index relative to C4
}

export const getScale = (): NoteEntry[] => {
  const scale: NoteEntry[] = [];
  // F8 (octave 8, index 5) to F0 (octave 0, index 5)
  // C4 is 0. F8 is 48 + 5 = 53. F0 is -48 + 5 = -43.
  for (let i = 53; i >= -43; i--) {
    const octave = 4 + Math.floor(i / 12);
    const nameIndex = ((i % 12) + 12) % 12;
    scale.push({
      name: NOTE_NAMES[nameIndex],
      octave,
      freq: calculateFreq(i),
      index: i,
    });
  }
  return scale;
};
