
import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, initializeOrganizer } from '../services/organizerDb';
import { QuickElement, AppSettings, ActionProposal } from '../types';
import { Mic, MicOff, Send, X, Check, Loader2, Calendar as CalendarIcon, List as ListIcon, Clock, AlertCircle, RefreshCw, MessageCircle } from 'lucide-react';
import { useTranscriber } from '../hooks/useTranscriber';
import { analyzeQuickIntent, executeAction } from '../services/assistantService';
import { sendLocalNotification, requestNotificationPermission } from '../services/notificationService';
import { v4 as uuidv4 } from 'uuid';

const QuickPanel: React.FC = () => {
    const [presetId, setPresetId] = useState('default');
    const [status, setStatus] = useState<'idle' | 'processing' | 'review' | 'success'>('idle');
    const [input, setInput] = useState('');
    const [plan, setPlan] = useState<any>(null);
    const settings = JSON.parse(localStorage.getItem('project_cerberus_state_v5') || '{}').settings || {} as AppSettings;

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const p = params.get('preset');
        if (p) setPresetId(p);
        initializeOrganizer();
    }, []);

    const preset = useLiveQuery(() => db.quick_presets.get(presetId), [presetId]);
    
    const { isRecording, isTranscribing, error, startRecording, stopRecording, retry } = useTranscriber({
        mode: settings.vttMode || 'browser',
        model: settings.transcriptionModel || 'gpt-4o-mini-transcribe',
        apiKey: settings.vttMode === 'gemini' ? settings.apiKeyGemini : settings.apiKeyOpenAI,
        onInputUpdate: (t) => setInput(prev => prev + (prev ? ' ' : '') + t),
        onSend: (text) => handleAnalyze(), 
        autoSend: settings.vttAutoSend || false
    });

    const handleAnalyze = async () => {
        if (!input.trim()) return;
        setStatus('processing');
        try {
            const analysis = await analyzeQuickIntent(input, settings);
            setPlan(analysis);
            setStatus('review');
        } catch (e) {
            console.error(e);
            setStatus('idle');
            alert("Analysis failed. Try again.");
        }
    };

    // SMART ACTION
    const handleSmartAction = () => {
        if (input.trim()) {
            handleAnalyze();
        } else {
            if (isRecording) stopRecording();
            else startRecording();
        }
    };

    const handleConfirm = async () => {
        if (!plan) return;
        try {
            const action: ActionProposal = {
                id: uuidv4(),
                type: plan.startAt && plan.endAt ? 'create_event' : 'create_task',
                payload: {
                    title: plan.title,
                    startAt: plan.startAt,
                    endAt: plan.endAt,
                    dueAt: plan.startAt, 
                    priority: plan.urgency || 1,
                    status: 'open'
                },
                risk: 'low',
                status: 'approved'
            };

            await executeAction(action);
            
            if (plan.subtasks && plan.subtasks.length > 0) {
                for (const sub of plan.subtasks) {
                    await db.tasks.add({
                        id: uuidv4(),
                        title: sub,
                        status: 'open',
                        priority: 1,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    });
                }
            }

            const granted = await requestNotificationPermission();
            if (granted) {
                sendLocalNotification("Captured", {
                    body: plan.title,
                    tag: 'quick_capture',
                    data: { url: '/today' }
                });
            }

            setStatus('success');
            setTimeout(() => {
                setInput('');
                setPlan(null);
                setStatus('idle');
            }, 1500);

        } catch (e) {
            console.error(e);
            alert("Save failed.");
        }
    };

    const renderElement = (el: QuickElement) => {
        switch(el.type) {
            case 'mic':
                return (
                    <div key={el.id} className="w-full flex flex-col items-center justify-center py-8">
                        <button 
                            onClick={handleSmartAction}
                            className={`
                                w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-[0_0_40px_rgba(0,0,0,0.5)] border-4
                                ${input.trim() 
                                    ? 'bg-violet-600 border-violet-400 text-white hover:scale-105' 
                                    : isRecording 
                                        ? 'bg-red-900 border-red-500 text-white animate-pulse scale-110'
                                        : isTranscribing
                                            ? 'bg-cerberus-800 border-cerberus-600 text-cerberus-accent animate-spin'
                                            : 'bg-cerberus-800 border-cerberus-600 text-cerberus-accent hover:border-cerberus-accent' 
                                }
                            `}
                        >
                            {input.trim() ? <Send size={36} /> : (
                                isTranscribing ? <RefreshCw size={36}/> :
                                isRecording ? <MicOff size={36}/> : 
                                error ? <AlertCircle size={36} onClick={(e) => {e.stopPropagation(); retry();}}/> :
                                <Mic size={36} />
                            )}
                        </button>
                        <p className="mt-4 text-xs font-mono uppercase tracking-widest text-gray-500">
                            {input.trim() ? "Tap to Process" : isRecording ? "Listening..." : "Tap to Speak"}
                        </p>
                    </div>
                );
            case 'today_list': return <TodayListWidget key={el.id} />;
            case 'next_event': return <NextEventWidget key={el.id} />;
            default: return null;
        }
    };

    const handleClose = () => { window.location.href = '/'; };

    return (
        <div className="min-h-[100dvh] bg-cerberus-void text-gray-200 font-sans flex flex-col relative">
            
            {/* RECORDING OVERLAY */}
            {isRecording && (
                <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex flex-col items-center justify-end pb-32 animate-fadeIn">
                    <div className="relative">
                        <div className="absolute inset-0 bg-violet-500 rounded-full animate-ping opacity-20 delay-100"></div>
                        <div className="absolute inset-[-20px] bg-violet-500 rounded-full animate-ping opacity-10 delay-300"></div>
                        <div className="absolute inset-[-40px] bg-violet-500 rounded-full animate-ping opacity-5 delay-500"></div>
                        <button onClick={stopRecording} className="relative w-24 h-24 bg-violet-900 rounded-full flex items-center justify-center text-white shadow-[0_0_50px_rgba(139,92,246,0.6)] hover:scale-105 transition-transform border-2 border-violet-500"><Mic size={40} className="drop-shadow-lg" /></button>
                    </div>
                    <h2 className="mt-8 text-2xl font-serif tracking-[0.2em] text-violet-200 font-bold animate-pulse">LISTENING...</h2>
                    <p className="mt-2 text-xs font-mono text-violet-300/70 tracking-widest">TAP TO STOP</p>
                </div>
            )}

            {/* Header */}
            <div className="p-4 flex justify-between items-center border-b border-cerberus-800 bg-cerberus-900 sticky top-0 z-50">
                <span className="font-serif text-cerberus-accent font-bold tracking-widest uppercase text-sm">Quick Capture</span>
                <button onClick={handleClose} className="p-2 bg-cerberus-800 rounded-full hover:bg-cerberus-700 transition-colors">
                    <X size={18} />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {status === 'success' ? (
                    <div className="flex flex-col items-center justify-center h-64 animate-fadeIn">
                        <div className="w-20 h-20 bg-green-900/50 rounded-full flex items-center justify-center border-2 border-green-500 mb-4">
                            <Check size={40} className="text-green-400" />
                        </div>
                        <h2 className="text-xl font-serif text-white">Saved</h2>
                    </div>
                ) : status === 'review' && plan ? (
                    <div className="bg-cerberus-900 border border-cerberus-700 rounded-xl p-4 animate-fadeIn shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-2">{plan.title}</h3>
                        <div className="space-y-2 mb-4">
                            {plan.startAt && <div className="flex items-center gap-2 text-xs text-cerberus-accent"><Clock size={12}/> {new Date(plan.startAt).toLocaleString()}</div>}
                            {plan.needsClarification && <div className="text-xs text-yellow-500 flex items-center gap-2"><AlertCircle size={12}/> {plan.clarificationQuestion}</div>}
                            {plan.subtasks?.length > 0 && (
                                <div className="space-y-1 mt-2">
                                    {plan.subtasks.map((st: string, i: number) => (
                                        <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                                            <div className="w-1 h-1 bg-gray-500 rounded-full"/> {st}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setStatus('idle')} className="flex-1 py-3 bg-gray-800 rounded-lg text-xs font-bold uppercase text-gray-400">Cancel</button>
                            <button onClick={handleConfirm} className="flex-1 py-3 bg-cerberus-600 rounded-lg text-xs font-bold uppercase text-white shadow-lg">Confirm</button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Render Layout */}
                        {preset?.layout.map(renderElement)}

                        {/* Fallback Text Input (Smart Button) */}
                        <div className="bg-cerberus-900/50 border border-cerberus-800 rounded-xl p-2 flex gap-2 items-center">
                            <input 
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Or type here..."
                                className="flex-1 bg-transparent p-2 text-sm outline-none text-white placeholder-gray-600"
                                onKeyDown={e => e.key === 'Enter' && handleSmartAction()}
                            />
                            <button 
                                onClick={handleSmartAction} 
                                disabled={status === 'processing'}
                                className={`p-3 rounded-lg text-white disabled:opacity-50 transition-colors ${input.trim() ? 'bg-violet-600' : isRecording ? 'bg-red-900 animate-pulse' : 'bg-cerberus-700'}`}
                            >
                                {status === 'processing' ? <Loader2 size={20} className="animate-spin"/> : input.trim() ? <Send size={20}/> : isTranscribing ? <RefreshCw size={20} className="animate-spin"/> : isRecording ? <MicOff size={20}/> : <Mic size={20}/>}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// Sub-Widgets (Unchanged)
const TodayListWidget = () => {
    const tasks = useLiveQuery(() => db.tasks.where('status').equals('open').limit(3).toArray()) || [];
    return (
        <div className="bg-black/20 border border-cerberus-800 rounded-xl p-4">
            <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-3 flex items-center gap-2"><ListIcon size={12}/> Active Tasks</h4>
            <div className="space-y-2">{tasks.length === 0 && <div className="text-xs text-gray-600 italic">No active tasks.</div>}{tasks.map(t => (<div key={t.id} className="flex items-center gap-3 text-sm text-gray-300"><div className="w-4 h-4 border border-gray-600 rounded-sm"/><span className="truncate">{t.title}</span></div>))}</div>
        </div>
    );
};

const NextEventWidget = () => {
    const nextEvent = useLiveQuery(async () => { const now = Date.now(); const evs = await db.events.where('startAt').above(now).limit(1).toArray(); return evs[0]; });
    if (!nextEvent) return null;
    return (
        <div className="bg-cerberus-900/30 border-l-2 border-cerberus-accent rounded-r-xl p-4"><h4 className="text-[10px] uppercase font-bold text-gray-500 mb-1 flex items-center gap-2"><CalendarIcon size={12}/> Next Up</h4><div className="text-sm font-bold text-white">{nextEvent.title}</div><div className="text-xs text-cerberus-accent mt-1">{new Date(nextEvent.startAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div></div>
    );
};

export default QuickPanel;
