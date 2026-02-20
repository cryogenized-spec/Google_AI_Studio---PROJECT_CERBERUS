
import React, { useState, useEffect } from 'react';
import { CharacterProfile, RoleplayConstraints, CapabilityProfile, CharacterRoles, AppSettings } from '../types';
import { X, Save, User, Heart, Shield, Sliders, Palette, AlertTriangle, Monitor, Unlock, Zap, FileText, ChevronLeft, Menu, Eye, MapPin, Gift, ScrollText, Dices, BookOpen, Send, MessageSquare, Loader2, Sparkles, AlertCircle, EyeOff } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

interface CharacterEditorModalProps {
    character: CharacterProfile;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedChar: CharacterProfile) => void;
    appSettings: AppSettings;
    onCreateReportThread: (content: string, context: string) => void;
}

const CharacterEditorModal: React.FC<CharacterEditorModalProps> = ({ character, isOpen, onClose, onSave, appSettings, onCreateReportThread }) => {
    // Local state for form with persistence init
    const [form, setForm] = useState<CharacterProfile>(() => {
        // Only load from storage if we are editing the SAME character (by ID)
        // or a new template instance
        const savedDraft = localStorage.getItem('cerberus_char_draft');
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                if (parsed.id === character.id) {
                    return parsed;
                }
            } catch (e) {}
        }
        return character;
    });

    const [activeTab, setActiveTab] = useState<'identity' | 'lore' | 'stats' | 'rules' | 'system'>('identity');
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
    const [showNSFW, setShowNSFW] = useState(false);
    
    // Smart Read State
    const [aiAnalysis, setAiAnalysis] = useState<{ isOpen: boolean; result: string; isThinking: boolean; context: string }>({ 
        isOpen: false, result: '', isThinking: false, context: '' 
    });

    if (!isOpen) return null;

    // Persist to Local Storage
    useEffect(() => {
        localStorage.setItem('cerberus_char_draft', JSON.stringify(form));
    }, [form]);

    // Deep merge helper for nested updates
    const updateConstraints = (updates: Partial<RoleplayConstraints>) => {
        setForm(prev => ({
            ...prev,
            constraints: { ...prev.constraints, ...updates }
        }));
    };

    const updateCapabilities = (field: keyof CapabilityProfile, value: number) => {
        // Clamp 0-10 on input
        const clamped = Math.max(0, Math.min(10, value));
        setForm(prev => ({
            ...prev,
            capabilities: { ...prev.capabilities, [field]: clamped }
        }));
    };

    const updateRoles = (updates: Partial<CharacterRoles>) => {
        setForm(prev => ({
            ...prev,
            roles: { ...prev.roles, ...updates }
        }));
    };

    const updateTheme = (field: string, value: string) => {
        setForm(prev => ({
            ...prev,
            theme: { ...prev.theme, [field]: value }
        }));
    };

    const handleSave = () => {
        // Validation
        if (!form.name.trim()) return alert("Name is required.");
        
        // Strict Clamping Safety Check
        const clampedPortraitScale = Math.max(1.0, Math.min(3.0, form.portraitScale || 1.0));
        const clampedCapabilities = { ...form.capabilities };
        for (const k in clampedCapabilities) {
            // @ts-ignore
            clampedCapabilities[k] = Math.max(0, Math.min(10, clampedCapabilities[k]));
        }

        const safeForm = {
            ...form,
            portraitScale: clampedPortraitScale,
            capabilities: clampedCapabilities
        };

        onSave(safeForm);
        localStorage.removeItem('cerberus_char_draft'); // Clear draft
        onClose();
    };

    const handleClose = () => {
        localStorage.removeItem('cerberus_char_draft'); // Clear draft on cancel
        onClose();
    };

    const handleArrayInput = (value: string, field: 'likes' | 'dislikes' | 'triggers' | 'boundaries') => {
        const arr = value.split('\n').map(s => s.trim()).filter(Boolean);
        updateConstraints({ [field]: arr });
    };

    // --- SMART READ LOGIC ---
    const handleSmartRead = async (text: string, context: string, mode: 'critique' | 'improve' | 'comment') => {
        if (!text.trim()) return alert("Field is empty.");
        if (!appSettings.apiKeyGemini) return alert("AI Key Required for Analysis.");

        setAiAnalysis({ isOpen: true, result: '', isThinking: true, context });

        try {
            const ai = new GoogleGenAI({ apiKey: appSettings.apiKeyGemini });
            let prompt = "";
            
            if (mode === 'critique') prompt = `Analyze this character's ${context}. Score it out of 100 based on creativity, depth, and consistency. Provide a harsh but fair critique and an honest overview.\n\nTEXT:\n${text}`;
            if (mode === 'improve') prompt = `Rewrite this ${context} to improve flow, impact, and immersion. Keep the core meaning but enhance the prose.\n\nTEXT:\n${text}`;
            if (mode === 'comment') prompt = `Read this ${context}. Provide general thoughts, interesting observations, and potential plot hooks.\n\nTEXT:\n${text}`;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
            });

            setAiAnalysis(prev => ({ ...prev, result: response.text || "No analysis generated.", isThinking: false }));
        } catch (e: any) {
            setAiAnalysis(prev => ({ ...prev, result: "Analysis Failed: " + e.message, isThinking: false }));
        }
    };

    const handleDiscussAnalysis = () => {
        onCreateReportThread(aiAnalysis.result, aiAnalysis.context);
        setAiAnalysis({ ...aiAnalysis, isOpen: false });
        onClose(); // Close editor to go to chat
    };

    // --- SUB-COMPONENTS ---

    const TabButton = ({ id, label, icon }: { id: string, label: string, icon: React.ReactNode }) => (
        <button 
            onClick={() => setActiveTab(id as any)} 
            title={!isSidebarExpanded ? label : ''}
            className={`
                p-4 flex items-center gap-3 transition-all border-l-2
                ${activeTab === id 
                    ? 'bg-cerberus-800/30 border-cerberus-accent text-white' 
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'}
                ${!isSidebarExpanded ? 'justify-center' : 'text-left'}
            `}
        >
            <span className="shrink-0">{icon}</span>
            {isSidebarExpanded && <span className="text-xs font-bold uppercase tracking-widest truncate">{label}</span>}
        </button>
    );

    const SmartReadButton = ({ text, context }: { text: string, context: string }) => {
        const [showMenu, setShowMenu] = useState(false);
        
        // Auto-close menu after 5s if no interaction
        useEffect(() => {
            if (showMenu) {
                const t = setTimeout(() => setShowMenu(false), 5000);
                return () => clearTimeout(t);
            }
        }, [showMenu]);

        return (
            <div className="relative inline-block ml-3 z-20">
                <button 
                    onClick={() => setShowMenu(!showMenu)}
                    className="text-cerberus-accent hover:text-white transition-all hover:scale-110 active:scale-95 group relative p-1"
                    title="Smart Read"
                >
                    <Eye size={16} className="relative z-10"/>
                    <Sparkles 
                        size={12} 
                        className={`absolute -top-2 -right-2 z-20 transition-all duration-500 ${showMenu ? 'text-yellow-300 animate-pulse drop-shadow-[0_0_5px_rgba(253,224,71,0.8)]' : 'text-cerberus-accent/40 scale-75'}`} 
                    />
                    {showMenu && <div className="absolute inset-0 bg-cerberus-accent/20 rounded-full blur-sm transition-opacity"/>}
                </button>
                
                {/* RADIAL MENU FAN-OUT (LEFT SIDE) */}
                {showMenu && (
                    <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-0 h-0">
                        {/* Option 1: Top Left */}
                        <button 
                            onClick={() => { handleSmartRead(text, context, 'comment'); setShowMenu(false); }}
                            className="absolute flex items-center justify-center bg-black/90 border border-cerberus-700 hover:border-cerberus-accent text-gray-300 hover:text-white text-[10px] uppercase font-bold whitespace-nowrap px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.8)] transition-all duration-300 hover:scale-105 origin-right right-0"
                            style={{ 
                                transform: 'translate(-35px, -45px)',
                                animation: 'fanOut1 0.2s ease-out forwards'
                            }}
                        >
                            Read & Comment
                        </button>

                        {/* Option 2: Left */}
                        <button 
                            onClick={() => { handleSmartRead(text, context, 'improve'); setShowMenu(false); }}
                            className="absolute flex items-center justify-center bg-black/90 border border-cerberus-700 hover:border-cerberus-accent text-gray-300 hover:text-white text-[10px] uppercase font-bold whitespace-nowrap px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.8)] transition-all duration-300 hover:scale-105 origin-right right-0"
                            style={{ 
                                transform: 'translate(-55px, -5px)',
                                animation: 'fanOut2 0.25s ease-out forwards'
                            }}
                        >
                            Suggest Improvement
                        </button>

                        {/* Option 3: Bottom Left */}
                        <button 
                            onClick={() => { handleSmartRead(text, context, 'critique'); setShowMenu(false); }}
                            className="absolute flex items-center justify-center bg-black/90 border border-cerberus-accent hover:bg-cerberus-900/80 text-cerberus-accent hover:text-white text-[10px] uppercase font-bold whitespace-nowrap px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.8)] transition-all duration-300 hover:scale-105 origin-right right-0"
                            style={{ 
                                transform: 'translate(-35px, 35px)',
                                animation: 'fanOut3 0.3s ease-out forwards'
                            }}
                        >
                            Judge (Score/100)
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            
            {/* AI ANALYSIS OVERLAY */}
            {aiAnalysis.isOpen && (
                <div className="absolute inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-cerberus-900 border border-cerberus-700 w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-cerberus-800 flex justify-between items-center bg-cerberus-950">
                            <h3 className="text-sm font-serif font-bold text-cerberus-accent tracking-widest flex items-center gap-2">
                                <Sparkles size={16}/> AI ANALYSIS: {aiAnalysis.context.toUpperCase()}
                            </h3>
                            <button onClick={() => setAiAnalysis({...aiAnalysis, isOpen: false})}><X size={18} className="text-gray-500 hover:text-white"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 text-sm text-gray-300 leading-relaxed custom-scrollbar whitespace-pre-wrap font-serif">
                            {aiAnalysis.isThinking ? (
                                <div className="flex flex-col items-center justify-center h-40 text-cerberus-accent">
                                    <Loader2 size={32} className="animate-spin mb-4"/>
                                    <span className="text-xs uppercase tracking-widest">Consulting the Oracle...</span>
                                </div>
                            ) : (
                                aiAnalysis.result
                            )}
                        </div>
                        <div className="p-4 border-t border-cerberus-800 bg-cerberus-950 flex justify-end">
                            <button 
                                onClick={handleDiscussAnalysis}
                                disabled={aiAnalysis.isThinking}
                                className="px-4 py-2 bg-cerberus-600 hover:bg-cerberus-500 text-white rounded text-xs font-bold uppercase flex items-center gap-2 disabled:opacity-50"
                            >
                                <MessageSquare size={14}/> Discuss in Chat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-cerberus-900 border border-cerberus-700 w-full max-w-6xl h-[85vh] rounded-xl flex flex-col shadow-2xl overflow-hidden relative">
                
                {/* Header */}
                <div className="h-16 border-b border-cerberus-800 flex items-center justify-between px-6 bg-cerberus-950 shrink-0">
                    <div className="flex items-center gap-3">
                        <User size={20} className="text-cerberus-accent shrink-0"/> 
                        <h2 className="text-lg font-serif font-bold text-white tracking-widest truncate">CHARACTER EDITOR</h2>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button onClick={handleClose} className="px-4 py-2 text-xs text-gray-400 hover:text-white uppercase font-bold">Cancel</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-cerberus-600 hover:bg-cerberus-500 text-white rounded-sm text-xs font-bold uppercase flex items-center gap-2 shadow-lg">
                            <Save size={14}/> Save
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 overflow-hidden">
                    
                    {/* Sidebar Tabs */}
                    <div className={`${isSidebarExpanded ? 'w-48' : 'w-16'} bg-black/20 border-r border-cerberus-800 flex flex-col transition-all duration-300 shrink-0`}>
                        <div className="flex justify-end p-2 border-b border-cerberus-800/30 mb-1">
                             <button 
                                onClick={() => setIsSidebarExpanded(!isSidebarExpanded)} 
                                className="text-gray-500 hover:text-white p-1 rounded hover:bg-white/10"
                                title={isSidebarExpanded ? "Collapse" : "Expand"}
                             >
                                {isSidebarExpanded ? <ChevronLeft size={16}/> : <Menu size={16}/>}
                             </button>
                        </div>
                        
                        <TabButton id="identity" label="Identity" icon={<User size={18}/>} />
                        <TabButton id="lore" label="Lore & Context" icon={<BookOpen size={18}/>} />
                        <TabButton id="stats" label="Stats & Sheet" icon={<Zap size={18}/>} />
                        <TabButton id="rules" label="Rules & Safety" icon={<Shield size={18}/>} />
                        <TabButton id="system" label="System" icon={<Monitor size={18}/>} />
                    </div>

                    {/* Form Area */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-cerberus-900/50">
                        
                        {activeTab === 'identity' && (
                            <div className="space-y-6 max-w-3xl animate-fadeIn">
                                <div>
                                    <label className="block text-xs font-mono text-cerberus-accent uppercase mb-1">Name</label>
                                    <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-3 text-white focus:border-cerberus-accent outline-none"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono text-cerberus-accent uppercase mb-1">Tagline / Archetype</label>
                                    <input value={form.tagline || ''} onChange={e => setForm({...form, tagline: e.target.value})} className="w-full bg-black/50 border border-cerberus-700 rounded p-3 text-gray-300 focus:border-cerberus-accent outline-none"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono text-cerberus-accent uppercase mb-1">Portrait URL</label>
                                    <div className="flex gap-4">
                                        <input value={form.portraitUrl} onChange={e => setForm({...form, portraitUrl: e.target.value})} className="flex-1 bg-black/50 border border-cerberus-700 rounded p-3 text-gray-300 font-mono text-xs focus:border-cerberus-accent outline-none"/>
                                        <div className="w-16 h-16 rounded border border-cerberus-800 overflow-hidden shrink-0">
                                            <img src={form.portraitUrl} className="w-full h-full object-cover opacity-80" />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-mono text-cerberus-accent uppercase mb-1">Portrait Scale (1.0 - 3.0)</label>
                                        <input 
                                            type="number" step="0.1" min="1.0" max="3.0"
                                            value={form.portraitScale || 1.0} 
                                            onChange={e => setForm({...form, portraitScale: parseFloat(e.target.value)})}
                                            className="w-full bg-black/50 border border-cerberus-700 rounded p-3 text-gray-300 focus:border-cerberus-accent outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-cerberus-800">
                                    <div>
                                        <label className="block text-xs font-mono text-gray-500 uppercase mb-1">Primary Color</label>
                                        <div className="flex items-center gap-2">
                                            <input type="color" value={form.theme.primaryColor} onChange={e => updateTheme('primaryColor', e.target.value)} className="w-8 h-8 bg-transparent border border-cerberus-700 rounded cursor-pointer"/>
                                            <span className="text-xs font-mono text-gray-500">{form.theme.primaryColor}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-mono text-gray-500 uppercase mb-1">Accent Color</label>
                                        <div className="flex items-center gap-2">
                                            <input type="color" value={form.theme.accentColor} onChange={e => updateTheme('accentColor', e.target.value)} className="w-8 h-8 bg-transparent border border-cerberus-700 rounded cursor-pointer"/>
                                            <span className="text-xs font-mono text-gray-500">{form.theme.accentColor}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-mono text-gray-500 uppercase mb-1">System Font</label>
                                        <select 
                                            value={form.theme.fontFamily || "'Cinzel', serif"}
                                            onChange={e => updateTheme('fontFamily', e.target.value)}
                                            className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-white"
                                        >
                                            <option value="'Cinzel', serif">Cinzel (Serif)</option>
                                            <option value="'Playfair Display', serif">Playfair (Elegant)</option>
                                            <option value="'Inter', sans-serif">Inter (Modern)</option>
                                            <option value="'JetBrains Mono', monospace">Mono (Tech)</option>
                                            <option value="'Courier Prime', monospace">Courier (Typewriter)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'lore' && (
                            <div className="space-y-6 max-w-3xl animate-fadeIn">
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-mono text-cerberus-accent uppercase">Bio & Background</label>
                                        <SmartReadButton text={form.constraints.fullBio} context="Biography" />
                                    </div>
                                    <textarea value={form.constraints.fullBio} onChange={e => updateConstraints({ fullBio: e.target.value })} className="w-full h-40 bg-black/50 border border-cerberus-700 rounded p-3 text-sm text-gray-300 focus:border-cerberus-accent outline-none custom-scrollbar"/>
                                </div>
                                
                                <div className="flex flex-col gap-6">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-xs font-mono text-cerberus-accent uppercase flex items-center gap-1"><MapPin size={12}/> Realms & Rooms</label>
                                            <SmartReadButton text={form.constraints.realms || ''} context="Realms List" />
                                        </div>
                                        <textarea value={form.constraints.realms || ''} onChange={e => updateConstraints({ realms: e.target.value })} className="w-full h-32 bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-gray-300 outline-none resize-none" placeholder="The Void, The Crimson Keep..."/>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-xs font-mono text-cerberus-accent uppercase flex items-center gap-1"><Gift size={12}/> Sentimental Items</label>
                                            <SmartReadButton text={form.constraints.sentimentalItems || ''} context="Item Inventory" />
                                        </div>
                                        <textarea value={form.constraints.sentimentalItems || ''} onChange={e => updateConstraints({ sentimentalItems: e.target.value })} className="w-full h-32 bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-gray-300 outline-none resize-none" placeholder="Ancient ring, Onyx dagger..."/>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-mono text-pink-400 uppercase mb-1 flex items-center gap-2"><Heart size={12}/> Relationships (One per line)</label>
                                    <textarea 
                                        value={form.constraints.relationships || ''} 
                                        onChange={e => updateConstraints({ relationships: e.target.value })}
                                        className="w-full h-24 bg-pink-900/10 border border-pink-900/30 rounded p-2 text-xs text-pink-200 focus:border-pink-800 outline-none resize-none placeholder-pink-900/50" 
                                        placeholder="Elara: Rival. Views her as weak.&#10;Unit 734: Distrust. Finds machines cold."
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'stats' && (
                            <div className="space-y-8 max-w-3xl animate-fadeIn">
                                {/* D&D Sheet Block */}
                                <div className="bg-cerberus-800/20 border border-cerberus-800 p-4 rounded">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest flex items-center gap-2"><Dices size={14}/> D&D 5e Character Sheet</h3>
                                        <SmartReadButton text={form.constraints.dndSheet || ''} context="D&D Character Sheet" />
                                    </div>
                                    <textarea 
                                        value={form.constraints.dndSheet || ''} 
                                        onChange={e => updateConstraints({ dndSheet: e.target.value })}
                                        className="w-full h-64 bg-black/50 border border-cerberus-700 rounded p-3 text-xs font-mono text-gray-300 outline-none custom-scrollbar leading-relaxed" 
                                        placeholder="Class: Warlock (Hexblade)&#10;Level: 12&#10;STR: 10 (+0) | DEX: 14 (+2) | CON: 14 (+2) | INT: 12 (+1) | WIS: 12 (+1) | CHA: 20 (+5)&#10;Spells: Eldritch Blast, Hex, Armor of Agathys..."
                                    />
                                </div>

                                <div className="space-y-4 pt-4 border-t border-cerberus-800">
                                    <p className="text-xs text-gray-500 bg-cerberus-800/20 p-3 rounded border border-cerberus-800">
                                        Adjust capability sliders (0-10) to influence AI behavior logic.
                                    </p>
                                    {[
                                        { key: 'planning', label: 'Planning & Foresight' },
                                        { key: 'empathy', label: 'Empathy & EQ' },
                                        { key: 'puzzleSolving', label: 'Logic & Puzzle Solving' },
                                        { key: 'lore', label: 'Lore Knowledge' },
                                        { key: 'tactics', label: 'Combat Tactics' },
                                        { key: 'toolDiscipline', label: 'Tool Usage' },
                                    ].map((cap) => (
                                        <div key={cap.key}>
                                            <div className="flex justify-between mb-2">
                                                <label className="text-xs font-bold text-gray-300 uppercase tracking-widest">{cap.label}</label>
                                                <span className="text-xs font-mono text-cerberus-accent">{(form.capabilities as any)[cap.key]}/10</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" max="10" step="1"
                                                value={(form.capabilities as any)[cap.key]}
                                                onChange={e => updateCapabilities(cap.key as any, parseInt(e.target.value))}
                                                className="w-full accent-cerberus-accent"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'rules' && (
                            <div className="space-y-6 max-w-3xl animate-fadeIn">
                                {/* NSFW BLOCK */}
                                <div className="bg-red-950/20 border border-red-900/50 rounded overflow-hidden">
                                    <div className="p-3 bg-red-950/40 border-b border-red-900/50 flex justify-between items-center">
                                        <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2"><AlertCircle size={14}/> NSFW Directives (Adult Only)</h3>
                                        <button 
                                            onClick={() => setShowNSFW(!showNSFW)} 
                                            className="text-red-400 hover:text-white transition-colors"
                                            title={showNSFW ? "Blur Content" : "Reveal Content"}
                                        >
                                            {showNSFW ? <EyeOff size={16}/> : <Eye size={16}/>}
                                        </button>
                                    </div>
                                    <div className="p-3 relative">
                                        <textarea 
                                            value={form.constraints.nsfwInstructions || ''} 
                                            onChange={e => updateConstraints({ nsfwInstructions: e.target.value })}
                                            className={`w-full h-32 bg-black/50 border border-red-900/30 rounded p-2 text-xs text-red-200 focus:border-red-600 outline-none resize-none transition-all duration-500 ${showNSFW ? 'blur-0' : 'blur-md select-none'}`} 
                                            placeholder="Explicit preferences, kinks, and anatomical details..."
                                            disabled={!showNSFW}
                                        />
                                        {!showNSFW && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <span className="text-[10px] font-bold uppercase text-white bg-red-900/80 px-3 py-1 rounded border border-red-500">Content Hidden</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-mono text-gray-500 uppercase mb-1">Consent Style</label>
                                        <select value={form.constraints.consentStyle} onChange={e => updateConstraints({ consentStyle: e.target.value as any })} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-white">
                                            <option value="strict">Strict (Ask First)</option>
                                            <option value="normal">Normal</option>
                                            <option value="casual">Casual / Implicit</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-mono text-gray-500 uppercase mb-1">Romance Pace</label>
                                        <select value={form.constraints.romance.pace} onChange={e => updateConstraints({ romance: { ...form.constraints.romance, pace: e.target.value as any } })} className="w-full bg-black/50 border border-cerberus-700 rounded p-2 text-xs text-white">
                                            <option value="slow">Slow Burn</option>
                                            <option value="medium">Standard</option>
                                            <option value="fast">Fast / Instant</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-mono text-red-500 uppercase mb-1 flex items-center gap-2"><AlertTriangle size={12}/> Hard Boundaries (System Refusal)</label>
                                    <textarea value={form.constraints.boundaries?.join('\n')} onChange={e => handleArrayInput(e.target.value, 'boundaries')} className="w-full h-24 bg-red-950/10 border border-red-900/30 rounded p-2 text-xs text-red-200 focus:border-red-800 outline-none resize-none placeholder-red-900/50" placeholder="One per line..."/>
                                </div>
                                <div>
                                    <label className="block text-xs font-mono text-orange-500 uppercase mb-1">Triggers / Sensitivities</label>
                                    <textarea value={form.constraints.triggers?.join('\n')} onChange={e => handleArrayInput(e.target.value, 'triggers')} className="w-full h-24 bg-orange-950/10 border border-orange-900/30 rounded p-2 text-xs text-orange-200 focus:border-orange-800 outline-none resize-none placeholder-orange-900/50" placeholder="One per line..."/>
                                </div>
                            </div>
                        )}

                        {activeTab === 'system' && (
                            <div className="space-y-6 max-w-3xl animate-fadeIn">
                                <div className="p-4 bg-cerberus-800/20 border border-cerberus-800 rounded">
                                    <h3 className="text-xs font-bold text-cerberus-accent uppercase tracking-widest mb-4 flex items-center gap-2"><Monitor size={14}/> Operational Roles</h3>
                                    
                                    <div className="space-y-4">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <span className="text-sm font-bold text-gray-200">Task Agent</span>
                                                <p className="text-[10px] text-gray-500">Allow this persona to manage tasks, calendar, and emails.</p>
                                            </div>
                                            <label className="cursor-pointer relative">
                                                <input type="checkbox" checked={form.roles?.taskAgent} onChange={e => updateRoles({ taskAgent: e.target.checked })} className="sr-only peer"/>
                                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cerberus-accent"></div>
                                            </label>
                                        </div>

                                        <div className="flex items-start justify-between">
                                            <div>
                                                <span className="text-sm font-bold text-gray-200 flex items-center gap-2">Narrative Trust Mode <Unlock size={12} className="text-red-500"/></span>
                                                <p className="text-[10px] text-gray-500">Allow AI to invent facts and worldbuild freely without strict adherence to source material.</p>
                                            </div>
                                            <label className="cursor-pointer relative">
                                                <input type="checkbox" checked={form.roles?.narrativeTrustMode} onChange={e => updateRoles({ narrativeTrustMode: e.target.checked })} className="sr-only peer"/>
                                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default CharacterEditorModal;
