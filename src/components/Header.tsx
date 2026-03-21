import React from 'react';

const Header: React.FC<{ 
  projectName: string; 
  setProjectName: (name: string) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ projectName, setProjectName, onExport, onImport }) => (
  <header className="h-16 px-6 border-b border-gray-800 bg-gray-950 flex items-center justify-between shrink-0 shadow-lg relative z-10">
    <div className="flex items-center space-x-6">
      <div className="flex flex-col">
        <div className="text-xl font-black text-blue-500 tracking-tighter hover:text-blue-400 transition-colors cursor-default leading-none">
          BEEP DESIGNER
        </div>
        <div className="text-[10px] text-gray-500 font-mono tracking-widest mt-1">SOUND TOOL</div>
      </div>
      <div className="h-8 w-px bg-gray-800 mx-2" />
      <input 
        type="text" 
        value={projectName} 
        onChange={e => setProjectName(e.target.value)}
        className="bg-gray-800/30 border-0 outline-none hover:bg-gray-800/50 focus:bg-gray-800/70 transition-all px-4 py-2 rounded-md text-sm text-gray-200 border border-transparent focus:border-blue-500/30 w-64"
        title="Project Name"
      />
    </div>
    <div className="flex items-center space-x-3">
      <label className="text-[11px] bg-gray-900 hover:bg-gray-800 transition-all font-mono py-2 px-4 rounded-md cursor-pointer border border-gray-800 hover:border-gray-600 text-gray-400">
        IMPORT JSON
        <input type="file" accept=".json" onChange={onImport} className="hidden" />
      </label>
      <button 
        onClick={onExport}
        className="text-[11px] bg-blue-600 hover:bg-blue-500 transition-all font-mono py-2 px-4 rounded-md border border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] text-white font-bold"
      >
        EXPORT PROJECT
      </button>
    </div>
  </header>
);

export default Header;
