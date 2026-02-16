
import React from 'react';
import { Plus, Trash2, Settings, MessageSquare, Menu, X, Download, Radio, ScrollText, Skull, Layers, Users } from 'lucide-react';
import { Thread, ThreadType } from '../types';

interface SidebarProps {
  threads: Thread[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onCreateThread: () => void;
  onDeleteThread: (id: string) => void;
  onOpenSettings: () => void;
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
  onOpenScriptorium: () => void;
  onOpenDungeon: () => void;
  onOpenTower: () => void;
  onOpenCharacters: () => void; // New prop
}

const Sidebar: React.FC<SidebarProps> = ({
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  onOpenSettings,
  isOpen,
  onClose,
  onExport,
  onOpenScriptorium,
  onOpenDungeon,
  onOpenTower,
  onOpenCharacters
}) => {
  const staticThreads = threads.filter(t => t.type === 'static');
  const ritualThreads = threads.filter(t => t.type === 'ritual' || !t.type); // Fallback for old data

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-72 bg-cerberus-900 border-r border-cerberus-800 transform transition-transform duration-300 ease-in-out flex flex-col
        md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-cerberus-700 flex justify-between items-center">
          <h1 className="text-xl font-serif text-cerberus-accent font-bold tracking-widest">CERBERUS</h1>
          <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Static Connection Section */}
        <div className="p-4 border-b border-cerberus-800 bg-cerberus-900/50 space-y-2">
            <h3 className="text-[10px] text-cerberus-accent/70 uppercase tracking-widest mb-2 font-bold">Static Link</h3>
            {staticThreads.map(thread => (
                 <div
                    key={thread.id}
                    className={`
                    group flex items-center gap-3 p-3 rounded-md cursor-pointer transition-all duration-200
                    ${activeThreadId === thread.id 
                        ? 'bg-cerberus-800/80 text-cerberus-accent border-l-2 border-cerberus-accent' 
                        : 'text-gray-400 hover:bg-cerberus-800/50 hover:text-gray-200 border-l-2 border-transparent'}
                    `}
                    onClick={() => { onSelectThread(thread.id); if(window.innerWidth < 768) onClose(); }}
                >
                    <Radio size={16} className="shrink-0 text-red-500 animate-pulse" />
                    <span className="truncate text-sm font-medium flex-1">The Connection</span>
                </div>
            ))}
            
            {/* Ebon Scriptorium Entry */}
            <div
                className="group flex items-center gap-3 p-3 rounded-md cursor-pointer transition-all duration-200 text-gray-400 hover:bg-cerberus-800/50 hover:text-white border-l-2 border-transparent hover:border-cerberus-accent"
                onClick={() => { onOpenScriptorium(); if(window.innerWidth < 768) onClose(); }}
            >
                <ScrollText size={16} className="shrink-0 text-cerberus-500" />
                <span className="truncate text-sm font-medium flex-1 font-serif">The Scriptorium</span>
            </div>

            {/* The Gauntlet (Dungeon) Entry */}
            <div
                className="group flex items-center gap-3 p-3 rounded-md cursor-pointer transition-all duration-200 text-gray-400 hover:bg-cerberus-800/50 hover:text-white border-l-2 border-transparent hover:border-red-900"
                onClick={() => { onOpenDungeon(); if(window.innerWidth < 768) onClose(); }}
            >
                <Skull size={16} className="shrink-0 text-gray-500 group-hover:text-red-500 transition-colors" />
                <span className="truncate text-sm font-medium flex-1 font-serif">The Gauntlet</span>
            </div>

            {/* The Tower of Mirrors Entry */}
            <div
                className="group flex items-center gap-3 p-3 rounded-md cursor-pointer transition-all duration-200 text-gray-400 hover:bg-cerberus-800/50 hover:text-white border-l-2 border-transparent hover:border-indigo-500"
                onClick={() => { onOpenTower(); if(window.innerWidth < 768) onClose(); }}
            >
                <Layers size={16} className="shrink-0 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                <span className="truncate text-sm font-medium flex-1 font-serif">Tower of Mirrors</span>
            </div>
        </div>

        <div className="p-4">
          <button
            onClick={() => { onCreateThread(); if(window.innerWidth < 768) onClose(); }}
            className="w-full flex items-center justify-center gap-2 bg-cerberus-600 hover:bg-cerberus-500 text-white py-3 px-4 rounded-sm transition-colors duration-200 shadow-lg shadow-cerberus-900/50 font-serif"
          >
            <Plus size={16} />
            <span>New Ritual</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
          <h3 className="px-2 text-[10px] text-gray-600 uppercase tracking-widest mb-1 mt-2 font-bold">Rituals</h3>
          {ritualThreads.map((thread) => (
            <div
              key={thread.id}
              className={`
                group flex items-center gap-3 p-3 rounded-md cursor-pointer transition-all duration-200
                ${activeThreadId === thread.id 
                  ? 'bg-cerberus-800/80 text-cerberus-accent border-l-2 border-cerberus-accent' 
                  : 'text-gray-400 hover:bg-cerberus-800/50 hover:text-gray-200 border-l-2 border-transparent'}
              `}
              onClick={() => { onSelectThread(thread.id); if(window.innerWidth < 768) onClose(); }}
            >
              <MessageSquare size={16} className="shrink-0 opacity-70" />
              <span className="truncate text-sm font-medium flex-1">{thread.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteThread(thread.id); }}
                className="opacity-0 group-hover:opacity-100 text-cerberus-600 hover:text-red-400 transition-opacity"
                title="Delete Thread"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {ritualThreads.length === 0 && (
            <div className="text-center text-gray-600 mt-10 text-sm italic">
              No active rituals found.
            </div>
          )}
        </div>

        <div className="p-4 border-t border-cerberus-800 bg-cerberus-900/50 space-y-2">
          {/* CHARACTERS ENTRY */}
          <button
            onClick={() => { onOpenCharacters(); if(window.innerWidth < 768) onClose(); }}
            className="w-full flex items-center gap-3 p-2 text-gray-400 hover:text-white hover:bg-cerberus-800 rounded transition-colors text-sm mb-2 group"
          >
            <Users size={18} className="group-hover:text-cerberus-accent transition-colors" />
            <span className="uppercase tracking-widest text-xs font-bold">Characters</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 p-2 text-gray-400 hover:text-cerberus-accent hover:bg-cerberus-800 rounded transition-colors text-sm"
          >
            <Settings size={18} />
            <span>Configuration</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
