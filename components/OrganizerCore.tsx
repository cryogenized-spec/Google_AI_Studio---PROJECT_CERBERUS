
import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, archiveOldTasks } from '../services/organizerDb';
import { OrgTask, OrgEvent, OrgNote, AssistantMode, AssistantMessage, ActionProposal, AppSettings, CharacterProfile } from '../types';
import { Layout, Calendar as CalendarIcon, CheckSquare, FileText, Search, Plus, Bell, ChevronRight, Check, X, Clock, MapPin, Tag, Flag, Bot, Mic, MicOff, Send, Wand2, Edit2, Trash2, Settings, Shield, Sliders, Archive, UploadCloud, Loader2, RefreshCw, MessageCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { processAssistantRequest, executeAction, refineText, analyzeQuickIntent } from '../services/assistantService';
import { useTranscriber } from '../hooks/useTranscriber';
import { checkReminders, requestNotificationPermission } from '../services/notificationService';

// Lazy Load Calendar
const CalendarModule = React.lazy(() => import('./CalendarModule'));

// --- SUB-COMPONENTS ---

interface TaskItemProps {
    task: OrgTask;
    onToggle: (id: string, s: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle }) => (
    <div className="flex items-start gap-3 p-3 bg-cerberus-800/30 border border-cerberus-800 rounded mb-2">
        <button 
            onClick={() => onToggle(task.id, task.status)}
            className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${task.status === 'done' ? 'bg-green-900 border-green-700 text-green-400' : 'border-gray-600 hover:border-cerberus-accent'}`}
        >
            {task.status === 'done' && <Check size={12} />}
        </button>
        <div className="flex-1">
            <h4 className={`text-sm ${task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-200'}`}>{task.title}</h4>
            {task.notes && <p className="text-[10px] text-gray-500 line-clamp-1">{task.notes}</p>}
            <div className="flex gap-2 mt-1">
                {task.priority > 1 && <span className="text-[9px] text-red-400 font-bold">!!!</span>}
                {task.dueAt && <span className="text-[9px] text-cerberus-accent flex items-center gap-1"><Clock size={10}/> {new Date(task.dueAt).toLocaleDateString()}</span>}
            </div>
        </div>
    </div>
);

interface EventItemProps {
    event: OrgEvent;
}

const EventItem: React.FC<EventItemProps> = ({ event }) => (
    <div className="flex gap-3 p-3 bg-cerberus-900 border-l-2 border-cerberus-accent rounded-r mb-2">
        <div className="flex flex-col items-center justify-center text-gray-400 w-12 border-r border-gray-800 pr-3">
            <span className="text-[10px] font-bold">{new Date(event.startAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            <span className="text-[9px] opacity-70">to {new Date(event.endAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div>
            <h4 className="text-sm font-bold text-white">{event.title}</h4>
            {event.location && <div className="text-[10px] text-gray-500 flex items-center gap-1"><MapPin size={10}/> {event.location}</div>}
        </div>
    </div>
);

interface NoteCardProps {
    note: OrgNote;
}

const NoteCard: React.FC<NoteCardProps> = ({ note }) => (
    <div className="bg-cerberus-800/20 border border-cerberus-800 p-3 rounded h-32 flex flex-col relative group hover:border-cerberus-600 transition-colors overflow-hidden">
        {note.title && <h4 className="font-bold text-xs text-gray-300 mb-1 truncate">{note.title}</h4>}
        <p className="text-[10px] text-gray-500 line-clamp-5 whitespace-pre-wrap">{note.body}</p>
        {note.pinned && <div className="absolute top-2 right-2 text-cerberus-accent"><Flag size={10} fill="currentColor"/></div>}
    </div>
);

interface ProposalCardProps {
    proposal: ActionProposal;
    onApprove: (p: ActionProposal) => void;
    onCancel: (id: string) => void;
    onEdit: (text: string) => void;
}

const ProposalCard: React.FC<ProposalCardProps> = ({ proposal, onApprove, onCancel, onEdit }) => {
    if (proposal.status !== 'pending') return null;

    const renderPayload = () => {
        const p = proposal.payload;
        if (proposal.type === 'propose_time_slots') {
            return (
                <div className="space-y-2 mt-2">
                    <div className="text-[10px] text-gray-400">Proposed for: {p.context || "Activity"}</div>
                    <div className="grid grid-cols-1 gap-2">
                        {proposal.generatedSlots?.map((slot, i) => (
                            <button 
                                key={i}
                                onClick={() => {
                                    // Transform this proposal into a create_event action
                                    const eventAction: ActionProposal = {
                                        ...proposal,
                                        type: 'create_event',
                                        payload: {
                                            title: p.context || 'Scheduled Task',
                                            startAt: new Date(slot.start).toISOString(),
                                            endAt: new Date(slot.end).toISOString()
                                        }
                                    };
                                    onApprove(eventAction);
                                }}
                                className="flex justify-between items-center p-2 bg-cerberus-800 border border-cerberus-700 hover:border-cerberus-accent rounded text-xs text-white"
                            >
                                <span>{new Date(slot.start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(slot.end).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                <span className="text-[9px] text-green-400">{(slot.confidence * 100).toFixed(0)}% Match</span>
                            </button>
                        ))}
                    </div>
                </div>
            );
        }

        return (
            <div className="text-[10px] font-mono text-gray-400 mt-1 bg-black/30 p-2 rounded">
                {proposal.type.includes('task') && <div>Task: {p.title} {p.dueAt && `by ${new Date(p.dueAt).toLocaleDateString()}`}</div>}
                {proposal.type.includes('event') && <div>Event: {p.title} @ {new Date(p.startAt).toLocaleTimeString()}</div>}
                {proposal.type.includes('note') && <div>Note: {p.body.substring(0, 30)}...</div>}
                <div className="text-cerberus-600 uppercase mt-1">{proposal.type.replace('_', ' ')}</div>
            </div>
        );
    };

    return (
        <div className="bg-cerberus-900 border border-cerberus-700 rounded p-3 my-2 shadow-lg animate-fadeIn w-full max-w-sm ml-auto mr-auto">
            <div className="flex justify-between items-start mb-2">
                <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${proposal.risk === 'high' ? 'bg-red-900 text-red-200' : 'bg-blue-900 text-blue-200'}`}>
                    {proposal.risk} Risk Action
                </span>
            </div>
            {renderPayload()}
            {proposal.type !== 'propose_time_slots' && (
                <div className="flex gap-2 mt-3">
                    <button onClick={() => onApprove(proposal)} className="flex-1 bg-green-900/50 hover:bg-green-800 text-green-200 text-xs py-1.5 rounded font-bold border border-green-800 transition-colors">
                        Approve
                    </button>
                    <button onClick={() => onEdit(proposal.originalInput || '')} className="p-1.5 text-gray-400 hover:text-white bg-gray-800 rounded">
                        <Edit2 size={14}/>
                    </button>
                    <button onClick={() => onCancel(proposal.id)} className="p-1.5 text-red-400 hover:text-red-200 bg-gray-800 rounded">
                        <X size={14}/>
                    </button>
                </div>
            )}
        </div>
    );
};

// --- VIEWS ---

const AgendaView = () => {
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

    const tasks = useLiveQuery(() => db.tasks.where('status').equals('open').limit(5).toArray()) || [];
    const events = useLiveQuery(() => db.events.where('startAt').between(todayStart.getTime(), todayEnd.getTime()).toArray()) || [];
    
    // Sort events
    const sortedEvents = [...events].sort((a,b) => a.startAt - b.startAt);

    return (
        <div className="space-y-6 pb-20 p-4">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-serif text-cerberus-accent">{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</h1>
                    <p className="text-xs text-gray-500 uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] text-gray-600 font-mono">AGENDA</p>
                </div>
            </div>

            {/* Now / Next */}
            <div className="bg-gradient-to-r from-cerberus-900 to-cerberus-800 border border-cerberus-700 p-4 rounded-lg shadow-lg">
                <h3 className="text-[10px] uppercase text-gray-400 mb-2 font-bold tracking-wider">Up Next</h3>
                {sortedEvents.length > 0 ? (
                    <div>
                        <div className="text-lg text-white font-bold">{sortedEvents[0].title}</div>
                        <div className="text-xs text-cerberus-accent mt-1 flex items-center gap-2">
                            <Clock size={12}/> 
                            {new Date(sortedEvents[0].startAt).toLocaleTimeString()} 
                            {sortedEvents[0].location && <span>• {sortedEvents[0].location}</span>}
                        </div>
                    </div>
                ) : (
                    <div className="text-sm text-gray-500 italic">No events scheduled immediately.</div>
                )}
            </div>

            {/* Tasks Section */}
            <div>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">Tasks</h3>
                    <button className="text-[10px] text-cerberus-accent hover:underline">View All</button>
                </div>
                {tasks.map(t => (
                    <TaskItem key={t.id} task={t} onToggle={(id, status) => db.tasks.update(id, { status: status === 'done' ? 'open' : 'done' })} />
                ))}
                {tasks.length === 0 && <div className="text-center py-4 text-xs text-gray-600">All caught up.</div>}
            </div>

            {/* Events Section */}
            <div>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wide">Timeline</h3>
                </div>
                {sortedEvents.map(e => <EventItem key={e.id} event={e} />)}
                {sortedEvents.length === 0 && <div className="text-center py-4 text-xs text-gray-600">No events today.</div>}
            </div>
        </div>
    );
};

const AssistantView = () => {
    // State
    const [mode, setMode] = useState<AssistantMode>('capture');
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isContextOpen, setIsContextOpen] = useState(false);
    
    // Live Queries
    const messages = useLiveQuery(() => db.assistant_messages.orderBy('createdAt').toArray()) || [];
    const planningContext = useLiveQuery(() => db.planning_context.get('default')) || null;

    // Utils
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const settings = JSON.parse(localStorage.getItem('project_cerberus_state_v5') || '{}').settings || {} as AppSettings;

    // VTT
    const { isRecording, startRecording, stopRecording } = useTranscriber({
        mode: 'browser',
        onInputUpdate: (t) => setInput(prev => prev + ' ' + t),
        onSend: () => {},
        autoSend: false
    });

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isProcessing) return;
        setIsProcessing(true);
        const text = input;
        setInput('');

        try {
            // 1. Save User Message
            await db.assistant_messages.add({
                role: 'user',
                text,
                createdAt: Date.now(),
                mode
            });

            // 2. Call AI Service
            const response = await processAssistantRequest(text, mode, settings);
            
            // 3. Save Assistant Response
            await db.assistant_messages.add(response);

        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleApprove = async (proposal: ActionProposal, msgId: string) => {
        await executeAction(proposal);
        // Update message proposals status (complex because arrays in dexie need replace)
        const msg = await db.assistant_messages.get(msgId);
        if (msg && msg.proposals) {
            const updatedProposals = msg.proposals.map(p => p.id === proposal.id ? { ...p, status: 'executed' } : p);
            await db.assistant_messages.update(msgId, { proposals: updatedProposals as ActionProposal[] });
        }
    };

    const handleCancelProposal = async (proposalId: string, msgId: string) => {
        const msg = await db.assistant_messages.get(msgId);
        if (msg && msg.proposals) {
            const updatedProposals = msg.proposals.map(p => p.id === proposalId ? { ...p, status: 'canceled' } : p);
            await db.assistant_messages.update(msgId, { proposals: updatedProposals as ActionProposal[] });
        }
    };

    const handleClearHistory = async () => {
        if (confirm("Clear assistant history? This cannot be undone.")) {
            await db.assistant_messages.clear();
        }
    };

    const handleWand = async () => {
        if (!input.trim()) return;
        setIsProcessing(true);
        const refined = await refineText(input, settings);
        setInput(refined);
        setIsProcessing(false);
    };

    const handleArchiveRun = async () => {
        if (confirm("Archive completed tasks older than 3 months?")) {
            await archiveOldTasks(3);
            alert("Archive process complete.");
        }
    };

    return (
        <div className="flex flex-col h-full bg-cerberus-900/50 relative">
            
            {/* Context Panel Modal */}
            {isContextOpen && (
                <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur p-6 animate-fadeIn overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-serif text-cerberus-accent">Planning Context</h2>
                        <button onClick={() => setIsContextOpen(false)}><X size={24}/></button>
                    </div>
                    {planningContext && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs uppercase text-gray-500 mb-1">Work Hours</label>
                                <input className="w-full bg-cerberus-900 border border-cerberus-700 p-2 text-sm text-white" defaultValue={planningContext.workHours} onBlur={(e) => db.planning_context.update('default', { workHours: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-gray-500 mb-1">Sleep Window</label>
                                <input className="w-full bg-cerberus-900 border border-cerberus-700 p-2 text-sm text-white" defaultValue={planningContext.sleepWindow} onBlur={(e) => db.planning_context.update('default', { sleepWindow: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-gray-500 mb-1">Preferences (Freeform)</label>
                                <textarea className="w-full h-32 bg-cerberus-900 border border-cerberus-700 p-2 text-sm text-white" defaultValue={planningContext.preferences} onBlur={(e) => db.planning_context.update('default', { preferences: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs uppercase text-gray-500 mb-2">System Controls</label>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center bg-cerberus-900 p-2 rounded">
                                        <span className="text-sm flex items-center gap-2"><Bell size={14}/> Notifications</span>
                                        <button onClick={requestNotificationPermission} className="text-xs uppercase text-cerberus-accent border border-cerberus-800 px-2 py-1 rounded">Enable</button>
                                    </div>
                                    <div className="flex justify-between items-center bg-cerberus-900 p-2 rounded">
                                        <span className="text-sm flex items-center gap-2"><Archive size={14}/> Archive Old Tasks</span>
                                        <button onClick={handleArchiveRun} className="text-xs uppercase text-gray-400 border border-cerberus-800 px-2 py-1 rounded hover:text-white">Run</button>
                                    </div>
                                    <div className="flex justify-between items-center bg-cerberus-900 p-2 rounded">
                                        <span className="text-sm flex items-center gap-2"><UploadCloud size={14}/> Outbox Sync</span>
                                        <span className="text-xs text-gray-500">Auto (Pending)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Header */}
            <div className="p-4 border-b border-cerberus-800 bg-cerberus-900 flex justify-between items-center shrink-0">
                <div className="flex gap-2">
                    <button onClick={() => setMode('capture')} className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold transition-all ${mode === 'capture' ? 'bg-cerberus-accent text-black' : 'bg-gray-800 text-gray-400'}`}>Capture</button>
                    <button onClick={() => setMode('ask')} className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold transition-all ${mode === 'ask' ? 'bg-cerberus-accent text-black' : 'bg-gray-800 text-gray-400'}`}>Ask</button>
                    <button onClick={() => setMode('act')} className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold transition-all ${mode === 'act' ? 'bg-cerberus-accent text-black' : 'bg-gray-800 text-gray-400'}`}>Act</button>
                </div>
                <div className="flex gap-2 text-gray-500">
                    <button onClick={() => setIsContextOpen(true)}><Sliders size={18}/></button>
                    <button onClick={handleClearHistory}><Trash2 size={18}/></button>
                </div>
            </div>

            {/* Chat Timeline */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="text-center text-gray-600 mt-20 text-xs font-mono">
                        <Bot size={48} className="mx-auto mb-4 opacity-50"/>
                        System Online. Ready for orders.
                    </div>
                )}
                {messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-cerberus-800 text-white' : 'bg-gray-900 border border-gray-800 text-gray-300'}`}>
                            {msg.text}
                        </div>
                        {msg.proposals && msg.proposals.map(p => (
                            <ProposalCard 
                                key={p.id} 
                                proposal={p} 
                                onApprove={(prop) => handleApprove(prop, msg.id)}
                                onCancel={(id) => handleCancelProposal(id, msg.id)}
                                onEdit={(text) => setInput(text)}
                            />
                        ))}
                    </div>
                ))}
                {isProcessing && <div className="text-xs text-gray-500 animate-pulse ml-2">Thinking...</div>}
                <div ref={messagesEndRef}/>
            </div>

            {/* Composer */}
            <div className="p-3 border-t border-cerberus-800 bg-cerberus-900 shrink-0">
                <div className="flex gap-2 items-end">
                    <button onClick={isRecording ? stopRecording : startRecording} className={`p-3 rounded-full ${isRecording ? 'bg-red-900 text-white animate-pulse' : 'bg-gray-800 text-gray-400'}`}>
                        {isRecording ? <MicOff size={20}/> : <Mic size={20}/>}
                    </button>
                    <div className="flex-1 bg-black/50 border border-cerberus-700 rounded-2xl flex items-center pr-2">
                        <input 
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder={`Type to ${mode}...`}
                            className="flex-1 bg-transparent p-3 text-sm text-white focus:outline-none"
                        />
                        <button onClick={handleWand} className="p-2 text-cerberus-600 hover:text-cerberus-accent" title="Magic Wand: Structure Text"><Wand2 size={16}/></button>
                    </div>
                    <button onClick={handleSend} disabled={!input.trim()} className="p-3 rounded-full bg-cerberus-600 text-white disabled:opacity-50 disabled:bg-gray-800">
                        <Send size={20}/>
                    </button>
                </div>
            </div>
        </div>
    );
};

const CalendarView = () => {
    return (
        <Suspense fallback={
            <div className="h-full w-full flex items-center justify-center text-cerberus-accent">
                <Loader2 size={32} className="animate-spin" />
            </div>
        }>
            <CalendarModule />
        </Suspense>
    );
};

const TasksView = () => {
    const [filter, setFilter] = useState<'all'|'open'|'done'>('open');
    const tasks = useLiveQuery(async () => {
        if (filter === 'all') return await db.tasks.orderBy('createdAt').reverse().toArray();
        return await db.tasks.where('status').equals(filter).reverse().toArray();
    }, [filter]) || [];

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-cerberus-800 flex gap-4 overflow-x-auto">
                <button onClick={() => setFilter('open')} className={`px-3 py-1 rounded text-xs uppercase font-bold whitespace-nowrap ${filter === 'open' ? 'bg-cerberus-800 text-white' : 'text-gray-500'}`}>Active</button>
                <button onClick={() => setFilter('done')} className={`px-3 py-1 rounded text-xs uppercase font-bold whitespace-nowrap ${filter === 'done' ? 'bg-cerberus-800 text-white' : 'text-gray-500'}`}>Completed</button>
                <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded text-xs uppercase font-bold whitespace-nowrap ${filter === 'all' ? 'bg-cerberus-800 text-white' : 'text-gray-500'}`}>All</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-20">
                {tasks.map(t => (
                    <TaskItem key={t.id} task={t} onToggle={(id, status) => db.tasks.update(id, { status: status === 'done' ? 'open' : 'done' })} />
                ))}
            </div>
        </div>
    );
};

const NotesView = () => {
    const notes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray()) || [];
    
    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-cerberus-800">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Notes & Thoughts</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-20">
                <div className="grid grid-cols-2 gap-3">
                    {notes.map(n => <NoteCard key={n.id} note={n} />)}
                </div>
            </div>
        </div>
    );
};

// --- MAIN SHELL ---

export default function OrganizerCore() {
    const [activeTab, setActiveTab] = useState<'agenda' | 'calendar' | 'tasks' | 'notes' | 'assistant' | 'search'>('agenda');
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    
    // Quick Add State Machine
    const [qaState, setQaState] = useState<'idle' | 'processing' | 'review' | 'followup'>('idle');
    const [qaInput, setQaInput] = useState('');
    const [qaPlan, setQaPlan] = useState<any>(null);
    const settings = JSON.parse(localStorage.getItem('project_cerberus_state_v5') || '{}').settings || {} as AppSettings;

    // VTT for Quick Add
    const { isRecording, startRecording, stopRecording } = useTranscriber({
        mode: 'browser',
        onInputUpdate: (t) => setQaInput(prev => prev + (prev ? ' ' : '') + t),
        onSend: () => {}, 
        autoSend: false
    });

    // Notifications Check (Foreground Poll)
    useEffect(() => {
        const interval = setInterval(checkReminders, 60000); // Check every min
        return () => clearInterval(interval);
    }, []);

    const handleQuickAnalyze = async () => {
        if (!qaInput.trim()) return;
        setQaState('processing');
        
        try {
            const plan = await analyzeQuickIntent(qaInput, settings, qaPlan);
            setQaPlan(plan);
            setQaState('review');
            setQaInput(''); // Clear for potential follow-up
        } catch (e) {
            console.error(e);
            setQaState('idle'); // Reset on fail
        }
    };

    const handleConfirmPlan = async () => {
        if (!qaPlan) return;
        
        try {
            // 1. Create Main Task or Event
            const mainId = uuidv4();
            
            // If it has specific time duration, schedule event. If just due date, task.
            // Using logic: startAt/endAt present = Event.
            if (qaPlan.startAt && qaPlan.endAt) {
                await db.events.add({
                    id: mainId,
                    title: qaPlan.title,
                    startAt: new Date(qaPlan.startAt).getTime(),
                    endAt: new Date(qaPlan.endAt).getTime(),
                    allDay: false,
                    location: '',
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });
            } else {
                await db.tasks.add({
                    id: mainId,
                    title: qaPlan.title,
                    status: 'open',
                    priority: qaPlan.urgency || 1,
                    dueAt: qaPlan.startAt ? new Date(qaPlan.startAt).getTime() : undefined,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });
            }

            // 2. Create Subtasks if any
            if (qaPlan.subtasks && qaPlan.subtasks.length > 0) {
                for (const sub of qaPlan.subtasks) {
                    await db.tasks.add({
                        id: uuidv4(),
                        title: sub,
                        status: 'open',
                        priority: 1,
                        parentTaskId: mainId, // Link (conceptual)
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    });
                }
            }

            setQaState('idle');
            setQaPlan(null);
            setQaInput('');
            setIsQuickAddOpen(false);
        } catch (e) {
            console.error("Save Failed", e);
        }
    };

    return (
        <div className="flex flex-col h-full bg-cerberus-void text-gray-200 font-sans relative">
            
            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'agenda' && <AgendaView />}
                {activeTab === 'calendar' && <CalendarView />}
                {activeTab === 'tasks' && <TasksView />}
                {activeTab === 'notes' && <NotesView />}
                {activeTab === 'assistant' && <AssistantView />}
                {activeTab === 'search' && <div className="p-8 text-center text-gray-500 italic">Search Index Building...</div>}
            </div>

            {/* Quick Add Modal (Overhauled) */}
            {isQuickAddOpen && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
                    <div className="bg-cerberus-900 border border-cerberus-700 w-full max-w-md rounded-xl shadow-2xl p-4 animate-fadeIn mb-20 sm:mb-0 relative overflow-hidden">
                        
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <Bot size={16} className="text-cerberus-accent"/> 
                                {qaState === 'processing' ? 'Thinking...' : qaState === 'review' ? 'Review Plan' : 'Quick Create'}
                            </h3>
                            <button onClick={() => { setIsQuickAddOpen(false); setQaState('idle'); setQaPlan(null); }}><X size={20} className="text-gray-500"/></button>
                        </div>

                        {/* PHASE: IDLE or FOLLOWUP (Input) */}
                        {(qaState === 'idle' || qaState === 'followup') && (
                            <div className="space-y-4 animate-fadeIn">
                                <textarea 
                                    rows={3}
                                    autoFocus
                                    value={qaInput}
                                    onChange={e => setQaInput(e.target.value)}
                                    placeholder={qaState === 'followup' ? "Add corrections or details..." : "Speak or type your intent..."}
                                    className="w-full bg-black/50 border border-cerberus-700 rounded p-3 text-sm text-white focus:border-cerberus-accent outline-none resize-none"
                                />
                                <div className="flex justify-between items-center">
                                    <button 
                                        onClick={isRecording ? stopRecording : startRecording} 
                                        className={`p-3 rounded-full transition-colors ${isRecording ? 'bg-red-900 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                                    >
                                        {isRecording ? <MicOff size={20}/> : <Mic size={20}/>}
                                    </button>
                                    
                                    <div className="flex gap-2">
                                        {qaState === 'followup' && (
                                            <button onClick={() => setQaState('review')} className="px-4 py-2 text-xs uppercase font-bold text-gray-400 hover:text-white">
                                                Cancel
                                            </button>
                                        )}
                                        <button 
                                            onClick={handleQuickAnalyze} 
                                            disabled={!qaInput.trim()}
                                            className="px-6 py-2 bg-cerberus-600 text-white font-bold rounded text-xs uppercase hover:bg-cerberus-500 transition-colors disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <Send size={14}/> {qaState === 'followup' ? 'Update' : 'Send'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PHASE: PROCESSING */}
                        {qaState === 'processing' && (
                            <div className="py-12 flex flex-col items-center justify-center text-cerberus-accent animate-pulse">
                                <Loader2 size={32} className="animate-spin mb-4"/>
                                <p className="text-xs font-mono uppercase tracking-widest">Analyzing Temporal Stream...</p>
                            </div>
                        )}

                        {/* PHASE: REVIEW */}
                        {qaState === 'review' && qaPlan && (
                            <div className="animate-fadeIn space-y-4">
                                {/* Follow Up Trigger */}
                                <div className="flex justify-center">
                                    <button 
                                        onClick={() => setQaState('followup')}
                                        className="flex flex-col items-center gap-1 group"
                                    >
                                        <div className="w-12 h-12 rounded-full bg-cerberus-800/50 border border-cerberus-700 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:border-cerberus-accent transition-all">
                                            <MessageCircle size={24} />
                                        </div>
                                        <span className="text-[9px] uppercase font-bold tracking-widest text-gray-500 group-hover:text-cerberus-accent">Tap for Follow-up</span>
                                    </button>
                                </div>

                                {/* Confirmation Card */}
                                <div className="bg-cerberus-800/30 border border-cerberus-600 rounded-lg p-4 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-cerberus-accent"></div>
                                    <div className="pl-3">
                                        <h4 className="text-lg font-serif font-bold text-white mb-1">{qaPlan.title}</h4>
                                        <div className="flex items-center gap-4 text-xs text-gray-400 mb-3 font-mono">
                                            {qaPlan.startAt && <span className="flex items-center gap-1"><Clock size={12}/> {new Date(qaPlan.startAt).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span>}
                                            {qaPlan.urgency && <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${qaPlan.urgency === 3 ? 'bg-red-900 text-red-200' : 'bg-gray-800'}`}>Priority {qaPlan.urgency}</span>}
                                        </div>

                                        {qaPlan.needsClarification ? (
                                            <div className="bg-yellow-900/20 border border-yellow-700/50 p-2 rounded mb-3">
                                                <p className="text-xs text-yellow-500 italic"><span className="font-bold">Query:</span> {qaPlan.clarificationQuestion || "Please clarify duration."}</p>
                                            </div>
                                        ) : (
                                            qaPlan.subtasks && qaPlan.subtasks.length > 0 && (
                                                <div className="space-y-1 mb-4">
                                                    <p className="text-[9px] uppercase text-gray-500 font-bold mb-1">Execution Steps</p>
                                                    {qaPlan.subtasks.map((step: string, i: number) => (
                                                        <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                                                            <div className="mt-1 w-1 h-1 rounded-full bg-cerberus-500 shrink-0"/>
                                                            <span>{step}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )
                                        )}

                                        <div className="flex justify-end gap-2 mt-2">
                                            <button onClick={() => { setQaState('idle'); setQaInput(''); }} className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white">Discard</button>
                                            <button onClick={handleConfirmPlan} className="px-4 py-1.5 bg-cerberus-accent text-cerberus-900 font-bold rounded text-xs uppercase hover:bg-white transition-colors flex items-center gap-1">
                                                <Check size={14}/> Confirm
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* Bottom Navigation */}
            <div className="h-16 bg-cerberus-900 border-t border-cerberus-800 flex items-center justify-around px-2 relative z-40 shrink-0">
                <button onClick={() => setActiveTab('agenda')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'agenda' ? 'text-cerberus-accent' : 'text-gray-600'}`}>
                    <Layout size={20} />
                    <span className="text-[9px] font-bold uppercase">Agenda</span>
                </button>
                <button onClick={() => setActiveTab('calendar')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'calendar' ? 'text-cerberus-accent' : 'text-gray-600'}`}>
                    <CalendarIcon size={20} />
                    <span className="text-[9px] font-bold uppercase">Cal</span>
                </button>
                
                {/* FAB */}
                <div className="relative -top-6">
                    <button 
                        onClick={() => { setIsQuickAddOpen(true); setQaState('idle'); setQaInput(''); }}
                        className="w-14 h-14 bg-cerberus-600 border-4 border-cerberus-void rounded-full flex items-center justify-center text-white shadow-lg hover:scale-105 hover:bg-cerberus-500 transition-all"
                    >
                        <Plus size={28} />
                    </button>
                </div>

                <button onClick={() => setActiveTab('assistant')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'assistant' ? 'text-cerberus-accent' : 'text-gray-600'}`}>
                    <Bot size={20} />
                    <span className="text-[9px] font-bold uppercase">Assistant</span>
                </button>
                <button onClick={() => setActiveTab('notes')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'notes' ? 'text-cerberus-accent' : 'text-gray-600'}`}>
                    <FileText size={20} />
                    <span className="text-[9px] font-bold uppercase">Notes</span>
                </button>
            </div>
        </div>
    );
}
