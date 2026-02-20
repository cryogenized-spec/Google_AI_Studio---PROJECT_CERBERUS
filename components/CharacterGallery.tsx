
import React, { useState, useRef, useEffect } from 'react';
import { CharacterProfile, Thread, CharacterSheet } from '../types';
import { Users, Plus, Copy, Clock, Edit2, Play, Info, Trash2, BookOpen, X, List, CheckCircle, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';

interface CharacterGalleryProps {
    isOpen: boolean;
    onClose: () => void;
    templates: CharacterSheet[];
    userCharacters: CharacterProfile[];
    activeCharacterId: string;
    threads: Thread[];
    onSelectCharacter: (id: string) => void;
    onUseTemplate: (template: CharacterProfile) => void;
    onEditCharacter: (char: CharacterProfile) => void;
    onDeleteCharacter: (id: string) => void;
    onViewDetails: (char: CharacterProfile) => void;
    onDuplicateCharacter: (char: CharacterProfile) => void;
}

// --- SUB-COMPONENT: CHARACTER CARD ---

interface CharacterCardProps {
    char: CharacterProfile | CharacterSheet;
    isTemplate: boolean;
    activeCharacterId: string;
    onSelectCharacter: (id: string) => void;
    onUseTemplate: (template: CharacterProfile) => void;
    onEditCharacter: (char: CharacterProfile) => void;
    onDeleteCharacter: (id: string) => void;
    onViewDetails: (char: CharacterProfile) => void;
    onDuplicateCharacter: (char: CharacterProfile) => void;
    onClose: () => void;
    onShowToast: (msg: string) => void;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ 
    char, 
    isTemplate, 
    activeCharacterId, 
    onSelectCharacter, 
    onUseTemplate, 
    onEditCharacter,
    onDeleteCharacter,
    onViewDetails,
    onDuplicateCharacter,
    onClose,
    onShowToast
}) => {
    // Gallery State
    const defaultImg = char.gallery?.defaultPortrait || char.portraitUrl;
    const [displayImage, setDisplayImage] = useState(defaultImg);
    const bgImage = char.gallery?.backgroundImage || '';
    const thumbnails = [defaultImg, ...(char.gallery?.lifestyleImages || [])];

    const handleSelect = () => {
        onSelectCharacter(char.id);
        onClose();
    };

    const handleUse = () => {
        // Cast sheet to profile structure for usage (missing fields will be filled by factory)
        onUseTemplate(char as CharacterProfile);
        onShowToast(`Created ${char.name}`);
    };

    const asProfile = char as CharacterProfile;

    return (
        <div className={`
            relative shrink-0 w-56 h-[28rem] rounded-lg overflow-hidden border transition-all duration-300 group snap-center bg-cerberus-900 shadow-2xl
            ${activeCharacterId === char.id ? 'border-cerberus-accent shadow-[0_0_30px_rgba(212,175,55,0.2)] z-10' : 'border-cerberus-800'}
        `}>
            {/* AMBIENT BACKGROUND */}
            {bgImage && (
                <div 
                    className="absolute inset-0 bg-cover bg-center opacity-30 blur-sm scale-110" 
                    style={{ backgroundImage: `url(${bgImage})` }} 
                />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

            {/* MAIN PORTRAIT */}
            <div className="absolute inset-0 top-0 bottom-24 p-2 transition-opacity duration-500">
                <img 
                    src={displayImage} 
                    alt={char.name} 
                    className="w-full h-full object-cover rounded border border-cerberus-800/50 shadow-inner"
                />
            </div>

            {/* TOP ACTIONS */}
            <div className="absolute top-0 inset-x-0 p-3 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button onClick={() => onViewDetails(char as CharacterProfile)} className="p-1.5 bg-black/60 hover:bg-cerberus-800 rounded-full text-gray-300 hover:text-white backdrop-blur-md" title="Details">
                    <BookOpen size={14}/>
                </button>
                {!isTemplate && (
                    <>
                        <button onClick={() => onDuplicateCharacter(asProfile)} className="p-1.5 bg-black/60 hover:bg-cerberus-800 rounded-full text-gray-300 hover:text-white backdrop-blur-md" title="Duplicate">
                            <Copy size={14}/>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteCharacter(char.id); }} className="p-1.5 bg-black/60 hover:bg-red-900 rounded-full text-gray-300 hover:text-red-400 backdrop-blur-md" title="Delete">
                            <Trash2 size={14}/>
                        </button>
                    </>
                )}
            </div>

            {/* CONTENT AREA */}
            <div className="absolute inset-x-0 bottom-0 h-44 flex flex-col justify-end p-3 z-20 bg-gradient-to-t from-black via-black/90 to-transparent">
                
                {/* THUMBNAIL WHEEL */}
                <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar mb-1 mask-linear-fade">
                    {thumbnails.slice(0, 6).map((img, i) => (
                        <button 
                            key={i} 
                            onClick={() => setDisplayImage(img)}
                            className={`shrink-0 w-8 h-8 rounded-full overflow-hidden border-2 transition-all ${displayImage === img ? 'border-cerberus-accent scale-110' : 'border-gray-600 opacity-60 hover:opacity-100'}`}
                        >
                            <img src={img} className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>

                {/* INFO */}
                <h3 className={`text-lg font-serif font-bold text-white mb-0.5 leading-none ${isTemplate ? 'italic' : ''}`}>{char.name}</h3>
                <p className="text-[10px] text-gray-400 font-mono mb-3 line-clamp-1">{asProfile.tagline || char.archetype}</p>

                {/* METADATA TAGS */}
                {!isTemplate && asProfile.lastUsedAt && (
                    <div className="flex items-center gap-2 text-[8px] text-gray-500 uppercase tracking-widest mb-3">
                        <span className="flex items-center gap-1"><Clock size={8}/> {new Date(asProfile.lastUsedAt).toLocaleDateString()}</span>
                        <span className="bg-gray-800 px-1 py-px rounded text-gray-400">v{asProfile.versionNumber || 1}</span>
                    </div>
                )}

                {/* MAIN BUTTONS */}
                <div className="flex gap-2">
                    {isTemplate ? (
                        <button 
                            onClick={handleUse}
                            className="flex-1 bg-cerberus-600 hover:bg-cerberus-500 text-white py-2 rounded text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 transition-colors shadow-lg"
                        >
                            <Copy size={12} /> Instantiate
                        </button>
                    ) : (
                        <>
                            <button 
                                onClick={handleSelect}
                                className={`flex-1 py-2 rounded text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 transition-all ${activeCharacterId === char.id ? 'bg-cerberus-accent text-black' : 'bg-gray-800 text-gray-200 hover:bg-gray-700'}`}
                            >
                                {activeCharacterId === char.id ? 'Active' : 'Select'}
                            </button>
                            <button 
                                onClick={() => onEditCharacter(asProfile)}
                                className="w-8 bg-gray-900 border border-gray-700 hover:border-cerberus-500 text-gray-300 hover:text-white rounded flex items-center justify-center transition-colors"
                                title="Edit"
                            >
                                <Edit2 size={12}/>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENT: LIST DRAWER ---

const CharacterListDrawer: React.FC<{ 
    isOpen: boolean, 
    onClose: () => void, 
    characters: CharacterProfile[],
    activeCharacterId: string,
    threads: Thread[],
    onSelectCharacter: (id: string) => void
}> = ({ isOpen, onClose, characters, activeCharacterId, threads, onSelectCharacter }) => {
    const [expandedCharId, setExpandedCharId] = useState<string | null>(null);

    const getCharThreads = (charId: string) => threads.filter((t: Thread) => t.characterId === charId);

    if (!isOpen) return null;

    return (
        <div className="absolute inset-y-0 right-0 w-72 bg-black/95 border-l border-cerberus-800 z-50 flex flex-col animate-fadeIn backdrop-blur-xl">
            <div className="p-4 border-b border-cerberus-800 flex justify-between items-center bg-cerberus-900/50">
                <h3 className="text-xs font-serif font-bold text-cerberus-accent tracking-widest uppercase">Persona Index</h3>
                <button onClick={onClose}><X size={16} className="text-gray-500 hover:text-white"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {characters.map(char => {
                    const isActive = activeCharacterId === char.id;
                    const charThreads = getCharThreads(char.id);
                    const isExpanded = expandedCharId === char.id;

                    return (
                        <div key={char.id} className="border border-cerberus-900 bg-cerberus-900/30 rounded overflow-hidden">
                            <div 
                                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-cerberus-800/30 transition-colors ${isActive ? 'border-l-2 border-cerberus-accent bg-cerberus-800/20' : ''}`}
                                onClick={() => setExpandedCharId(isExpanded ? null : char.id)}
                            >
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-cerberus-800 shrink-0">
                                    <img src={char.portraitUrl} className="w-full h-full object-cover"/>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-gray-200 truncate">{char.name}</div>
                                    <div className="text-[10px] text-gray-500 truncate">{charThreads.length} Threads</div>
                                </div>
                                {isActive && <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 shadow-[0_0_5px_rgba(34,197,94,0.5)]"/>}
                                {isExpanded ? <ChevronDown size={14} className="text-gray-600"/> : <ChevronRight size={14} className="text-gray-600"/>}
                            </div>
                            
                            {/* THREADS LIST */}
                            {isExpanded && (
                                <div className="bg-black/40 border-t border-cerberus-900 p-2 space-y-1">
                                    <button 
                                        onClick={() => { onSelectCharacter(char.id); onClose(); }}
                                        className="w-full text-left p-2 text-[10px] uppercase font-bold text-cerberus-accent hover:bg-cerberus-900/50 rounded flex items-center gap-2"
                                    >
                                        <Play size={10}/> Switch To Persona
                                    </button>
                                    {charThreads.length === 0 && <div className="text-[10px] text-gray-600 italic px-2">No threads active.</div>}
                                    {charThreads.map((t: Thread) => (
                                        <div key={t.id} className="flex items-center gap-2 p-2 rounded hover:bg-cerberus-900/30 text-gray-400">
                                            <MessageSquare size={10} className="shrink-0"/>
                                            <span className="text-xs truncate">{t.title}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- MAIN GALLERY ---

const CharacterGallery: React.FC<CharacterGalleryProps> = ({
    isOpen, onClose, templates, userCharacters, activeCharacterId, threads,
    onSelectCharacter, onUseTemplate, onEditCharacter, onDeleteCharacter, onViewDetails, onDuplicateCharacter
}) => {
    const [activeTab, setActiveTab] = useState<'my_chars' | 'templates'>('my_chars');
    const [isListDrawerOpen, setIsListDrawerOpen] = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    useEffect(() => {
        if (toastMsg) {
            const t = setTimeout(() => setToastMsg(null), 3000);
            return () => clearTimeout(t);
        }
    }, [toastMsg]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl flex flex-col animate-fadeIn overflow-hidden">
            
            {/* Header */}
            <div className="h-16 px-6 border-b border-cerberus-800 flex justify-between items-center bg-cerberus-900/80 z-30 shrink-0">
                <div className="flex items-center gap-3">
                    <Users size={20} className="text-cerberus-accent"/>
                    <h1 className="text-lg font-serif text-white tracking-widest font-bold hidden md:block">PERSONA GALLERY</h1>
                </div>
                
                <div className="flex items-center gap-4">
                    {/* Centered Tab Switcher in Context */}
                    <div className="flex bg-black/50 rounded p-1 border border-cerberus-800">
                        <button 
                            onClick={() => setActiveTab('my_chars')}
                            className={`px-4 py-1.5 rounded text-[10px] uppercase font-bold tracking-widest transition-all ${activeTab === 'my_chars' ? 'bg-cerberus-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            My Characters
                        </button>
                        <button 
                            onClick={() => setActiveTab('templates')}
                            className={`px-4 py-1.5 rounded text-[10px] uppercase font-bold tracking-widest transition-all ${activeTab === 'templates' ? 'bg-cerberus-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Templates
                        </button>
                    </div>

                    <div className="h-6 w-px bg-cerberus-800 mx-2"></div>

                    {/* Action Buttons */}
                    <button onClick={() => setIsListDrawerOpen(!isListDrawerOpen)} className="p-2 hover:bg-cerberus-800 rounded text-gray-400 hover:text-white transition-colors relative" title="List View">
                        <List size={20}/>
                        {isListDrawerOpen && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-cerberus-accent rounded-full"/>}
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-cerberus-800 rounded text-gray-400 hover:text-white transition-colors">
                        <X size={20}/>
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 relative overflow-hidden flex">
                
                {/* Scrollable Gallery */}
                <div className="flex-1 overflow-y-hidden overflow-x-auto snap-x snap-mandatory scroll-smooth p-8 flex items-center gap-6 custom-scrollbar relative z-10">
                    
                    {/* Background Pattern */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cerberus-900/30 via-black to-black pointer-events-none -z-10" />
                    
                    {activeTab === 'my_chars' && (
                        <>
                            {/* New Character Card Placeholder */}
                            <div 
                                onClick={() => setActiveTab('templates')}
                                className="shrink-0 w-56 h-[28rem] rounded-lg border-2 border-dashed border-cerberus-800 hover:border-cerberus-600 flex flex-col items-center justify-center cursor-pointer group bg-black/20 hover:bg-black/40 transition-colors snap-center"
                            >
                                <div className="w-16 h-16 rounded-full bg-cerberus-900/50 flex items-center justify-center mb-4 group-hover:bg-cerberus-800/50 transition-colors">
                                    <Plus size={32} className="text-cerberus-700 group-hover:text-cerberus-500"/>
                                </div>
                                <span className="text-xs uppercase font-bold tracking-widest text-gray-600 group-hover:text-gray-400">Forging New Soul</span>
                            </div>

                            {userCharacters.map(char => (
                                <CharacterCard 
                                    key={char.id} 
                                    char={char} 
                                    isTemplate={false} 
                                    activeCharacterId={activeCharacterId}
                                    onSelectCharacter={onSelectCharacter}
                                    onUseTemplate={onUseTemplate}
                                    onEditCharacter={onEditCharacter}
                                    onDeleteCharacter={onDeleteCharacter}
                                    onViewDetails={onViewDetails}
                                    onDuplicateCharacter={onDuplicateCharacter}
                                    onClose={onClose}
                                    onShowToast={setToastMsg}
                                />
                            ))}
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
                                    onEditCharacter={onEditCharacter}
                                    onDeleteCharacter={onDeleteCharacter}
                                    onViewDetails={onViewDetails}
                                    onDuplicateCharacter={onDuplicateCharacter}
                                    onClose={onClose}
                                    onShowToast={setToastMsg}
                                />
                            ))}
                        </>
                    )}
                    
                    {/* End Spacer */}
                    <div className="w-8 shrink-0"/>
                </div>

                {/* List Drawer */}
                <CharacterListDrawer 
                    isOpen={isListDrawerOpen} 
                    onClose={() => setIsListDrawerOpen(false)} 
                    characters={userCharacters}
                    activeCharacterId={activeCharacterId}
                    threads={threads}
                    onSelectCharacter={onSelectCharacter}
                />
            </div>

            {/* Footer / Hint */}
            <div className="p-3 border-t border-cerberus-800 bg-cerberus-900/80 text-center text-[10px] text-gray-500 font-mono uppercase tracking-widest backdrop-blur-sm z-30">
                {activeTab === 'my_chars' ? "Select a persona to instantiate the connection." : "Templates are immutable patterns. Use one to create a unique instance."}
            </div>

            {/* Toast Notification */}
            {toastMsg && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-green-900/90 border border-green-700 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-fadeIn z-50">
                    <CheckCircle size={18} className="text-green-400"/>
                    <span className="text-xs font-bold uppercase tracking-wide">{toastMsg}</span>
                </div>
            )}
        </div>
    );
};

export default CharacterGallery;
