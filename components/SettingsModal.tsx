
import React, { useState } from 'react';
import { AppSettings, DeepLogicConfig } from '../types';
import { 
    Shield, Key, X, Sliders, Monitor, Palette, 
    BrainCircuit, Activity, Wand2, Terminal, User, 
    Lock, Mic, Type, Zap, Image, Github, Power, Bell, LockIcon,
    FastForward, Gauge
} from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean; 
    settings: AppSettings;
    onClose: () => void;
    onUpdateSettings: (settings: Partial<AppSettings>) => void;
    setIsKeyManagerOpen: (open: boolean) => void;
    deepLogic?: DeepLogicConfig;
    onUpdateDeepLogic?: (dl: Partial<DeepLogicConfig>) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, // Added isOpen here
    settings, onClose, onUpdateSettings, setIsKeyManagerOpen, deepLogic, onUpdateDeepLogic 
}) => {
    const [activeTab, setActiveTab] = useState<'general' | 'intelligence' | 'visuals' | 'voice' | 'system'>('general');

    const update = (updates: Partial<AppSettings>) => {
        onUpdateSettings({ ...settings, ...updates });
    };

    const updateDL = (updates: Partial<DeepLogicConfig>) => {
        if (onUpdateDeepLogic) onUpdateDeepLogic(updates);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl flex flex-col animate-fadeIn text-gray-200 font-sans">
            {/* Header */}
            <div className="h-16 px-6 border-b border-cerberus-800 flex justify-between items-center bg-cerberus-900/80 z-30 shrink-0">
                <div className="flex items-center gap-3">
                    <Sliders size={20} className="text-cerberus-accent"/>
                    <h1 className="text-lg font-serif text-white tracking-widest font-bold">SYSTEM CONFIGURATION</h1>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-cerberus-800 rounded text-gray-400 hover:text-white transition-colors">
                    <X size={20}/>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-cerberus-800 px-6 bg-black/40 overflow-x-auto no-scrollbar">
                {[
                    { id: 'general', label: 'Personality', icon: User },
                    { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
                    { id: 'visuals', label: 'Visuals', icon: Palette },
                    { id: 'voice', label: 'Voice', icon: Mic },
                    { id: 'system', label: 'System Core', icon: Terminal },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                            activeTab === tab.id 
                                ? 'border-cerberus-accent text-cerberus-accent bg-cerberus-900/50' 
                                : 'border-transparent text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-cerberus-void">
                <div className="max-w-3xl mx-auto space-y-8 pb-20">
                    
                    {/* --- GENERAL / PERSONALITY --- */}
                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-fadeIn">
                            {/* User Identity */}
                            <section className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2 mb-4">User Identity</h3>
                                <div className="grid gap-4">
                                    <div>
                                        <label className="block text-[10px] text-gray-400 uppercase mb-1">Your Name</label>
                                        <input 
                                            value={settings.userName}
                                            onChange={e => update({ userName: e.target.value })}
                                            className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-3 text-sm text-white focus:border-cerberus-accent outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-400 uppercase mb-1">User Description (Appearance/Context)</label>
                                        <textarea 
                                            value={settings.userDescription}
                                            onChange={e => update({ userDescription: e.target.value })}
                                            className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-3 text-sm text-white focus:border-cerberus-accent outline-none h-24 resize-none"
                                            placeholder="How you appear to the entity..."
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Roleplay Settings */}
                            <section className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2 mb-4">Narrative Engine</h3>
                                
                                <div className="space-y-6">
                                    <div>
                                        <label className="flex justify-between text-[10px] text-gray-400 uppercase mb-1">
                                            <span>Roleplay Adherence</span>
                                            <span className="text-cerberus-accent">{settings.roleplayIntensity}%</span>
                                        </label>
                                        <input 
                                            type="range" min="0" max="100" 
                                            value={settings.roleplayIntensity}
                                            onChange={e => update({ roleplayIntensity: parseInt(e.target.value) })}
                                            className="w-full accent-cerberus-accent"
                                        />
                                        <p className="text-[10px] text-gray-600 mt-1">Higher values force strict character consistency. Lower values allow more casual breaks.</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] text-gray-400 uppercase mb-1">Writing Style</label>
                                            <select 
                                                value={settings.writingStyle} 
                                                onChange={e => update({ writingStyle: e.target.value })}
                                                className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white"
                                            >
                                                <option value="cinematic">Cinematic (Visual)</option>
                                                <option value="conversational">Conversational (Casual)</option>
                                                <option value="noir">Noir (Dark/Internal)</option>
                                                <option value="poetic">Poetic (Flowery)</option>
                                                <option value="direct">Direct (Action-Oriented)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-gray-400 uppercase mb-1">Formatting</label>
                                            <select 
                                                value={settings.formattingStyle} 
                                                onChange={e => update({ formattingStyle: e.target.value })}
                                                className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white"
                                            >
                                                <option value="standard">Standard</option>
                                                <option value="asterisks">Asterisk Actions (*nods*)</option>
                                                <option value="novel">Novel Style ("Quotes")</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between p-3 bg-cerberus-900 rounded border border-cerberus-800">
                                        <span className="text-xs text-gray-300">Send on Enter</span>
                                        <input 
                                            type="checkbox" 
                                            checked={settings.enterToSend}
                                            onChange={e => update({ enterToSend: e.target.checked })}
                                            className="accent-cerberus-accent w-4 h-4"
                                        />
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {/* --- INTELLIGENCE / API --- */}
                    {activeTab === 'intelligence' && (
                        <div className="space-y-8 animate-fadeIn">
                            
                            {/* Keys & Provider */}
                            <section className="bg-cerberus-900/50 p-6 rounded-lg border border-cerberus-800">
                                <h3 className="text-sm font-bold text-cerberus-accent uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Key size={16}/> Provider & Credentials
                                </h3>
                                
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">Active Intelligence Provider</label>
                                        <div className="flex bg-black rounded p-1 border border-cerberus-800">
                                            <button 
                                                onClick={() => update({ activeProvider: 'gemini' })}
                                                className={`flex-1 py-2 text-xs font-bold uppercase rounded transition-all ${settings.activeProvider === 'gemini' ? 'bg-cerberus-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                                            >
                                                Google Gemini
                                            </button>
                                            <button 
                                                onClick={() => update({ activeProvider: 'grok' })}
                                                className={`flex-1 py-2 text-xs font-bold uppercase rounded transition-all ${settings.activeProvider === 'grok' ? 'bg-cerberus-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                                            >
                                                xAI Grok
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-black/30 p-4 rounded border border-cerberus-800 flex items-center justify-between">
                                        <div className="text-xs text-gray-400">
                                            <div className="font-bold text-gray-300 mb-1">API Keys & Security</div>
                                            Manage your connection credentials securely.
                                        </div>
                                        <button 
                                            onClick={() => setIsKeyManagerOpen(true)}
                                            className="px-4 py-2 bg-cerberus-800 hover:bg-cerberus-700 text-white rounded text-xs font-bold uppercase border border-cerberus-600 transition-colors"
                                        >
                                            Manage Keys
                                        </button>
                                    </div>
                                </div>
                            </section>

                            {/* Model Config */}
                            <section className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2 mb-4">Model Configuration</h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] text-gray-400 uppercase mb-1">Active Model</label>
                                        {settings.activeProvider === 'gemini' ? (
                                            <select value={settings.modelGemini} onChange={e => update({ modelGemini: e.target.value })} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white">
                                                <option value="gemini-3-pro-preview">Gemini 3 Pro Preview (Complex Logic)</option>
                                                <option value="gemini-3-flash-preview">Gemini 3 Flash Preview (Speed)</option>
                                                <option value="gemini-2.5-flash-latest">Gemini 2.5 Flash</option>
                                            </select>
                                        ) : (
                                            <select value={settings.modelGrok} onChange={e => update({ modelGrok: e.target.value })} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white">
                                                <option value="grok-beta">Grok Beta</option>
                                                <option value="grok-vision-beta">Grok Vision Beta</option>
                                            </select>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] text-gray-400 uppercase mb-1">Temperature ({settings.temperature})</label>
                                            <input type="range" min="0" max="2" step="0.1" value={settings.temperature} onChange={e => update({ temperature: parseFloat(e.target.value) })} className="w-full accent-cerberus-accent"/>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-gray-400 uppercase mb-1">Max Output Tokens</label>
                                            <input type="number" value={settings.maxOutputTokens} onChange={e => update({ maxOutputTokens: parseInt(e.target.value) })} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white"/>
                                        </div>
                                    </div>

                                    {/* Thinking Budget (Gemini Only) */}
                                    {settings.activeProvider === 'gemini' && (
                                        <div>
                                            <label className="flex justify-between text-[10px] text-gray-400 uppercase mb-1">
                                                <span>Thinking Budget (Chain of Thought)</span>
                                                <span className="text-cerberus-accent">{settings.thinkingBudgetPercentage || 0}% of Max Tokens</span>
                                            </label>
                                            <input 
                                                type="range" min="0" max="50" step="5" 
                                                value={settings.thinkingBudgetPercentage || 0}
                                                onChange={e => update({ thinkingBudgetPercentage: parseInt(e.target.value) })}
                                                className="w-full accent-blue-500"
                                            />
                                            <p className="text-[9px] text-gray-500">Reserves token space for internal reasoning. Higher values improve complex logic but reduce response length.</p>
                                        </div>
                                    )}

                                    {/* Advanced Params (Restored) */}
                                    <details className="bg-black/20 border border-cerberus-800 rounded p-3 group">
                                        <summary className="text-[10px] text-gray-500 uppercase font-bold cursor-pointer group-hover:text-cerberus-accent flex items-center gap-2">
                                            <Gauge size={12}/> Advanced Model Parameters
                                        </summary>
                                        <div className="space-y-4 pt-4 animate-fadeIn">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[9px] text-gray-500 uppercase mb-1">Top K</label>
                                                    <input type="number" value={settings.topK} onChange={e => update({ topK: parseInt(e.target.value) })} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white"/>
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] text-gray-500 uppercase mb-1">Token Target (Length Guide)</label>
                                                    <input type="number" value={settings.tokenTarget} onChange={e => update({ tokenTarget: parseInt(e.target.value) })} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white"/>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[9px] text-gray-500 uppercase mb-1">Presence Penalty</label>
                                                    <input type="number" step="0.1" value={settings.presencePenalty} onChange={e => update({ presencePenalty: parseFloat(e.target.value) })} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white"/>
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] text-gray-500 uppercase mb-1">Frequency Penalty</label>
                                                    <input type="number" step="0.1" value={settings.frequencyPenalty} onChange={e => update({ frequencyPenalty: parseFloat(e.target.value) })} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white"/>
                                                </div>
                                            </div>
                                        </div>
                                    </details>

                                    <div>
                                        <label className="block text-[10px] text-gray-400 uppercase mb-1">Safety Filter Level</label>
                                        <select value={settings.safetyLevel} onChange={e => update({ safetyLevel: e.target.value as any })} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white">
                                            <option value="strict">Strict</option>
                                            <option value="standard">Standard</option>
                                            <option value="off">Unrestricted (Use with caution)</option>
                                        </select>
                                    </div>
                                </div>
                            </section>

                            {/* Magic Input */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 border-b border-gray-800 pb-2 mb-4">
                                    <Wand2 size={14} className="text-violet-400"/>
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Magic Enhancements</h3>
                                </div>
                                <div className="space-y-4 pl-2">
                                    <label className="flex items-center justify-between">
                                        <span className="text-xs text-gray-300">Enable Magic Processing</span>
                                        <input type="checkbox" checked={settings.magicInput?.enabled} onChange={e => update({ magicInput: { ...settings.magicInput, enabled: e.target.checked } })} className="accent-violet-500"/>
                                    </label>
                                    {settings.magicInput?.enabled && (
                                        <>
                                            <div>
                                                <label className="block text-[10px] text-gray-400 uppercase mb-1">Processing Mode</label>
                                                <select 
                                                    value={settings.magicInput.outputMode} 
                                                    onChange={e => update({ magicInput: { ...settings.magicInput, outputMode: e.target.value as any } })}
                                                    className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white"
                                                >
                                                    <option value="roleplay">Immersive Rewrite</option>
                                                    <option value="cleaned">Grammar & Cleanup</option>
                                                    <option value="verbatim">Verbatim (Bypass)</option>
                                                </select>
                                            </div>
                                            <label className="flex items-center justify-between">
                                                <span className="text-xs text-gray-300">Enable D&D 5e Logic</span>
                                                <input type="checkbox" checked={settings.magicInput?.enableDndRules} onChange={e => update({ magicInput: { ...settings.magicInput, enableDndRules: e.target.checked } })} className="accent-violet-500"/>
                                            </label>
                                        </>
                                    )}
                                </div>
                            </section>
                        </div>
                    )}

                    {/* --- VISUALS --- */}
                    {activeTab === 'visuals' && (
                        <div className="space-y-8 animate-fadeIn">
                            
                            <section className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2 mb-4">Environment & Interface</h3>
                                
                                <div>
                                    <label className="flex justify-between text-[10px] text-gray-400 uppercase mb-1">
                                        <span>Background Brightness</span>
                                        <span>{settings.bgBrightness}%</span>
                                    </label>
                                    <input 
                                        type="range" min="0" max="100" 
                                        value={settings.bgBrightness}
                                        onChange={e => update({ bgBrightness: parseInt(e.target.value) })}
                                        className="w-full accent-cerberus-accent"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] text-gray-400 uppercase mb-1">Portrait Scale</label>
                                        <input 
                                            type="number" step="0.1" min="0.5" max="2" 
                                            value={settings.portraitScale}
                                            onChange={e => update({ portraitScale: parseFloat(e.target.value) })}
                                            className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-400 uppercase mb-1">Portrait Aspect</label>
                                        <select 
                                            value={settings.portraitAspectRatio}
                                            onChange={e => update({ portraitAspectRatio: e.target.value as any })}
                                            className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white"
                                        >
                                            <option value="4/5">4:5 (Standard)</option>
                                            <option value="9/16">9:16 (Tall)</option>
                                            <option value="1/1">1:1 (Square)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <span className="text-xs text-gray-300 flex items-center gap-2"><FastForward size={14}/> Fast Boot (Skip Intro)</span>
                                    <input 
                                        type="checkbox" 
                                        checked={settings.fastBoot} 
                                        onChange={e => update({ fastBoot: e.target.checked })} 
                                        className="accent-cerberus-accent w-4 h-4"
                                    />
                                </div>
                            </section>

                            <section className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2 mb-4 flex items-center gap-2"><Type size={14}/> Typography</h3>
                                
                                {/* AI Text */}
                                <div className="p-3 bg-cerberus-900/50 rounded border border-cerberus-800 space-y-3">
                                    <label className="text-[10px] font-bold text-cerberus-accent uppercase">Character Text</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[9px] text-gray-500 uppercase mb-1">Color</label>
                                            <input type="color" value={settings.aiTextColor} onChange={e => update({ aiTextColor: e.target.value })} className="w-full h-8 bg-transparent border border-cerberus-800 rounded"/>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] text-gray-500 uppercase mb-1">Size ({settings.aiTextSize}px)</label>
                                            <input type="number" value={settings.aiTextSize} onChange={e => update({ aiTextSize: parseInt(e.target.value) })} className="w-full bg-black border border-cerberus-800 rounded p-1 text-xs text-white"/>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] text-gray-500 uppercase mb-1">Google Font URL</label>
                                        <input value={settings.aiTextFontUrl} onChange={e => update({ aiTextFontUrl: e.target.value })} placeholder="https://fonts.googleapis.com/css2?family=..." className="w-full bg-black border border-cerberus-800 rounded p-2 text-xs text-gray-400 font-mono"/>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] text-gray-500 uppercase mb-1">Effect</label>
                                        <select value={settings.aiTextStyle} onChange={e => update({ aiTextStyle: e.target.value as any })} className="w-full bg-black border border-cerberus-800 rounded p-2 text-xs text-white">
                                            <option value="none">None</option>
                                            <option value="shadow">Shadow</option>
                                            <option value="outline">Outline</option>
                                            <option value="neon">Neon Glow</option>
                                        </select>
                                    </div>
                                </div>

                                {/* User Text */}
                                <div className="p-3 bg-cerberus-900/50 rounded border border-cerberus-800 space-y-3">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">User Text</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[9px] text-gray-500 uppercase mb-1">Color</label>
                                            <input type="color" value={settings.userTextColor} onChange={e => update({ userTextColor: e.target.value })} className="w-full h-8 bg-transparent border border-cerberus-800 rounded"/>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] text-gray-500 uppercase mb-1">Size ({settings.userTextSize}px)</label>
                                            <input type="number" value={settings.userTextSize} onChange={e => update({ userTextSize: parseInt(e.target.value) })} className="w-full bg-black border border-cerberus-800 rounded p-1 text-xs text-white"/>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {/* --- VOICE --- */}
                    {activeTab === 'voice' && (
                        <div className="space-y-8 animate-fadeIn">
                            <section className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-800 pb-2 mb-4">Speech Recognition (STT)</h3>
                                
                                <div>
                                    <label className="block text-[10px] text-gray-400 uppercase mb-1">Engine</label>
                                    <select value={settings.vttMode} onChange={e => update({ vttMode: e.target.value as any })} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white">
                                        <option value="browser">Browser Native (Free/Fast)</option>
                                        <option value="openai">OpenAI Whisper (High Accuracy)</option>
                                        <option value="gemini">Gemini Flash (Multimodal)</option>
                                    </select>
                                </div>

                                {settings.vttMode === 'openai' && (
                                    <div className="animate-fadeIn">
                                        <label className="block text-[10px] text-gray-400 uppercase mb-1">Whisper Model ID</label>
                                        <input 
                                            value={settings.transcriptionModel} 
                                            onChange={e => update({ transcriptionModel: e.target.value })} 
                                            className="w-full bg-black border border-cerberus-800 rounded p-2 text-xs text-white placeholder-gray-600" 
                                            placeholder="whisper-1"
                                        />
                                    </div>
                                )}

                                {settings.vttMode !== 'browser' && (
                                    <div className="p-3 bg-blue-900/20 border border-blue-900/50 rounded text-xs text-blue-200">
                                        Note: {settings.vttMode === 'openai' ? 'OpenAI' : 'Gemini'} API key required in Intelligence tab.
                                    </div>
                                )}

                                <div className="flex items-center justify-between p-3 bg-cerberus-900 rounded border border-cerberus-800">
                                    <span className="text-xs text-gray-300">Auto-Send on Silence</span>
                                    <input 
                                        type="checkbox" 
                                        checked={settings.vttAutoSend}
                                        onChange={e => update({ vttAutoSend: e.target.checked })}
                                        className="accent-cerberus-accent w-4 h-4"
                                    />
                                </div>
                            </section>
                        </div>
                    )}

                    {/* --- SYSTEM & DEEP LOGIC --- */}
                    {activeTab === 'system' && (
                        <div className="space-y-8 animate-fadeIn">
                            
                            {/* Github Backup */}
                            <section className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-cerberus-800 pb-2 mb-4 flex items-center gap-2"><Github size={14}/> Cloud Backup (GitHub)</h3>
                                <div className="space-y-3">
                                    <input 
                                        type="password" 
                                        placeholder="GitHub Token"
                                        value={settings.githubToken}
                                        onChange={e => update({ githubToken: e.target.value })}
                                        className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white"
                                    />
                                    <div className="flex gap-2">
                                        <input 
                                            placeholder="Owner (User/Org)"
                                            value={settings.githubOwner}
                                            onChange={e => update({ githubOwner: e.target.value })}
                                            className="flex-1 bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white"
                                        />
                                        <input 
                                            placeholder="Repository"
                                            value={settings.githubRepo}
                                            onChange={e => update({ githubRepo: e.target.value })}
                                            className="flex-1 bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Deep Logic Config */}
                            {deepLogic && onUpdateDeepLogic && (
                                <section className="space-y-4">
                                    <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest border-b border-red-900/30 pb-2 mb-4 flex items-center gap-2"><Power size={14}/> Deep Logic Core</h3>
                                    
                                    <div className="p-4 bg-red-950/10 border border-red-900/30 rounded space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-red-200">Simulation Mode (No Execution)</span>
                                            <input 
                                                type="checkbox" 
                                                checked={deepLogic.simulationMode}
                                                onChange={e => updateDL({ simulationMode: e.target.checked })}
                                                className="accent-red-500 w-4 h-4"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-red-200 flex items-center gap-2"><LockIcon size={12}/> Kill Switch (Stop All Agents)</span>
                                            <input 
                                                type="checkbox" 
                                                checked={deepLogic.killSwitch}
                                                onChange={e => updateDL({ killSwitch: e.target.checked })}
                                                className="accent-red-500 w-4 h-4"
                                            />
                                        </div>
                                        
                                        <div className="pt-2 border-t border-red-900/30">
                                            <label className="block text-[10px] text-red-400 uppercase mb-2">Notification Channel (NTFY)</label>
                                            <div className="flex items-center gap-2 mb-2">
                                                <input 
                                                    placeholder="Topic ID"
                                                    value={deepLogic.secrets?.ntfyTopic || ''}
                                                    onChange={e => updateDL({ secrets: { ...deepLogic.secrets, ntfyTopic: e.target.value, sheetId: deepLogic.secrets?.sheetId || '' } })}
                                                    className="flex-1 bg-black/50 border border-red-900/30 rounded p-2 text-xs text-white"
                                                />
                                                <input 
                                                    type="checkbox" 
                                                    checked={deepLogic.channels?.ntfy}
                                                    onChange={e => updateDL({ channels: { ...deepLogic.channels, ntfy: e.target.checked } })}
                                                    className="accent-red-500 w-4 h-4"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Image Models */}
                            <section className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-cerberus-800 pb-2 mb-4 flex items-center gap-2"><Image size={14}/> Image Generation</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] text-gray-400 uppercase mb-1">Google Model</label>
                                        <input value={settings.imageModelGoogle} onChange={e => update({ imageModelGoogle: e.target.value })} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white"/>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-400 uppercase mb-1">OpenAI Model</label>
                                        <input value={settings.imageModelOpenAI} onChange={e => update({ imageModelOpenAI: e.target.value })} className="w-full bg-cerberus-900 border border-cerberus-800 rounded p-2 text-xs text-white"/>
                                    </div>
                                </div>
                            </section>

                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
