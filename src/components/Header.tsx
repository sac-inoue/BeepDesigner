import React from 'react';

interface HeaderProps {
  projectName: string;
  setProjectName: (name: string) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Header: React.FC<HeaderProps> = ({ projectName, setProjectName, onExport, onImport }) => (
  <header className="h-14 lg:h-16 px-3 lg:px-6 border-b border-gray-800 bg-gray-950 flex items-center shrink-0 shadow-lg relative z-20">
    <div className="flex items-center space-x-2 lg:space-x-6 min-w-0">
      <div className="flex flex-col shrink-0">
        <div className="text-sm lg:text-xl font-black text-blue-500 tracking-tighter hover:text-blue-400 transition-colors cursor-default leading-none">
          BEEP DESIGNER
        </div>
        <div className="text-[8px] lg:text-[10px] text-gray-500 font-mono tracking-widest mt-0.5 lg:mt-1">SOUND TOOL</div>
      </div>
      <div className="h-6 lg:h-8 w-px bg-gray-800 mx-1 lg:mx-2 shrink-0" />
      <input 
        type="text" 
        value={projectName} 
        onChange={(e) => setProjectName(e.target.value)}
        className="bg-transparent border-0 text-xs lg:text-sm font-bold text-gray-100 focus:outline-none w-24 lg:w-64 truncate placeholder-gray-700"
        placeholder="Project Name..."
      />
    </div>

    <div className="ml-auto flex items-center space-x-1 lg:space-x-4">
      <div className="relative group">
        <input 
          type="file" 
          onChange={onImport}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          accept=".json"
        />
        <button className="text-[10px] lg:text-xs font-bold text-gray-400 border border-gray-800 px-2 lg:px-4 py-1.5 lg:py-2 rounded-lg hover:bg-gray-800 transition-all flex items-center space-x-1 lg:space-x-2">
            <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            <span className="hidden lg:inline">IMPORT JSON</span>
            <span className="lg:hidden">IMP</span>
        </button>
      </div>
      <button 
        onClick={onExport}
        className="text-[10px] lg:text-xs font-black text-white bg-blue-600 px-3 lg:px-5 py-1.5 lg:py-2 rounded-lg hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 flex items-center space-x-1 lg:space-x-2"
      >
        <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        <span className="hidden lg:inline">EXPORT PROJECT</span>
        <span className="lg:hidden">EXP</span>
      </button>
    </div>
  </header>
);

export default Header;
