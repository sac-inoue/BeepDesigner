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
  onReorderBeeps: (startIndex: number, endIndex: number) => void;
}> = ({ beeps, currentBeepId, onSelectBeep, onAddBeep, onDuplicateBeep, onUpdateName, onDeleteBeep, onReorderBeeps }) => {
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  return (
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
        {beeps.map((beep, index) => (
          <div 
            key={beep.id}
            onClick={() => onSelectBeep(beep.id)}
            draggable
            onDragStart={(e) => {
              setDraggedIndex(index);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (draggedIndex !== null && draggedIndex !== index) {
                setDragOverIndex(index);
              }
            }}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverIndex(null);
              if (draggedIndex !== null && draggedIndex !== index) {
                onReorderBeeps(draggedIndex, index);
              }
            }}
            onDragEnd={() => {
              setDraggedIndex(null);
              setDragOverIndex(null);
            }}
            className={`group flex items-center justify-between p-1.5 rounded cursor-grab active:cursor-grabbing border transition-all ${
              dragOverIndex === index ? 'border-t-blue-500 border-t-2 pt-1' : ''
            } ${
              currentBeepId === beep.id 
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 font-bold' 
                : 'hover:bg-gray-800/50 border-transparent text-gray-400'
            } ${draggedIndex === index ? 'opacity-40 scale-95 grayscale' : ''}`}
          >
            <div className="flex items-center flex-1 min-w-0 mr-2">
              <div className="mr-2 text-gray-700 group-hover:text-gray-500">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M7 7h2v2H7V7zm0 4h2v2H7v-2zm0 4h2v2H7v-2zm4-8h2v2h-2V7zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z" /></svg>
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <input 
                  type="text"
                  value={beep.name}
                  onChange={(e) => onUpdateName(beep.id, e.target.value)}
                  className={`bg-transparent border-0 outline-none text-xs font-mono w-full transition-all ${
                      currentBeepId === beep.id ? 'text-blue-400 font-bold' : 'text-gray-400 pointer-events-none'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Name..."
                />
                {beep.lastUpdatedAt && (
                  <span className="text-[9px] text-gray-600 font-mono opacity-80 mt-0.5 whitespace-nowrap">
                    {new Date(beep.lastUpdatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
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
};

export default Sidebar;
