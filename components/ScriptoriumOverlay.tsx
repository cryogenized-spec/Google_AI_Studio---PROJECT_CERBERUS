import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, MicOff, Send, Settings, Terminal, CheckCircle, Clock, Star, Layout, MessageSquare, Brain, Pin, Trash2, Edit2, MoreVertical, Bell, Radio } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message, ScriptoriumConfig, MemoryCard, ScriptoriumItem } from '../types';
import { fetchActiveMemories, fetchOpenScriptoriumItems, saveScriptoriumItem, saveMemory, updateScriptoriumItem, updateMemory } from '../services/firebaseService';

interface ScriptoriumOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    messages: Message[];
    config: ScriptoriumConfig;
    isStreaming: boolean;
    onSendMessage: (content: string) => void;
    onUpdateConfig: (newConfig: ScriptoriumConfig) => void;
    onClearMessages: () => void;
    onStopGeneration: () => void;
    enterToSend: boolean;
    onManualPing: () => void;
}

const ScriptoriumOverlay: React.FC<ScriptoriumOverlayProps> = ({
    isOpen, onClose, messages, config, isStreaming, onSendMessage, onUpdateConfig, onClearMessages, onStopGeneration, enterToSend, onManualPing
}) => {
    const [view, setView] = useState<'chat' | 'board' | 'memories'>('chat');
    
    // Chat State
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);
    const baseInputRef = useRef(''); 

    // Board/Memory State
    const [items, setItems] = useState<ScriptoriumItem[]>([]);
    const [memories, setMemories] = useState<MemoryCard[]>([]);
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [newItemTitle, setNewItemTitle] = useState('');

    // Menu State
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadBoardData();
        }
    }, [isOpen, view]);

    useEffect(() => {
        if (view === 'chat') {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, view, isOpen]);

    const loadBoardData = async () => {
        const i = await fetchOpenScriptoriumItems();
        const m = await fetchActiveMemories();
        setItems(i);
        setMemories(m);
    };

    const handleCreateItem = async () => {
        if (!newItemTitle.trim()) return;
        await saveScriptoriumItem({ title: newItemTitle, status: 'open', priority: 3, type: 'note' });
        setNewItemTitle('');
        setIsAddingItem(false);
        loadBoardData();
    };

    const toggleItemStatus = async (id: string, current: 'open' | 'done' | 'snoozed') => {
        const newStatus = current === 'done' ? 'open' : 'done';
        await updateScriptoriumItem(id, { status: newStatus });
        loadBoardData();
    };

    const handlePinMemory = async (id: string, currentTtl: number | null) => {
        const newTtl = currentTtl === null ? 30 : null; // Toggle pin
        await updateMemory(id, { ttlDays: newTtl });
        loadBoardData();
    };

    const handlePingClick = () => {
        setIsMenuOpen(false);
        if (confirm("Initiate forced wake cycle and notification push?")) {
            onManualPing();
        }
    };

    // VTT Logic
    const toggleRecording = () => {
        if (isRecording) {
            if (recognitionRef.current) recognitionRef.current.stop();
            setIsRecording(false);
        } else {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (!SpeechRecognition) return alert("Voice recognition not supported.");
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            baseInputRef.current = input;
            recognition.onstart = () => setIsRecording(true);
            recognition.onend = () => setIsRecording(false);
            recognition.onresult = (event: any) => {
                const sessionTranscript = Array.from(event.results).map((res: any) => res[0].transcript).join('');
                const spacer = (baseInputRef.current && !baseInputRef.current.endsWith(' ')) ? ' ' : '';
                setInput(baseInputRef.current + spacer + sessionTranscript);
            };
            recognitionRef.current = recognition;
            recognition.start();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-cerberus-900 flex flex-col animate-fadeIn font-sans">
            
            {/* Background */}
            <div className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none grayscale contrast-125" style={{ backgroundImage: `url(${config.backgroundImage})` }} />

            {/* Header */}
            <div className="relative shrink-0 h-16 bg-cerberus-900/95 border-b border-cerberus-700 flex items-center justify-between px-4 z-20 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <h2 className="text-cerberus-accent font-serif font-bold tracking-widest text-lg">EBON SCRIPTORIUM</h2>
                        <div className="flex gap-4 text-[10px] font-mono tracking-wider">
                            <button onClick={() => setView('chat')} className={`${view === 'chat' ? 'text-white underline' : 'text-gray-500'}`}>COMMUNICATIONS</button>
                            <button onClick={() => setView('board')} className={`${view === 'board' ? 'text-white underline' : 'text-gray-500'}`}>TASK BOARD</button>
                            <button onClick={() => setView('memories')} className={`${view === 'memories' ? 'text-white underline' : 'text-gray-500'}`}>MNEMOSYNE</button>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    {/* System Menu Dropdown */}
                    <div className="relative">
                        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-gray-400 hover:text-white rounded hover:bg-cerberus-800">
                            <MoreVertical size={20} />
                        </button>
                        
                        {isMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setIsMenuOpen(false)} />
                                <div className="absolute right-0 top-full mt-2 w-48 bg-cerberus-900 border border-cerberus-700 rounded shadow-xl z-40 overflow-hidden animate-fadeIn">
                                    <div className="p-2 border-b border-cerberus-800 text-[10px] font-mono text-gray-500 uppercase tracking-wider">System Operations</div>
                                    <button 
                                        onClick={handlePingClick} 
                                        className="w-full text-left px-4 py-3 text-xs text-gray-300 hover:bg-cerberus-800 hover:text-white flex items-center gap-2"
                                    >
                                        <Bell size={14} className="text-cerberus-accent" />
                                        Force Ping (NTFY)
                                    </button>
                                    <button 
                                        onClick={() => { onClearMessages(); setIsMenuOpen(false); }} 
                                        className="w-full text-left px-4 py-3 text-xs text-red-400 hover:bg-red-900/20 hover:text-red-300 flex items-center gap-2"
                                    >
                                        <Trash2 size={14} />
                                        Clear Console
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={24} /></button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden relative z-10">
                
                {/* CHAT VIEW */}
                {view === 'chat' && (
                    <div className="flex-1 flex flex-col bg-transparent relative">
                         <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.role === 'model' ? 'justify-start' : 'justify-end'}`}>
                                    <div className={`max-w-[80%] rounded-lg p-3 relative shadow-md border ${msg.role === 'model' ? 'bg-cerberus-800 border-cerberus-700 text-gray-200' : 'bg-cerberus-600 border-cerberus-500 text-white'}`}>
                                        <div className="text-sm prose prose-invert max-w-none leading-snug break-words">
                                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                         </div>
                         <div className="shrink-0 p-4 bg-cerberus-900/90 border-t border-cerberus-700 backdrop-blur-md">
                            <div className="flex items-end gap-2 max-w-4xl mx-auto">
                                 <button onClick={toggleRecording} className={`p-3 rounded-full border ${isRecording ? 'bg-red-900 border-red-500 animate-pulse' : 'bg-cerberus-800 border-cerberus-600'}`}>{isRecording ? <MicOff size={20}/> : <Mic size={20}/>}</button>
                                 <textarea value={input} onChange={e => { setInput(e.target.value); if(isRecording) baseInputRef.current=e.target.value; }} placeholder="Command..." className="flex-1 bg-black/50 border border-cerberus-700 rounded-lg p-3 text-sm focus:outline-none resize-none h-12" disabled={isStreaming} onKeyDown={e => { if(e.key === 'Enter' && enterToSend && !e.shiftKey) { e.preventDefault(); if(input.trim() && !isStreaming) { onSendMessage(input); setInput(''); } } }} />
                                 <button onClick={() => { if(input.trim() && !isStreaming) { onSendMessage(input); setInput(''); } }} className="p-3 rounded-full bg-cerberus-accent text-cerberus-900"><Send size={20} /></button>
                            </div>
                         </div>
                    </div>
                )}

                {/* BOARD VIEW */}
                {view === 'board' && (
                    <div className="flex-1 overflow-y-auto p-6 bg-black/40 custom-scrollbar">
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-cerberus-accent font-serif">Open Items</h3>
                                <button onClick={() => setIsAddingItem(!isAddingItem)} className="px-3 py-1 bg-cerberus-700 rounded text-xs uppercase hover:bg-cerberus-600 transition-colors">+ Add Item</button>
                            </div>

                            {isAddingItem && (
                                <div className="flex gap-2 animate-fadeIn">
                                    <input value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} placeholder="Task..." className="flex-1 bg-cerberus-900 border border-cerberus-700 p-2 rounded text-sm outline-none focus:border-cerberus-accent"/>
                                    <button onClick={handleCreateItem} className="px-4 bg-green-800 text-white rounded text-xs uppercase">Save</button>
                                </div>
                            )}

                            <div className="grid gap-3">
                                {items.map(item => (
                                    <div key={item.id} className="bg-cerberus-900/80 border border-cerberus-800 p-3 rounded flex items-center justify-between group hover:border-cerberus-600 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => toggleItemStatus(item.id, item.status)} className={`p-1 rounded-full border ${item.status === 'done' ? 'bg-green-900/50 border-green-700 text-green-500' : 'border-gray-600 text-transparent hover:border-cerberus-accent'}`}>
                                                <CheckCircle size={14} />
                                            </button>
                                            <div>
                                                <div className={`text-sm ${item.status === 'done' ? 'line-through text-gray-600' : 'text-gray-200'}`}>{item.title}</div>
                                                <div className="text-[10px] text-gray-500 uppercase tracking-wider">{item.type} • Priority {item.priority}</div>
                                            </div>
                                        </div>
                                        {item.dueAt && <div className="text-[10px] text-red-400 flex items-center gap-1"><Clock size={10}/> {new Date(item.dueAt).toLocaleDateString()}</div>}
                                    </div>
                                ))}
                                {items.length === 0 && <div className="text-center text-gray-600 text-sm py-8 italic">The board is clear.</div>}
                            </div>
                        </div>
                    </div>
                )}

                {/* MEMORIES VIEW */}
                {view === 'memories' && (
                    <div className="flex-1 overflow-y-auto p-6 bg-black/40 custom-scrollbar">
                        <div className="max-w-4xl mx-auto space-y-6">
                            <h3 className="text-cerberus-accent font-serif mb-4">Core Memories</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                {memories.map(mem => (
                                    <div key={mem.id} className="bg-cerberus-900/60 border border-cerberus-800 p-4 rounded relative group">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-[10px] uppercase bg-cerberus-800 px-2 py-0.5 rounded text-gray-400 border border-cerberus-700">{mem.domain}</span>
                                            <button onClick={() => handlePinMemory(mem.id, mem.ttlDays)} className={`${mem.ttlDays === null ? 'text-cerberus-accent' : 'text-gray-600 hover:text-gray-400'}`}>
                                                <Pin size={14} className={mem.ttlDays === null ? "fill-current" : ""} />
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-300 leading-relaxed font-serif">{mem.text}</p>
                                        <div className="mt-3 flex justify-between items-center border-t border-cerberus-800/50 pt-2">
                                            <span className="text-[9px] text-gray-600">Conf: {(mem.confidence * 100).toFixed(0)}%</span>
                                            <div className="flex gap-2">
                                                 {/* Edit logic omitted for brevity in this overlay but implies full CRUD */}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {memories.length === 0 && <div className="col-span-2 text-center text-gray-600 italic">No active memories found.</div>}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default ScriptoriumOverlay;