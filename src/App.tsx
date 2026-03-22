import React, { useState, useEffect } from 'react';
import type { Project, Beep } from './types';
import { get, set } from 'idb-keyval';
import PianoRoll from './components/PianoRoll';
import CodeReview from './components/CodeReview';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

const STORAGE_KEY = 'ESP32_BEEP_PROJECT';

const DEFAULT_PROJECT: Project = { 
  projectName: 'My Beep Project', 
  version: '1.0', 
  beeps: [{ id: 'default', name: 'startup_sound', durationSec: 1, notes: [], lastUpdatedAt: Date.now() }] 
};

const App: React.FC = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [project, setProject] = useState<Project>(DEFAULT_PROJECT);
  const [currentBeepId, setCurrentBeepId] = useState<string>('');
  const [workingBeep, setWorkingBeep] = useState<Beep | null>(null);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBottomPaneOpen, setIsBottomPaneOpen] = useState(false);

  useEffect(() => {
    // Migrate from LocalStorage
    const legacy1 = localStorage.getItem('ESP32_BEEP_PROJECT');
    const legacy2 = localStorage.getItem('beep_project');
    const legacyString = legacy1 || legacy2;
    
    if (legacyString) {
      try {
        const parsed = JSON.parse(legacyString);
        if (parsed && parsed.beeps && parsed.beeps.length > 0) {
          setProject(parsed);
          setCurrentBeepId(parsed.beeps[0].id);
          setWorkingBeep(JSON.parse(JSON.stringify(parsed.beeps[0])));
          setIsLoaded(true);
          localStorage.removeItem('ESP32_BEEP_PROJECT');
          localStorage.removeItem('beep_project');
          return;
        }
      } catch (e) {
        // Ignored
      }
    }

    // Load from IndexedDB
    get<Project>(STORAGE_KEY).then(saved => {
      if (saved && saved.beeps && saved.beeps.length > 0) {
        setProject(saved);
        setCurrentBeepId(saved.beeps[0].id);
        setWorkingBeep(JSON.parse(JSON.stringify(saved.beeps[0])));
      } else {
        setProject(DEFAULT_PROJECT);
        setCurrentBeepId(DEFAULT_PROJECT.beeps[0].id);
        setWorkingBeep(JSON.parse(JSON.stringify(DEFAULT_PROJECT.beeps[0])));
      }
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (isLoaded) {
      set(STORAGE_KEY, project).catch(err => console.error("IDB Save Failed", err));
    }
  }, [project, isLoaded]);

  const currentSavedBeep = project.beeps.find(b => b.id === currentBeepId);
  const isDirty = !!workingBeep && !!currentSavedBeep && JSON.stringify(workingBeep) !== JSON.stringify(currentSavedBeep);

  // Warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Lock history to prevent accidental navigation
  useEffect(() => {
    // Initial dummy state
    window.history.pushState(null, '', window.location.href);
    
    const handlePopState = () => {
      // Re-push state to stay on current page
      window.history.pushState(null, '', window.location.href);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const updateBeep = (updatedBeep: Beep) => {
    setWorkingBeep(updatedBeep);
  };

  const handleSave = () => {
    if (!workingBeep) return;
    const saveBeep = { ...workingBeep, lastUpdatedAt: Date.now() };
    setWorkingBeep(saveBeep);
    setProject(prev => ({
      ...prev,
      beeps: prev.beeps.map(b => b.id === workingBeep.id ? saveBeep : b)
    }));
  };

  const handleDiscard = () => {
    if (currentSavedBeep) {
      setWorkingBeep(JSON.parse(JSON.stringify(currentSavedBeep)));
    }
  };


  const handleSelectBeep = (id: string) => {
    if (id === currentBeepId) return;
    let nextProject = project;
    
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Save before switching?")) {
        return; // Abort switching
      }
      const savedWorking = { ...workingBeep!, lastUpdatedAt: Date.now() };
      nextProject = { ...project, beeps: project.beeps.map(b => b.id === workingBeep!.id ? savedWorking : b) };
      setProject(nextProject);
    }
    
    setCurrentBeepId(id);
    const nextSaved = nextProject.beeps.find(b => b.id === id);
    if (nextSaved) setWorkingBeep(JSON.parse(JSON.stringify(nextSaved)));
    setIsSidebarOpen(false);
  };

  const addBeep = () => {
    let nextProject = project;
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Save now?")) {
        return; // Abort adding
      }
      const savedWorking = { ...workingBeep!, lastUpdatedAt: Date.now() };
      nextProject = { ...project, beeps: project.beeps.map(b => b.id === workingBeep!.id ? savedWorking : b) };
    }

    const newBeep: Beep = {
      id: crypto.randomUUID(),
      name: `new_sound_${nextProject.beeps.length + 1}`,
      durationSec: 1,
      notes: [],
      lastUpdatedAt: Date.now()
    };
    nextProject = { ...nextProject, beeps: [...nextProject.beeps, newBeep] };
    setProject(nextProject);
    setCurrentBeepId(newBeep.id);
    setWorkingBeep(JSON.parse(JSON.stringify(newBeep)));
  };

  const duplicateBeep = (id: string) => {
    const original = project.beeps.find(b => b.id === id);
    if (!original) return;
    
    let nextProject = project;
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Save before duplicating?")) {
        return; // Abort duplicating
      }
      const savedWorking = { ...workingBeep!, lastUpdatedAt: Date.now() };
      nextProject = { ...project, beeps: project.beeps.map(b => b.id === workingBeep!.id ? savedWorking : b) };
    }

    const copy: Beep = {
      ...JSON.parse(JSON.stringify(original)), 
      id: crypto.randomUUID(),
      name: `${original.name}_copy`,
      lastUpdatedAt: Date.now()
    };
    nextProject = { ...nextProject, beeps: [...nextProject.beeps, copy] };
    setProject(nextProject);
    setCurrentBeepId(copy.id);
    setWorkingBeep(JSON.parse(JSON.stringify(copy)));
  };

  const deleteBeep = (id: string) => {
    const isDeletingCurrent = id === currentBeepId;

    if (isDeletingCurrent && isDirty) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to delete this pattern?")) return;
    }

    if (project.beeps.length <= 1) {
      if (!window.confirm("This is the last pattern. Delete and reset to a new one?")) return;
      const freshBeep: Beep = {
        id: crypto.randomUUID(),
        name: 'new_sound_1',
        durationSec: 1,
        notes: [],
        lastUpdatedAt: Date.now()
      };
      setProject(prev => ({ ...prev, beeps: [freshBeep] }));
      setCurrentBeepId(freshBeep.id);
      setWorkingBeep(JSON.parse(JSON.stringify(freshBeep)));
      return;
    }

    const nextBeeps = project.beeps.filter(b => b.id !== id);
    setProject(prev => ({
      ...prev,
      beeps: nextBeeps
    }));
    
    if (isDeletingCurrent) {
      setCurrentBeepId(nextBeeps[0].id);
      setWorkingBeep(JSON.parse(JSON.stringify(nextBeeps[0])));
    }
  };

  const updateBeepName = (id: string, name: string) => {
    setProject(prev => ({
      ...prev,
      beeps: prev.beeps.map(b => b.id === id ? { ...b, name, lastUpdatedAt: Date.now() } : b)
    }));
    if (id === currentBeepId && workingBeep) {
      setWorkingBeep(prev => prev ? { ...prev, name, lastUpdatedAt: Date.now() } : prev);
    }
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
          setWorkingBeep(JSON.parse(JSON.stringify(imported.beeps[0])));
        }
      } catch (err) {
        alert("Invalid project file");
      }
    };
    reader.readAsText(file);
  };

  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-gray-950 text-gray-500 font-bold uppercase tracking-widest space-y-4">
         <div className="w-8 h-8 rounded-full border-2 border-t-blue-500 border-gray-800 animate-spin" />
         <div>Loading Workspace...</div>
      </div>
    );
  }

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
            onSelectBeep={handleSelectBeep}
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
            {workingBeep ? (
              <div className="flex-1 flex flex-col relative overflow-hidden">
                <PianoRoll 
                  beep={workingBeep}
                  onUpdate={updateBeep}
                  onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                  onSave={handleSave}
                  onDiscard={handleDiscard}
                  isDirty={isDirty}
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
          {workingBeep && isBottomPaneOpen && (
            <aside className="h-auto lg:h-64 border-t border-gray-800 bg-gray-950 flex flex-col lg:flex-row p-3 lg:p-4 gap-3 lg:gap-4 overflow-y-auto lg:overflow-hidden shrink-0">
              <CodeReview beep={workingBeep} />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
