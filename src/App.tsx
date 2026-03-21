import React, { useState, useEffect, useCallback } from 'react';
import { getScale, GRID_MS } from './types';
import type { Project, Beep, Note } from './types';
import PianoRoll from './components/PianoRoll';
import CodeReview from './components/CodeReview';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

const STORAGE_KEY = 'ESP32_BEEP_PROJECT';

const App: React.FC = () => {
  const [project, setProject] = useState<Project>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {
      projectName: "My Beep Project",
      version: "1.0",
      beeps: [{
        id: crypto.randomUUID(),
        name: "startup_sound",
        durationSec: 1,
        notes: []
      }]
    };
  });

  const [currentBeepId, setCurrentBeepId] = useState<string>(project.beeps[0]?.id || '');

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
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.projectName}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar 
          beeps={project.beeps}
          currentBeepId={currentBeepId}
          onSelectBeep={setCurrentBeepId}
          onAddBeep={addBeep}
          onDuplicateBeep={duplicateBeep}
          onUpdateName={updateBeepName}
          onDeleteBeep={deleteBeep}
        />

        {/* Main Area: PianoRoll (Top) + Code/WAV (Bottom) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-900 shadow-inner">
          <main className="flex-1 relative overflow-hidden">
            {currentBeep ? (
              <PianoRoll 
                beep={currentBeep}
                onUpdate={updateBeep}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 font-bold uppercase tracking-widest">
                Please Add a Beep Pattern
              </div>
            )}
          </main>

          {/* Bottom Pane - Code & WAV */}
          {currentBeep && (
            <aside className="h-64 border-t border-gray-800 bg-gray-950 flex flex-row p-4 space-x-4 overflow-hidden shrink-0">
              <CodeReview beep={currentBeep} />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
