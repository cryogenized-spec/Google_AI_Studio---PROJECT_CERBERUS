
import React from 'react';
import { CharacterProfile, CapabilityProfile } from '../types';
import { X, Shield, Heart, Zap, MapPin, Book, Lock, Copy, Monitor, CheckCircle, XCircle } from 'lucide-react';

interface CharacterSheetModalProps {
    character: CharacterProfile;
    onClose: () => void;
    onCustomize?: () => void;
}

const CapabilityBar: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="flex items-center gap-2 text-xs">
        <span className="w-24 text-gray-400 font-mono uppercase truncate">{label}</span>
        <div className="flex-1 h-2 bg-cerberus-800 rounded-full overflow-hidden">
            <div 
                className="h-full bg-cerberus-accent transition-all duration-500" 
                style={{ width: `${(value / 10) * 100}%` }}
            />
        </div>
        <span className="w-4 text-right text-gray-300 font-bold">{value}</span>
    </div>
);

const CharacterSheetModal: React.FC<CharacterSheetModalProps> = ({ character, onClose, onCustomize }) => {
    if (!character) return null;

    const c = character.constraints;
    const caps = character.capabilities;
    const roles = character.roles || { taskAgent: false, narrativeTrustMode: false };

    return (
        <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-cerberus-900 border border-cerberus-700 w-full max-w-4xl h-[90vh] rounded-xl flex overflow-hidden shadow-2xl">
                
                {/* LEFT: Portrait & Quick Stats */}
                <div className="w-1/3 bg-black/40 border-r border-cerberus-800 flex flex-col">
                    <div className="relative aspect-[4/5] w-full">
                        <img 
                            src={character.portraitUrl} 
                            alt={character.name} 
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-cerberus-900 via-transparent to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4">
                            <h2 className="text-2xl font-serif font-bold text-white leading-none mb-1">{character.name}</h2>
                            <p className="text-sm text-cerberus-accent font-mono uppercase tracking-widest">{character.tagline}</p>
                        </div>
                    </div>
                    
                    <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Zap size={12}/> Capabilities
                            </h3>
                            <div className="space-y-2">
                                <CapabilityBar label="Planning" value={caps.planning} />
                                <CapabilityBar label="Empathy" value={caps.empathy} />
                                <CapabilityBar label="Logic" value={caps.puzzleSolving} />
                                <CapabilityBar label="Lore" value={caps.lore} />
                                <CapabilityBar label="Tactics" value={caps.tactics} />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Shield size={12}/> Safety
                            </h3>
                            <div className="text-xs text-gray-300 space-y-1">
                                <div className="flex justify-between"><span className="text-gray-500">Consent:</span> <span className="uppercase">{c.consentStyle}</span></div>
                                <div className="flex justify-between"><span className="text-gray-500">Boundaries:</span> <span>{c.boundaries?.length || 0} defined</span></div>
                            </div>
                        </div>

                        {character.isTemplate && onCustomize && (
                            <button 
                                onClick={onCustomize}
                                className="w-full py-3 bg-cerberus-accent text-cerberus-900 font-bold uppercase tracking-widest text-xs rounded hover:bg-white transition-colors flex items-center justify-center gap-2"
                            >
                                <Copy size={14}/> Customize Template
                            </button>
                        )}
                    </div>
                </div>

                {/* RIGHT: Details */}
                <div className="flex-1 flex flex-col bg-cerberus-900/50">
                    <div className="h-14 border-b border-cerberus-800 flex items-center justify-between px-6 shrink-0">
                        <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                            {character.isTemplate ? "Immutable Template Record" : "Character Sheet"}
                        </span>
                        <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                        
                        <section>
                            <h3 className="text-sm font-serif text-cerberus-accent border-b border-cerberus-800 pb-2 mb-3">Biographical Data</h3>
                            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{c.fullBio}</p>
                        </section>

                        <section className="grid grid-cols-2 gap-8">
                            <div>
                                <h3 className="text-sm font-serif text-cerberus-accent border-b border-cerberus-800 pb-2 mb-3">Appearance</h3>
                                <p className="text-xs text-gray-400 leading-relaxed">{c.appearanceDescription}</p>
                            </div>
                            <div>
                                <h3 className="text-sm font-serif text-cerberus-accent border-b border-cerberus-800 pb-2 mb-3">Personality Matrix</h3>
                                <div className="space-y-4">
                                    <div>
                                        <span className="text-[10px] text-green-500 uppercase font-bold block mb-1">Likes</span>
                                        <div className="flex flex-wrap gap-1">
                                            {c.likes?.map(l => <span key={l} className="px-2 py-1 bg-green-900/20 text-green-400 text-[10px] rounded border border-green-900/30">{l}</span>)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-red-500 uppercase font-bold block mb-1">Dislikes</span>
                                        <div className="flex flex-wrap gap-1">
                                            {c.dislikes?.map(l => <span key={l} className="px-2 py-1 bg-red-900/20 text-red-400 text-[10px] rounded border border-red-900/30">{l}</span>)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="grid grid-cols-2 gap-8">
                            <div>
                                <h3 className="text-sm font-serif text-cerberus-accent border-b border-cerberus-800 pb-2 mb-3 flex items-center gap-2">
                                    <Heart size={14}/> Relationship Dynamics
                                </h3>
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between bg-black/20 p-2 rounded">
                                        <span className="text-gray-500">Romance</span>
                                        <span className={c.romance.enabled ? "text-pink-400" : "text-gray-600"}>{c.romance.enabled ? "Enabled" : "Disabled"}</span>
                                    </div>
                                    {c.romance.enabled && (
                                        <>
                                            <div className="flex justify-between bg-black/20 p-2 rounded">
                                                <span className="text-gray-500">Pacing</span>
                                                <span className="text-gray-300 capitalize">{c.romance.pace}</span>
                                            </div>
                                            <div className="bg-black/20 p-2 rounded">
                                                <span className="text-gray-500 block mb-1">Preference</span>
                                                <span className="text-gray-300 italic">"{c.romance.preferenceNote}"</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-serif text-cerberus-accent border-b border-cerberus-800 pb-2 mb-3 flex items-center gap-2">
                                    <MapPin size={14}/> Spatial Logic
                                </h3>
                                <div className="bg-black/20 p-3 rounded border border-cerberus-800/50">
                                    <div className="text-[10px] font-mono text-gray-500 mb-2 uppercase">
                                        {character.mappingLogic.includes("BASIC") ? "Basic Mode" : "Advanced Mode"}
                                    </div>
                                    <p className="text-[10px] text-gray-400 line-clamp-4">
                                        {character.mappingLogic}
                                    </p>
                                </div>
                            </div>
                        </section>

                        <section className="grid grid-cols-2 gap-8">
                            <div>
                                <h3 className="text-sm font-serif text-cerberus-accent border-b border-cerberus-800 pb-2 mb-3 flex items-center gap-2">
                                    <Monitor size={14}/> System Configuration
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center bg-black/20 p-2 rounded">
                                        <span className="text-xs text-gray-400">Task Agent</span>
                                        {roles.taskAgent ? <CheckCircle size={14} className="text-green-500"/> : <XCircle size={14} className="text-gray-600"/>}
                                    </div>
                                    <div className="flex justify-between items-center bg-black/20 p-2 rounded">
                                        <span className="text-xs text-gray-400">Narrative Trust Mode</span>
                                        {roles.narrativeTrustMode ? <CheckCircle size={14} className="text-red-500"/> : <XCircle size={14} className="text-gray-600"/>}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-sm font-serif text-cerberus-accent border-b border-cerberus-800 pb-2 mb-3 flex items-center gap-2">
                                    <Lock size={14}/> Safety & Triggers
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {c.triggers?.length === 0 && <span className="text-xs text-gray-500 italic">No specific triggers listed.</span>}
                                    {c.triggers?.map(t => (
                                        <span key={t} className="px-2 py-1 bg-red-950/30 text-red-300 border border-red-900/30 rounded text-xs flex items-center gap-1">
                                            <AlertCircleIcon className="w-3 h-3"/> {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </section>

                    </div>
                </div>
            </div>
        </div>
    );
};

const AlertCircleIcon = ({className}:{className?:string}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
);

export default CharacterSheetModal;
