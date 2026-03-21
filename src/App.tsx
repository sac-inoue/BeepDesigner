import React, { useState, useEffect, useCallback } from 'react';
import type { Project, Beep } from './types';
import PianoRoll from './components/PianoRoll';
import CodeReview from './components/CodeReview';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

const STORAGE_KEY = 'ESP32_BEEP_PROJECT';

const App: React.FC = () => {
  const [project, setProject] = useState<Project>(() => {
    const saved = localStorage.getItem('beep_project');
    return saved ? JSON.parse(saved) : { projectName: 'My Beep Project', version: '1.0', beeps: [{ id: 'default', name: 'startup_sound', durationSec: 1, notes: [] }] };
  });

  const [currentBeepId, setCurrentBeepId] = useState<string>(project.beeps[0].id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBottomPaneOpen, setIsBottomPaneOpen] = useState(false);

  const saveToLocalStorage = useCallback((p: Project) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }, []);

  useEffect(() => {
    saveToLocalStorage(project);
    if (!currentBeepId && project.beeps.length > 0) {
      setCurrentBeepId(project.beeps[0].id);
    }
  }, [project, currentBeepId, saveToLocalStorage]);

  const currentBeep = project.beeps.find(b => b.id === currentBeepId);

  const updateBeep = (updatedBeep: Beep) => {
    setProject(prev => ({
      ...prev,
      beeps: prev.beeps.map(b => b.id === updatedBeep.id ? updatedBeep : b)
    }));
  };

  const addBeep = () => {
    const newBeep: Beep = {
      id: crypto.randomUUID(),
      name: `new_sound_${project.beeps.length + 1}`,
      durationSec: 1,
      notes: []
    };
    setProject(prev => ({
      ...prev,
      beeps: [...prev.beeps, newBeep]
    }));
    setCurrentBeepId(newBeep.id);
  };

  const duplicateBeep = (id: string) => {
    const original = project.beeps.find(b => b.id === id);
    if (!original) return;
    const copy: Beep = {
      ...JSON.parse(JSON.stringify(original)), 
      id: crypto.randomUUID(),
      name: `${original.name}_copy`
    };
    setProject(prev => ({
      ...prev,
      beeps: [...prev.beeps, copy]
    }));
    setCurrentBeepId(copy.id);
  };

  const deleteBeep = (id: string) => {
    if (project.beeps.length <= 1) return;
    setProject(prev => ({
      ...prev,
      beeps: prev.beeps.filter(b => b.id !== id)
    }));
    if (currentBeepId === id) {
      setCurrentBeepId(project.beeps[0].id);
    }
  };

  const updateBeepName = (id: string, name: string) => {
    setProject(prev => ({
      ...prev,
      beeps: prev.beeps.map(b => b.id === id ? { ...b, name: name.replace(/[^a-zA-Z0-9_]/g, '') } : b)
    }));
  };

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const timestamp = now.getFullYear().toString() + 
                      (now.getMonth() + 1).toString().padStart(2, '0') + 
                      now.getDate().toString().padStart(2, '0') + "_" + 
                      now.getHours().toString().padStart(2, '0') + 
                      now.getMinutes().toString().padStart(2, '0') + 
                      now.getSeconds().toString().padStart(2, '0');
    
    const fileName = `${project.projectName}_${timestamp}.json`.replace(/\s+/g, '_');
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  };

  const importProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string);
        setProject(imported);
        if (imported.beeps.length > 0) {
          setCurrentBeepId(imported.beeps[0].id);
        }
      } catch (err) {
        alert("Invalid project file");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-950 text-gray-100">
      <Header 
        projectName={project.projectName} 
        setProjectName={(name) => setProject(p => ({...p, projectName: name}))}
        onExport={exportProject}
        onImport={importProject}
      />
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar - Persistent on desktop, Slide-over on mobile? 
            Let's keep it simple: Hidden on mobile unless we add a toggle.
            Actually, let's make it a drawer-like behavior or just a bottom stack? 
            Specification: 'モバイル対応'. 
            I'll add a state to toggle it on mobile.
        */}
        <div className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 transition-transform duration-300 w-64 lg:w-64 bg-gray-950 border-r border-gray-800 shrink-0`}>
          <Sidebar 
            beeps={project.beeps}
            currentBeepId={currentBeepId}
            onSelectBeep={(id) => { setCurrentBeepId(id); setIsSidebarOpen(false); }}
            onAddBeep={addBeep}
            onDuplicateBeep={duplicateBeep}
            onUpdateName={updateBeepName}
            onDeleteBeep={deleteBeep}
          />
        </div>

        {/* Sidebar Overlay for mobile */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Area: PianoRoll (Top) + Code/WAV (Bottom) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-900 shadow-inner w-full min-w-0">
          <main className="flex-1 relative overflow-hidden flex flex-col">
            {currentBeep ? (
              <div className="flex-1 flex flex-col relative overflow-hidden">
                <PianoRoll 
                  beep={currentBeep}
                  onUpdate={updateBeep}
                  onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                />

                {/* Bottom Toggle Tab */}
                <button 
                  onClick={() => setIsBottomPaneOpen(!isBottomPaneOpen)}
                  className={`absolute bottom-0 left-1/2 -translate-x-1/2 z-30 px-6 py-1.5 rounded-t-xl text-[10px] font-black tracking-widest transition-all border-x border-t ${
                    isBottomPaneOpen 
                      ? 'bg-blue-600 text-white border-blue-500 shadow-[0_-4px_20px_rgba(37,99,235,0.3)]' 
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {isBottomPaneOpen ? 'CLOSE EXPORT' : 'SHOW EXPORT & CODE'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 font-bold uppercase tracking-widest p-8 text-center">
                <button onClick={addBeep} className="mb-4 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-all">Start New Pattern</button>
                Please Add a Beep Pattern
              </div>
            )}
          </main>

          {/* Bottom Pane - Code & WAV */}
          {currentBeep && isBottomPaneOpen && (
            <aside className="h-auto lg:h-64 border-t border-gray-800 bg-gray-950 flex flex-col lg:flex-row p-3 lg:p-4 gap-3 lg:gap-4 overflow-y-auto lg:overflow-hidden shrink-0">
              <CodeReview beep={currentBeep} />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
