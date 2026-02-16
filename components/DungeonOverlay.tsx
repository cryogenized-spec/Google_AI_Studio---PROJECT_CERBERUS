
// ... existing imports ...
import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, MicOff, Send, Skull, RotateCw, Trash2, StopCircle, Dices, Menu, Settings, MessageSquare, Plus, Eye, Ghost, Users, BookOpen, Edit2, Check, RotateCcw, RefreshCw, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message, DungeonConfig, Thread, AppSettings } from '../types';
import { DEMEANOR_PRESETS } from '../constants';
import { useTranscriber } from '../hooks/useTranscriber';

interface DungeonOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    activeThread: Thread;
    dungeonThreads: Thread[];
    config: DungeonConfig;
    isStreaming: boolean;
    onSendMessage: (content: string) => void;
    onTriggerDM: () => void;
    onClearMessages: () => void;
    onStopGeneration: () => void;
    enterToSend: boolean;
    onSelectThread: (id: string) => void;
    onCreateThread: () => void;
    onUpdateConfig: (cfg: DungeonConfig) => void;
    appSettings: AppSettings; 
}

type Perspective = 'Gareth' | 'Ysaraith' | 'Table';

const DungeonOverlay: React.FC<DungeonOverlayProps> = ({
    isOpen, onClose, activeThread, dungeonThreads, config, isStreaming, onSendMessage, onTriggerDM, onClearMessages, onStopGeneration, enterToSend, onSelectThread, onCreateThread, onUpdateConfig, appSettings
}) => {
    // ... existing UI state ...
    const [input, setInput] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [perspective, setPerspective] = useState<Perspective>('Gareth');
    
    const [editDemeanorLabel, setEditDemeanorLabel] = useState(config.ysaraithDemeanorLabel);
    const [editDemeanorInfo, setEditDemeanorInfo] = useState(config.ysaraithDemeanorInfo);
    const [isDemeanorDirty, setIsDemeanorDirty] = useState(false);

    useEffect(() => {
        if (!isDemeanorDirty) {
            setEditDemeanorLabel(config.ysaraithDemeanorLabel);
            setEditDemeanorInfo(config.ysaraithDemeanorInfo);
        }
    }, [config, isDemeanorDirty]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    // VTT Hook - Global Settings
    const { isRecording, isTranscribing, error, startRecording, stopRecording, retry } = useTranscriber({
        mode: appSettings.vttMode || 'browser',
        model: appSettings.transcriptionModel || 'gpt-4o-mini-transcribe',
        apiKey: appSettings.vttMode === 'gemini' ? appSettings.apiKeyGemini : appSettings.apiKeyOpenAI,
        onInputUpdate: (text) => setInput(prev => prev + (prev ? ' ' : '') + text),
        onSend: (text) => onSendMessage(text),
        autoSend: appSettings.vttAutoSend || false
    });

    useEffect(() => {
        if (isOpen && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [activeThread.messages, isOpen]);

    useEffect(() => {
        if (isOpen && activeThread.messages.length === 0 && !isStreaming) {
            const t = setTimeout(() => onTriggerDM(), 500);
            return () => clearTimeout(t);
        }
    }, [isOpen]);

    const handleRollDice = () => {
        if (isStreaming) return;
        const rollStatement = "\n\n“I take the dice and make a roll for all my checks as indicated above in the legal sequence, up to and not beyond the rule limitation.”";
        setInput(prev => prev + rollStatement);
        const ta = document.getElementById('dungeon-textarea');
        if (ta) ta.focus();
    };

    // Smart Button Logic
    const handleSmartAction = () => {
        if (input.trim() && !isStreaming) {
            onSendMessage(input); 
            setInput('');
        } else if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // ... (Other handlers unchanged: handleDemeanorSelect, handleDemeanorInfoChange, handleSaveDemeanor, handleCancelDemeanor, parseContentForPerspective, getFontFamily, getMessageStyle) ...
    const handleDemeanorSelect = (label: string) => {
        const presetInfo = DEMEANOR_PRESETS[label as keyof typeof DEMEANOR_PRESETS];
        if (presetInfo) {
            setEditDemeanorLabel(label);
            setEditDemeanorInfo(presetInfo);
            setIsDemeanorDirty(true);
        } else if (label === 'Custom' || label === config.ysaraithDemeanorLabel) {
             setEditDemeanorLabel(label);
        }
    };

    const handleDemeanorInfoChange = (text: string) => {
        setEditDemeanorInfo(text);
        setIsDemeanorDirty(true);
        const isPreset = Object.keys(DEMEANOR_PRESETS).includes(editDemeanorLabel);
        if (isPreset && text !== DEMEANOR_PRESETS[editDemeanorLabel as keyof typeof DEMEANOR_PRESETS]) {
            setEditDemeanorLabel("New Setting 1");
        }
    };

    const handleSaveDemeanor = () => {
        onUpdateConfig({
            ...config,
            ysaraithDemeanorLabel: editDemeanorLabel,
            ysaraithDemeanorInfo: editDemeanorInfo
        });
        setIsDemeanorDirty(false);
    };

    const handleCancelDemeanor = () => {
        setEditDemeanorLabel(config.ysaraithDemeanorLabel);
        setEditDemeanorInfo(config.ysaraithDemeanorInfo);
        setIsDemeanorDirty(false);
    };

    const parseContentForPerspective = (content: string, role: string) => {
        if (role !== 'model') return content;
        if (!content.includes("Secret (")) return content;

        const parts = content.split(/(Secret \((?:Gareth|Ysaraith) only\):[\s\S]*?)(?=(?:Secret \(|Public|$))/gi);
        
        return parts.map((part) => {
            if (!part.trim()) return null;

            const isGarethSecret = part.startsWith("Secret (Gareth only):");
            const isYsaraithSecret = part.startsWith("Secret (Ysaraith only):");

            if (isGarethSecret) {
                if (perspective === 'Gareth') return part; 
                if (perspective === 'Ysaraith' || perspective === 'Table') return "\n\n*/Secret message to Gareth/*\n\n";
            }
            if (isYsaraithSecret) {
                if (perspective === 'Ysaraith') return part; 
                if (perspective === 'Gareth' || perspective === 'Table') return "\n\n*/Secret message to Ysaraith/*\n\n";
            }
            return part; 
        }).filter(Boolean).join('');
    };

    const getFontFamily = (url: string) => {
        if (!url) return '';
        const match = url.match(/family=([^&:]+)/);
        if (match && match[1]) return match[1].replace(/\+/g, ' ');
        return '';
    };

    const getMessageStyle = (speaker: 'DM' | 'Ysaraith' | 'User' | undefined, role: string) => {
        if (speaker === 'DM' || (!speaker && role === 'model' && !activeThread.messages.some(m => m.speaker === 'Ysaraith'))) {
            return { 
                fontFamily: config.dmFont, 
                color: config.dmColor, 
                fontSize: `${config.dmTextSize || 16}px` 
            };
        }
        if (speaker === 'Ysaraith' || (!speaker && role === 'model')) {
            const styles: React.CSSProperties = {
                color: appSettings.aiTextColor,
                fontFamily: getFontFamily(appSettings.aiTextFontUrl) || "'Playfair Display', serif",
                fontSize: `${appSettings.aiTextSize}px`,
                lineHeight: '1.6'
            };
            if (appSettings.aiTextStyle === 'shadow') styles.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
            else if (appSettings.aiTextStyle === 'outline') styles.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
            else if (appSettings.aiTextStyle === 'neon') styles.textShadow = `0 0 5px ${appSettings.aiTextColor}, 0 0 10px ${appSettings.aiTextColor}`;
            return styles;
        }
        return {
            color: appSettings.userTextColor,
            fontFamily: getFontFamily(appSettings.userTextFontUrl) || "'Inter', sans-serif",
            fontSize: `${appSettings.userTextSize}px`
        };
    };

    if (!isOpen) return null;

    const presetOptions = Object.keys(DEMEANOR_PRESETS);
    if (!presetOptions.includes(editDemeanorLabel)) {
        presetOptions.push(editDemeanorLabel);
    }

    return (
        <div className="fixed inset-0 z-[100] bg-[#050505] flex overflow-hidden animate-fadeIn font-serif text-gray-300">
            {/* Background ... */}
            <div className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none sepia contrast-125 transition-all duration-700" style={{ backgroundImage: `url(${config.backgroundImage})` }} />
            <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black pointer-events-none opacity-80" />

            {/* Left Sidebar ... */}
            <div className={`
                absolute md:relative z-40 w-64 bg-[#0a0a0a] border-r border-[#2a2a2a] h-full flex flex-col transition-transform duration-300
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:overflow-hidden'}
            `}>
                <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
                    <h3 className="font-bold text-gray-400 tracking-widest text-xs uppercase">Adventures</h3>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden"><X size={16}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {dungeonThreads.map(thread => (
                        <button
                            key={thread.id}
                            onClick={() => { onSelectThread(thread.id); setIsSidebarOpen(false); }}
                            className={`w-full text-left p-3 rounded text-xs font-serif truncate transition-colors ${activeThread.id === thread.id ? 'bg-red-900/30 text-red-200 border border-red-900/50' : 'text-gray-500 hover:bg-[#151515] hover:text-gray-300'}`}
                        >
                            {thread.title}
                        </button>
                    ))}
                </div>
                <div className="p-4 border-t border-[#2a2a2a]">
                    <button onClick={onCreateThread} className="w-full flex items-center justify-center gap-2 bg-[#151515] hover:bg-[#202020] text-gray-400 py-2 rounded text-xs uppercase tracking-wider transition-colors">
                        <Plus size={14} /> New Campaign
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col relative z-10 w-full">
                
                {/* Header ... */}
                <div className="h-16 border-b border-red-900/30 flex items-center justify-between px-4 bg-black/60 backdrop-blur-md shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-500 hover:text-white transition-colors">
                            <BookOpen size={20} />
                        </button>
                        <div className="flex items-center gap-2 text-gray-200">
                            <Skull size={20} className="text-red-900" />
                            <h2 className="font-serif font-bold tracking-[0.1em] text-sm md:text-base uppercase truncate max-w-[150px] md:max-w-md">{activeThread.title}</h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        {/* Perspective Toggle ... */}
                        <div className="hidden md:flex bg-black/50 rounded-full border border-gray-800 p-0.5">
                            {(['Gareth', 'Ysaraith', 'Table'] as const).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPerspective(p)}
                                    className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider transition-all ${perspective === p ? 'bg-red-900 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}
                                >
                                    {p === 'Gareth' ? 'Me' : p}
                                </button>
                            ))}
                        </div>
                        <button 
                            className="md:hidden p-2 text-gray-500" 
                            onClick={() => setPerspective(prev => prev === 'Gareth' ? 'Ysaraith' : prev === 'Ysaraith' ? 'Table' : 'Gareth')}
                        >
                            {perspective === 'Gareth' ? <Eye size={20}/> : perspective === 'Ysaraith' ? <Ghost size={20}/> : <Users size={20}/>}
                        </button>

                        <div className="h-6 w-px bg-gray-800 mx-2"></div>

                        <button onClick={() => setIsSettingsOpen(true)} className="text-gray-500 hover:text-white transition-colors">
                            <Settings size={20} />
                        </button>
                        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Messages ... */}
                <div className="flex-1 overflow-y-auto p-4 md:p-12 space-y-12 custom-scrollbar">
                    {activeThread.messages.map(msg => {
                        const isDM = msg.role === 'model' && (msg.speaker === 'DM' || msg.content.includes('IDENTITY: THE KEEPER'));
                        const isYsaraith = msg.role === 'model' && !isDM;
                        return (
                            <div key={msg.id} className={`flex flex-col ${msg.role === 'model' ? 'items-start' : 'items-end'} animate-fadeIn`}>
                                <div className={`max-w-4xl w-full ${msg.role === 'model' ? 'text-left' : 'text-right'}`}>
                                    <div className={`text-[10px] uppercase tracking-widest font-bold mb-2 flex items-center gap-2 ${msg.role === 'model' ? '' : 'justify-end'}`}>
                                        {isDM && <span className="text-red-700 flex items-center gap-1"><Skull size={12}/> The Keeper</span>}
                                        {isYsaraith && <span className="text-pink-400">Ysaraith</span>}
                                        {msg.role === 'user' && <span className="text-gray-500">Gareth</span>}
                                    </div>
                                    <div 
                                        className={`
                                            p-6 rounded-sm border shadow-2xl relative
                                            ${isDM ? 'bg-[#0a0a0a]/95 border-red-900/30' : ''}
                                            ${isYsaraith ? 'bg-[#1a1015]/90 border-pink-900/20' : ''}
                                            ${msg.role === 'user' ? 'bg-[#151515]/90 border-gray-800' : ''}
                                        `}
                                        style={getMessageStyle(msg.speaker, msg.role)}
                                    >
                                        <div className="prose prose-invert prose-p:font-serif prose-headings:font-serif max-w-none leading-relaxed whitespace-pre-wrap">
                                            <ReactMarkdown>
                                                {parseContentForPerspective(msg.content, msg.role)}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* CONTROLS (Updated with Smart Button) */}
                <div className="shrink-0 p-4 pb-6 z-20 relative bg-gradient-to-t from-black via-black/90 to-transparent">
                    <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 z-30">
                        <button 
                            onClick={isStreaming ? onStopGeneration : onTriggerDM}
                            className={`
                                flex items-center gap-3 px-6 py-2 rounded-full border shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all duration-500
                                ${isStreaming 
                                    ? 'bg-red-950/80 border-red-800 text-red-200 animate-pulse' 
                                    : 'bg-gray-900/70 border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white hover:border-gray-500'}
                            `}
                        >
                            {isStreaming ? <><StopCircle size={16} /><span className="text-xs font-bold uppercase tracking-widest">Stop Response</span></> : <><Skull size={16} /><span className="text-xs font-bold uppercase tracking-widest">DM Response</span></>}
                        </button>
                    </div>

                    <div className="max-w-4xl mx-auto flex items-end gap-3">
                        <button onClick={handleRollDice} className="p-3 rounded-full border border-gray-800 text-cerberus-accent hover:border-cerberus-accent hover:shadow-[0_0_15px_rgba(212,175,55,0.3)] bg-black/50 transition-all" title="Declare Roll">
                            <Dices size={20}/>
                        </button>
                        
                        <div className="flex-1 flex items-center gap-2 border-b border-gray-800 focus-within:border-red-900/50 transition-colors">
                            <textarea 
                                id="dungeon-textarea"
                                value={input} 
                                onChange={e => setInput(e.target.value)} 
                                placeholder={isTranscribing ? "Transcribing..." : "State your action..."}
                                className="flex-1 bg-transparent p-3 text-lg font-serif text-gray-300 focus:outline-none resize-none h-14 placeholder-gray-800"
                                disabled={isStreaming || isTranscribing}
                                onKeyDown={e => { if(e.key === 'Enter' && enterToSend && !e.shiftKey) { e.preventDefault(); handleSmartAction(); } }}
                            />
                            {/* SMART BUTTON */}
                            <button 
                                onClick={handleSmartAction}
                                className={`
                                    p-2 rounded-full transition-all duration-300 
                                    ${input.trim() 
                                        ? 'text-red-200 hover:text-white hover:bg-red-900/20' 
                                        : isRecording 
                                            ? 'text-red-500 animate-pulse' 
                                            : isTranscribing
                                                ? 'text-cerberus-accent animate-spin'
                                                : 'text-gray-600 hover:text-gray-300'
                                    }
                                `}
                            >
                                {input.trim() ? <Send size={24}/> : isTranscribing ? <RefreshCw size={24}/> : isRecording ? <MicOff size={24}/> : error ? <AlertCircle size={24} onClick={(e) => { e.stopPropagation(); retry(); }} /> : <Mic size={24}/>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Settings Drawer ... */}
            <div className={`
                absolute inset-y-0 right-0 z-50 w-80 bg-[#0a0a0a] border-l border-[#2a2a2a] transform transition-transform duration-300 flex flex-col
                ${isSettingsOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
                {/* ... existing settings drawer content ... */}
                <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
                    <h3 className="font-bold text-gray-200 font-serif tracking-widest uppercase">Table Rules</h3>
                    <button onClick={() => setIsSettingsOpen(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                    
                    <div className="space-y-3">
                        <label className="text-xs font-mono text-pink-400 uppercase tracking-widest">Ysaraith's Demeanor</label>
                        <div className="flex gap-2">
                            <input type="text" value={editDemeanorLabel} onChange={e => { setEditDemeanorLabel(e.target.value); setIsDemeanorDirty(true); }} className="flex-1 bg-[#151515] border border-gray-800 rounded p-2 text-sm text-gray-300 focus:border-pink-900 outline-none font-serif" placeholder="Setting Name"/>
                        </div>
                        <select value={editDemeanorLabel} onChange={e => handleDemeanorSelect(e.target.value)} className="w-full bg-[#151515] border border-gray-800 rounded p-2 text-xs text-gray-500 focus:border-pink-900 outline-none mb-2">
                            {presetOptions.map(p => (<option key={p} value={p}>{p}</option>))}
                        </select>
                        <textarea value={editDemeanorInfo} onChange={e => handleDemeanorInfoChange(e.target.value)} className="w-full h-32 bg-[#151515] border border-gray-800 rounded p-2 text-xs text-gray-400 focus:border-pink-900 outline-none resize-none custom-scrollbar" placeholder="Prompt instructions..."/>
                        {isDemeanorDirty && (
                            <div className="flex gap-2 animate-fadeIn">
                                <button onClick={handleSaveDemeanor} className="flex-1 py-2 bg-pink-900/20 text-pink-400 border border-pink-900/50 rounded text-[10px] uppercase font-bold flex items-center justify-center gap-1 hover:bg-pink-900/40"><Check size={12}/> Save</button>
                                <button onClick={handleCancelDemeanor} className="flex-1 py-2 bg-gray-800 text-gray-400 border border-gray-700 rounded text-[10px] uppercase font-bold flex items-center justify-center gap-1 hover:bg-gray-700"><RotateCcw size={12}/> Cancel</button>
                            </div>
                        )}
                        <p className="text-[9px] text-gray-600">Influences her autonomous actions and banter.</p>
                    </div>

                    <div className="space-y-3 pt-6 border-t border-[#2a2a2a]">
                        <label className="text-xs font-mono text-gray-400 uppercase tracking-widest">Environment Imagery</label>
                        <input type="text" value={config.backgroundImage} onChange={e => onUpdateConfig({...config, backgroundImage: e.target.value})} placeholder="Image URL..." className="w-full bg-[#151515] border border-gray-800 rounded p-2 text-xs text-gray-300 focus:border-gray-600 outline-none"/>
                        <div className="aspect-video w-full rounded border border-gray-800 overflow-hidden relative">
                            <img src={config.backgroundImage} className="w-full h-full object-cover opacity-50" />
                            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400">Preview</div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-6 border-t border-[#2a2a2a]">
                        <label className="text-xs font-mono text-red-900 uppercase tracking-widest">Keeper's Voice</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[9px] text-gray-600 mb-1">Color</label>
                                <input type="color" value={config.dmColor} onChange={e => onUpdateConfig({...config, dmColor: e.target.value})} className="w-full h-8 bg-transparent border border-gray-800 rounded cursor-pointer" />
                            </div>
                            <div>
                                <label className="block text-[9px] text-gray-600 mb-1">Font</label>
                                <select value={config.dmFont} onChange={e => onUpdateConfig({...config, dmFont: e.target.value})} className="w-full bg-[#151515] border border-gray-800 rounded h-8 text-xs text-gray-300">
                                    <option value="'Cinzel', serif">Cinzel</option>
                                    <option value="'Playfair Display', serif">Playfair</option>
                                    <option value="'Courier Prime', monospace">Typewriter</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[9px] text-gray-600 mb-1">Size ({config.dmTextSize || 16}px)</label>
                            <input type="range" min="12" max="24" step="1" value={config.dmTextSize || 16} onChange={e => onUpdateConfig({...config, dmTextSize: parseInt(e.target.value)})} className="w-full accent-red-900" />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-[#2a2a2a]">
                        <button onClick={() => { onClearMessages(); setIsSettingsOpen(false); }} className="w-full py-2 border border-red-900/30 text-red-900 hover:bg-red-900/10 hover:text-red-500 rounded text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors">
                            <Trash2 size={14} /> Clear Table
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DungeonOverlay;
