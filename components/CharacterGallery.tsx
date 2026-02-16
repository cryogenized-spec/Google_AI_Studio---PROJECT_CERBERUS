
import React, { useState } from 'react';
import { CharacterProfile } from '../types';
import { Users, Plus, Copy, Clock, Edit2, Play, Info } from 'lucide-react';

interface CharacterGalleryProps {
    isOpen: boolean;
    onClose: () => void;
    templates: CharacterProfile[];
    userCharacters: CharacterProfile[];
    activeCharacterId: string;
    onSelectCharacter: (id: string) => void;
    onUseTemplate: (template: CharacterProfile) => void;
}

interface CharacterCardProps {
    char: CharacterProfile;
    isTemplate: boolean;
    activeCharacterId: string;
    onSelectCharacter: (id: string) => void;
    onUseTemplate: (template: CharacterProfile) => void;
    onClose: () => void;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ 
    char, 
    isTemplate, 
    activeCharacterId, 
    onSelectCharacter, 
    onUseTemplate, 
    onClose 
}) => (
    <div className={`
        relative shrink-0 w-64 h-96 rounded-xl overflow-hidden border transition-all duration-300 group
        ${activeCharacterId === char.id ? 'border-cerberus-accent shadow-[0_0_30px_rgba(212,175,55,0.2)] scale-105' : 'border-cerberus-800 hover:border-cerberus-600'}
    `}>
        {/* Background Image */}
        <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: `url(${char.portraitUrl})` }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-5">
            {activeCharacterId === char.id && !isTemplate && (
                <div className="absolute top-4 right-4 bg-cerberus-accent text-black text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest flex items-center gap-1 shadow-lg">
                    <Play size={10} fill="currentColor"/> Active
                </div>
            )}
            
            <h3 className={`text-xl font-serif font-bold text-white mb-1 ${isTemplate ? 'italic' : ''}`}>{char.name}</h3>
            <p className="text-xs text-gray-300 font-mono mb-4 line-clamp-2">{char.tagline}</p>

            {/* Metadata */}
            {!isTemplate && (
                <div className="flex items-center gap-3 text-[9px] text-gray-500 uppercase tracking-widest mb-4">
                    <span className="flex items-center gap-1"><Clock size={10}/> {new Date(char.lastUsedAt).toLocaleDateString()}</span>
                    <span className="bg-gray-800 px-1.5 py-0.5 rounded">v{char.versionNumber}</span>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
                {isTemplate ? (
                    <button 
                        onClick={() => onUseTemplate(char)}
                        className="flex-1 bg-cerberus-600 hover:bg-cerberus-500 text-white py-2 rounded text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors shadow-lg"
                    >
                        <Copy size={14} /> Use Template
                    </button>
                ) : (
                    <button 
                        onClick={() => { onSelectCharacter(char.id); onClose(); }}
                        className={`flex-1 py-2 rounded text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeCharacterId === char.id ? 'bg-cerberus-accent text-black' : 'bg-gray-800 text-gray-200 hover:bg-gray-700'}`}
                    >
                        {activeCharacterId === char.id ? 'Selected' : 'Select'}
                    </button>
                )}
            </div>
        </div>
    </div>
);

const CharacterGallery: React.FC<CharacterGalleryProps> = ({
    isOpen, onClose, templates, userCharacters, activeCharacterId, onSelectCharacter, onUseTemplate
}) => {
    const [activeTab, setActiveTab] = useState<'my_chars' | 'templates'>('my_chars');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl flex flex-col animate-fadeIn">
            
            {/* Header */}
            <div className="p-6 border-b border-cerberus-800 flex justify-between items-center bg-cerberus-900/50">
                <div className="flex items-center gap-4">
                    <Users size={24} className="text-cerberus-accent"/>
                    <h1 className="text-2xl font-serif text-white tracking-widest">PERSONA GALLERY</h1>
                </div>
                <div className="flex bg-black/50 rounded-lg p-1 border border-cerberus-800">
                    <button 
                        onClick={() => setActiveTab('my_chars')}
                        className={`px-4 py-2 rounded text-xs uppercase font-bold tracking-widest transition-all ${activeTab === 'my_chars' ? 'bg-cerberus-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        My Characters
                    </button>
                    <button 
                        onClick={() => setActiveTab('templates')}
                        className={`px-4 py-2 rounded text-xs uppercase font-bold tracking-widest transition-all ${activeTab === 'templates' ? 'bg-cerberus-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Templates
                    </button>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-cerberus-800 rounded-full text-gray-500 hover:text-white transition-colors">
                    <span className="sr-only">Close</span>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
            </div>

            {/* Gallery Area */}
            <div className="flex-1 overflow-y-hidden overflow-x-auto p-8 flex items-center gap-8 custom-scrollbar relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cerberus-900/20 via-black to-black pointer-events-none -z-10" />
                
                {activeTab === 'my_chars' && (
                    <>
                        {userCharacters.map(char => (
                            <CharacterCard 
                                key={char.id} 
                                char={char} 
                                isTemplate={false} 
                                activeCharacterId={activeCharacterId}
                                onSelectCharacter={onSelectCharacter}
                                onUseTemplate={onUseTemplate}
                                onClose={onClose}
                            />
                        ))}
                        {userCharacters.length === 0 && (
                            <div className="text-center w-full opacity-50 flex flex-col items-center">
                                <Info size={48} className="mb-4 text-cerberus-800"/>
                                <p className="font-serif text-xl">The Void is empty.</p>
                                <p className="text-sm font-mono mt-2">Select a template to begin.</p>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'templates' && (
                    <>
                        {templates.map(tpl => (
                            <CharacterCard 
                                key={tpl.id} 
                                char={tpl} 
                                isTemplate={true} 
                                activeCharacterId={activeCharacterId}
                                onSelectCharacter={onSelectCharacter}
                                onUseTemplate={onUseTemplate}
                                onClose={onClose}
                            />
                        ))}
                    </>
                )}
            </div>

            {/* Footer / Hint */}
            <div className="p-4 border-t border-cerberus-800 bg-cerberus-900/50 text-center text-[10px] text-gray-500 font-mono uppercase tracking-widest">
                {activeTab === 'my_chars' ? "Select a persona to instantiate the connection." : "Templates are immutable patterns. Use one to create a unique instance."}
            </div>
        </div>
    );
};

export default CharacterGallery;
