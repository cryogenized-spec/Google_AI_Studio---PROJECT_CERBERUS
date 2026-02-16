import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Image as ImageIcon, Settings, Wand2, RefreshCw, Download, Check, Layers, ChevronDown, ChevronUp, DollarSign, ArrowRight, Zap, Palette, Crop, Monitor, PlayCircle } from 'lucide-react';
import { AppSettings, ImageGenConfig, GeneratedImage, CharacterProfile, ImageIntentSpec } from '../types';
import { DEFAULT_IMAGE_GEN_CONFIG, IMAGE_STYLES } from '../constants';
import { expandImagePrompt, generateImages, estimateCost, interactWithWizard } from '../services/imageService';

interface TowerOfMirrorsProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    onUpdateSettings: (settings: Partial<AppSettings>) => void;
    character: CharacterProfile; // Context for wizard
}

type WizardMessage = { role: 'ai' | 'user'; content: string; options?: string[] };

const TowerOfMirrors: React.FC<TowerOfMirrorsProps> = ({ isOpen, onClose, settings, onUpdateSettings, character }) => {
    // Mode State
    const [mode, setMode] = useState<'quick' | 'wizard'>('quick');
    const [complexity, setComplexity] = useState<'basic' | 'advanced'>('basic');
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Configuration State
    const [config, setConfig] = useState<ImageGenConfig>(DEFAULT_IMAGE_GEN_CONFIG);
    const [userPrompt, setUserPrompt] = useState('');
    const [isAdvancedDrawerOpen, setIsAdvancedDrawerOpen] = useState(false);

    // Wizard State
    const [wizardHistory, setWizardHistory] = useState<WizardMessage[]>([]);
    const [wizardOptions, setWizardOptions] = useState<string[]>([]);
    const [wizardInput, setWizardInput] = useState('');
    const [intentSpec, setIntentSpec] = useState<ImageIntentSpec>({});
    const [isWizardThinking, setIsWizardThinking] = useState(false);
    const wizardScrollRef = useRef<HTMLDivElement>(null);

    // Gallery State
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

    // Init Wizard
    useEffect(() => {
        if (mode === 'wizard' && wizardHistory.length === 0) {
            startWizard();
        }
    }, [mode]);

    useEffect(() => {
        if (wizardScrollRef.current) {
            wizardScrollRef.current.scrollTop = wizardScrollRef.current.scrollHeight;
        }
    }, [wizardHistory, isWizardThinking]);

    const startWizard = async () => {
        setIsWizardThinking(true);
        const init: WizardMessage = { role: 'ai', content: "Connecting to the Aether... What kind of image would you like to create?" };
        setWizardHistory([init]);
        
        // Initial Call to get context-aware options based on nothing (start fresh)
        const response = await interactWithWizard([], "", {}, settings);
        
        setWizardHistory(prev => {
            const next = [...prev];
            next[0].content = response.question;
            return next;
        });
        setWizardOptions(response.options);
        setIsWizardThinking(false);
    };

    const handleWizardReply = async (reply: string) => {
        const newHistory: WizardMessage[] = [
            ...wizardHistory, 
            { role: 'user', content: reply }
        ];
        setWizardHistory(newHistory);
        setWizardInput('');
        setWizardOptions([]); // Clear options while thinking
        setIsWizardThinking(true);

        const response = await interactWithWizard(
            newHistory.map(m => ({ role: m.role, content: m.content })),
            "", // User input already in history
            intentSpec,
            settings
        );

        setIntentSpec(response.updatedSpec);
        setWizardHistory(prev => [
            ...prev,
            { role: 'ai', content: response.question }
        ]);
        setWizardOptions(response.options);
        
        if (response.isComplete) {
            // Auto-fill prompt field for generation
            const summary = `Subject: ${response.updatedSpec.subject || 'Unknown'}. ${response.updatedSpec.appearance || ''}. ${response.updatedSpec.pose || ''}. ${response.updatedSpec.setting || ''}. Mood: ${response.updatedSpec.mood || ''}. Style: ${response.updatedSpec.style || ''}`;
            setUserPrompt(summary);
        }
        
        setIsWizardThinking(false);
    };

    const handleGenerate = async () => {
        // Decide prompt source
        let finalPrompt = userPrompt;
        
        // If in wizard mode and prompt empty, construct from spec
        if (mode === 'wizard' && !finalPrompt.trim()) {
             finalPrompt = `Subject: ${intentSpec.subject || ''}. ${intentSpec.appearance || ''}. Action: ${intentSpec.pose || ''}. Setting: ${intentSpec.setting || ''}. Mood: ${intentSpec.mood || ''}. Style: ${intentSpec.style || ''}.`;
        }

        if (!finalPrompt.trim()) return;
        setIsGenerating(true);

        try {
            // 1. Enhance Prompt (Auto-Magic)
            const expandedPrompt = await expandImagePrompt(finalPrompt, config.stylePreset, settings);
            
            // 2. Generate
            const newImages = await generateImages({
                prompt: expandedPrompt,
                config: config,
                settings: settings,
                negativePrompt: config.negativePrompt || "bad anatomy, blurry, low quality, distorted, watermark, text"
            });

            setGeneratedImages(prev => [...newImages, ...prev]);
            if (newImages.length > 0) setSelectedImageId(newImages[0].id);

        } catch (e: any) {
            alert(`Generation Failed: ${e.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = (img: GeneratedImage) => {
        const link = document.createElement('a');
        link.href = img.url;
        link.download = `cerberus_tower_${img.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const activeImage = generatedImages.find(img => img.id === selectedImageId);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-cerberus-900 flex overflow-hidden animate-fadeIn font-sans text-gray-200">
            
            {/* LEFT: CONTROLS */}
            <div className="w-full md:w-[500px] flex flex-col border-r border-cerberus-800 bg-cerberus-900/95 backdrop-blur-md z-20">
                
                {/* Header */}
                <div className="p-4 border-b border-cerberus-800 flex justify-between items-center bg-black/20 shrink-0">
                    <h2 className="text-cerberus-accent font-serif tracking-widest text-lg flex items-center gap-2">
                        <Layers size={20}/> TOWER OF MIRRORS
                    </h2>
                    <div className="flex items-center gap-2">
                        <div className="flex bg-black/40 rounded border border-cerberus-800 p-0.5">
                            <button onClick={() => setComplexity('basic')} className={`px-2 py-1 text-[10px] uppercase font-bold rounded-sm transition-all ${complexity === 'basic' ? 'bg-cerberus-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Basic</button>
                            <button onClick={() => setComplexity('advanced')} className={`px-2 py-1 text-[10px] uppercase font-bold rounded-sm transition-all ${complexity === 'advanced' ? 'bg-cerberus-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Adv</button>
                        </div>
                        <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20}/></button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    
                    {/* Mode Tabs */}
                    <div className="flex border-b border-cerberus-800">
                        <button 
                            onClick={() => setMode('quick')}
                            className={`flex-1 py-3 text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-colors ${mode === 'quick' ? 'bg-cerberus-800/20 text-cerberus-accent border-b-2 border-cerberus-accent' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                        >
                            <Zap size={14} /> Quick Create
                        </button>
                        <button 
                            onClick={() => setMode('wizard')}
                            className={`flex-1 py-3 text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-colors ${mode === 'wizard' ? 'bg-indigo-900/10 text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                        >
                            <Sparkles size={14} /> AI Wizard
                        </button>
                    </div>

                    {/* Mode Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                        
                        {/* --- QUICK MODE --- */}
                        {mode === 'quick' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div className="space-y-2">
                                    <label className="text-xs font-mono text-cerberus-accent uppercase tracking-widest flex items-center gap-2">
                                        <Palette size={12}/> Vision
                                    </label>
                                    <textarea 
                                        value={userPrompt}
                                        onChange={e => setUserPrompt(e.target.value)}
                                        placeholder="Describe your desire... (e.g. 'A stoic female knight in silver armor, rain pouring')"
                                        className="w-full h-32 bg-black/50 border border-cerberus-700 rounded p-3 text-sm focus:border-cerberus-accent focus:outline-none resize-none placeholder-gray-600 focus:bg-black/80 transition-colors"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-mono text-cerberus-accent uppercase tracking-widest flex items-center gap-2">
                                        <Layers size={12}/> Style Preset
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {IMAGE_STYLES.map(style => (
                                            <div 
                                                key={style.id}
                                                onClick={() => setConfig({...config, stylePreset: style.id})}
                                                className={`p-2.5 rounded border cursor-pointer transition-all ${config.stylePreset === style.id ? 'bg-cerberus-800 border-cerberus-500 ring-1 ring-cerberus-500' : 'bg-black/30 border-cerberus-800 hover:border-gray-600 opacity-70 hover:opacity-100'}`}
                                            >
                                                <div className="text-xs font-bold text-white mb-0.5">{style.label}</div>
                                                <div className="text-[9px] text-gray-400 leading-tight line-clamp-2">{style.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- WIZARD MODE --- */}
                        {mode === 'wizard' && (
                            <div className="flex flex-col h-full animate-fadeIn">
                                {/* Chat Log */}
                                <div ref={wizardScrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
                                    {wizardHistory.map((msg, idx) => (
                                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] p-3 rounded-lg text-sm border ${msg.role === 'user' ? 'bg-cerberus-800/50 border-cerberus-700 text-gray-200' : 'bg-indigo-950/40 border-indigo-500/30 text-indigo-100'}`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    {isWizardThinking && (
                                        <div className="flex justify-start">
                                            <div className="bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 p-3 rounded-lg text-xs flex items-center gap-2">
                                                <RefreshCw size={12} className="animate-spin"/> Consulting the Oracle...
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Options & Input */}
                                <div className="space-y-3 shrink-0 bg-black/20 p-2 rounded border border-cerberus-800">
                                    {wizardOptions.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {wizardOptions.map((opt, i) => (
                                                <button 
                                                    key={i} 
                                                    onClick={() => handleWizardReply(opt)}
                                                    className="px-3 py-1.5 bg-indigo-900/40 border border-indigo-500/40 hover:bg-indigo-800 hover:border-indigo-400 rounded text-xs text-indigo-200 transition-all"
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                            <button onClick={() => handleWizardReply("Surprise me")} className="px-3 py-1.5 bg-gray-800 border border-gray-600 hover:bg-gray-700 rounded text-xs text-gray-400">Randomize</button>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <input 
                                            value={wizardInput}
                                            onChange={e => setWizardInput(e.target.value)}
                                            placeholder="Type custom reply..."
                                            className="flex-1 bg-black/50 border border-cerberus-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
                                            onKeyDown={e => e.key === 'Enter' && wizardInput.trim() && handleWizardReply(wizardInput)}
                                        />
                                        <button 
                                            onClick={() => wizardInput.trim() && handleWizardReply(wizardInput)}
                                            className="p-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded transition-colors"
                                        >
                                            <ArrowRight size={16}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Advanced Drawer (Collapsible) */}
                    {complexity === 'advanced' && (
                        <div className="border-t border-cerberus-800 bg-black/20">
                            <button 
                                onClick={() => setIsAdvancedDrawerOpen(!isAdvancedDrawerOpen)}
                                className="w-full flex justify-between items-center p-3 text-[10px] font-mono text-gray-400 hover:text-white uppercase tracking-wider bg-black/40 hover:bg-black/60 transition-colors"
                            >
                                <span className="flex items-center gap-2"><Settings size={12}/> Cockpit Controls</span>
                                {isAdvancedDrawerOpen ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
                            </button>
                            
                            {isAdvancedDrawerOpen && (
                                <div className="p-4 space-y-4 animate-fadeIn border-t border-cerberus-800/30 max-h-64 overflow-y-auto custom-scrollbar">
                                    
                                    {/* Prompts */}
                                    <div className="space-y-2">
                                        <label className="block text-[9px] text-gray-500 uppercase font-bold">Negative Prompt</label>
                                        <textarea 
                                            value={config.negativePrompt || ''}
                                            onChange={e => setConfig({...config, negativePrompt: e.target.value})}
                                            placeholder="What to exclude (e.g. blurry, text)..."
                                            className="w-full h-16 bg-cerberus-900 border border-cerberus-700 rounded p-2 text-xs outline-none focus:border-cerberus-500 resize-none text-gray-300"
                                        />
                                    </div>

                                    {/* Params Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[9px] text-gray-500 uppercase font-bold mb-1">Seed (0 = Random)</label>
                                            <input 
                                                type="number" 
                                                value={config.seed || 0}
                                                onChange={e => setConfig({...config, seed: parseInt(e.target.value)})}
                                                className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-xs outline-none focus:border-cerberus-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] text-gray-500 uppercase font-bold mb-1">Guidance (CFG)</label>
                                            <input 
                                                type="number" step="0.5"
                                                value={config.guidanceScale || 7.5}
                                                onChange={e => setConfig({...config, guidanceScale: parseFloat(e.target.value)})}
                                                className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-xs outline-none focus:border-cerberus-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Model Specifics */}
                                    <div>
                                        <label className="block text-[9px] text-gray-500 uppercase font-bold mb-1">Provider Model</label>
                                        <select 
                                            value={config.provider} 
                                            onChange={e => setConfig({...config, provider: e.target.value as any})}
                                            className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-xs outline-none focus:border-cerberus-500 mb-2"
                                        >
                                            <option value="google">Google (Imagen/Gemini)</option>
                                            <option value="openai">OpenAI (DALL-E 3)</option>
                                            <option value="xai">xAI (Grok - Beta)</option>
                                        </select>
                                        
                                        {/* Sub Model Selection */}
                                        {config.provider === 'google' && (
                                            <select 
                                                value={config.model || 'gemini-2.5-flash-image'}
                                                onChange={e => setConfig({...config, model: e.target.value})}
                                                className="w-full bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-xs outline-none focus:border-cerberus-500 mb-2"
                                            >
                                                <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image (Nano Banana)</option>
                                                <option value="gemini-3-pro-image-preview">Gemini 3 Pro Image (Nano Banana Pro)</option>
                                                <option value="imagen-3.0-generate-001">Imagen 3</option>
                                            </select>
                                        )}

                                        <div className="flex items-center gap-2">
                                            <select 
                                                value={config.resolution || 'standard'}
                                                onChange={e => setConfig({...config, resolution: e.target.value as any})}
                                                className="flex-1 bg-cerberus-900 border border-cerberus-700 rounded p-1.5 text-xs outline-none focus:border-cerberus-500"
                                            >
                                                <option value="standard">Standard Res</option>
                                                <option value="hd">HD / High Quality</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Shared Basic Controls (Footer area of scroll) */}
                    <div className="p-6 pt-0 space-y-4 mt-auto border-t border-cerberus-800 bg-black/20 pb-4">
                        <div className="pt-4 grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[9px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1"><Crop size={10}/> Ratio</label>
                                <select 
                                    value={config.aspectRatio} 
                                    onChange={e => setConfig({...config, aspectRatio: e.target.value as any})}
                                    className="w-full bg-black/50 border border-cerberus-700 rounded p-1.5 text-xs text-gray-300 outline-none focus:border-cerberus-500"
                                >
                                    <option value="1:1">Square (1:1)</option>
                                    <option value="3:4">Portrait (3:4)</option>
                                    <option value="9:16">Mobile (9:16)</option>
                                    <option value="16:9">Landscape (16:9)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[9px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1"><Monitor size={10}/> Count</label>
                                <div className="flex items-center gap-2 bg-black/50 border border-cerberus-700 rounded px-2">
                                    <input 
                                        type="range" min="1" max="4" step="1" 
                                        value={config.count} 
                                        onChange={e => setConfig({...config, count: parseInt(e.target.value)})}
                                        className="w-full accent-cerberus-accent h-6"
                                    />
                                    <span className="text-xs font-mono w-4">{config.count}</span>
                                </div>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <div>
                            <div className="flex justify-between items-center mb-1 text-[10px] text-gray-500 font-mono">
                                <span>{config.provider.toUpperCase()} // {config.model}</span>
                                <span className="flex items-center gap-1 text-green-500"><DollarSign size={10}/> Est: {estimateCost(config)}</span>
                            </div>
                            <button 
                                onClick={handleGenerate}
                                disabled={isGenerating || (mode === 'quick' && !userPrompt.trim())}
                                className={`w-full py-4 rounded font-serif font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all duration-300 ${isGenerating ? 'bg-cerberus-800 text-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-cerberus-700 to-cerberus-600 hover:from-cerberus-600 hover:to-cerberus-500 text-white shadow-[0_0_20px_rgba(155,44,44,0.4)] hover:shadow-[0_0_30px_rgba(155,44,44,0.6)]'}`}
                            >
                                {isGenerating ? <><RefreshCw size={18} className="animate-spin"/> Weaving...</> : <><Wand2 size={18}/> Manifest Vision</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT: GALLERY */}
            <div className="flex-1 bg-black/80 flex flex-col relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cerberus-900/50 via-black to-black opacity-80 pointer-events-none" />
                
                {generatedImages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-cerberus-800 opacity-30 select-none pointer-events-none p-8 text-center">
                        <ImageIcon size={64} className="mb-4" />
                        <p className="font-serif text-2xl tracking-widest mb-2">THE MIRROR IS DARK</p>
                        <p className="font-mono text-xs max-w-md">"Describe your vision or consult the wizard to pierce the veil."</p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col h-full z-10">
                        {/* Main View */}
                        <div className="flex-1 flex items-center justify-center p-8 bg-black/40 relative">
                            {activeImage && (
                                <img 
                                    src={activeImage.url} 
                                    alt={activeImage.prompt} 
                                    className="max-h-full max-w-full object-contain rounded shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-cerberus-900"
                                />
                            )}
                            {/* Overlay Controls for Active Image */}
                            {activeImage && (
                                <div className="absolute bottom-8 right-8 flex gap-2">
                                    <button 
                                        onClick={() => handleDownload(activeImage)}
                                        className="p-3 bg-black/60 hover:bg-cerberus-600 text-white rounded-full backdrop-blur-md border border-white/10 transition-colors"
                                        title="Download"
                                    >
                                        <Download size={20}/>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Thumbnail Strip */}
                        <div className="h-32 bg-cerberus-900/80 border-t border-cerberus-800 overflow-x-auto flex items-center p-4 gap-4 custom-scrollbar shrink-0">
                            {generatedImages.map(img => (
                                <div 
                                    key={img.id}
                                    onClick={() => setSelectedImageId(img.id)}
                                    className={`shrink-0 h-24 aspect-square rounded overflow-hidden cursor-pointer border-2 transition-all ${selectedImageId === img.id ? 'border-cerberus-accent scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                >
                                    <img src={img.url} className="w-full h-full object-cover" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TowerOfMirrors;