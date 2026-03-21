import React from 'react';
import type { Beep } from '../types';

const Sidebar: React.FC<{
  beeps: Beep[];
  currentBeepId: string;
  onSelectBeep: (id: string) => void;
  onAddBeep: () => void;
  onDuplicateBeep: (id: string) => void;
  onUpdateName: (id: string, name: string) => void;
  onDeleteBeep: (id: string) => void;
}> = ({ beeps, currentBeepId, onSelectBeep, onAddBeep, onDuplicateBeep, onUpdateName, onDeleteBeep }) => (
  <aside className="w-64 border-r border-gray-800 bg-gray-950 flex flex-col shrink-0">
    <div className="p-4 flex items-center justify-between border-b border-gray-800/50">
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Patterns</h2>
      <button 
        onClick={onAddBeep}
        className="text-[10px] bg-gray-800 hover:bg-gray-700 transition-all px-2 py-0.5 rounded border border-gray-700 hover:border-gray-600"
      >
        + ADD
      </button>
    </div>
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1 custom-scrollbar">
      {beeps.map(beep => (
        <div 
          key={beep.id}
          onClick={() => onSelectBeep(beep.id)}
          className={`group flex items-center justify-between p-1.5 rounded cursor-pointer transition-all border ${
            currentBeepId === beep.id 
              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 font-bold' 
              : 'hover:bg-gray-800/50 border-transparent text-gray-400'
          }`}
        >
          <input 
            type="text"
            value={beep.name}
            onChange={(e) => onUpdateName(beep.id, e.target.value)}
            className={`bg-transparent border-0 outline-none text-xs font-mono w-full mr-2 transition-all ${
                currentBeepId === beep.id ? 'text-blue-400 font-bold' : 'text-gray-400 pointer-events-none'
            }`}
            onClick={(e) => e.stopPropagation()}
            placeholder="Name..."
          />
          <div className="flex items-center space-x-1 shrink-0">
            <button 
              onClick={(e) => { e.stopPropagation(); onDuplicateBeep(beep.id); }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-all"
              title="Duplicate"
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
            </button>
            {beeps.length > 1 && (
              <button 
                onClick={(e) => { e.stopPropagation(); onDeleteBeep(beep.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-500 rounded transition-all"
                title="Delete"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  </aside>
);

export default Sidebar;
