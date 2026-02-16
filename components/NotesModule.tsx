
import React, { useState, useEffect, useRef, Component } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/organizerDb';
import { OrgNote, OrgNotebook } from '../types';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import { 
    Plus, Search, ArrowLeft, Pin, MoreVertical, 
    Trash2, Save, FileText, CheckSquare, Mic, 
    Image as ImageIcon, Book, Tag, X, Edit2, 
    RotateCcw, RefreshCw, AlertCircle, Eye
} from 'lucide-react';

// --- ERROR BOUNDARY ---

class NotesErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
    public state = { hasError: false, error: null as Error | null };

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: any) {
        console.error("Notes Module Crash:", error, errorInfo);
    }

    handleReset = () => {
        (this as any).setState({ hasError: false, error: null });
        window.location.reload(); // Hard reset for safety
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-400">
                    <AlertCircle size={48} className="mb-4 text-red-500" />
                    <h2 className="text-lg font-bold text-white mb-2">Notes Module Error</h2>
                    <p className="text-xs mb-4 max-w-xs">{this.state.error?.message}</p>
                    <button onClick={this.handleReset} className="px-4 py-2 bg-cerberus-800 text-white rounded text-xs uppercase font-bold flex items-center gap-2">
                        <RefreshCw size={14}/> Reload Notes
                    </button>
                </div>
            );
        }
        return (this as any).props.children;
    }
}

// --- SUB-COMPONENTS ---

const NoteCard: React.FC<{note: OrgNote, onClick: () => void}> = ({ note, onClick }) => {
    return (
        <div 
            onClick={onClick}
            className="break-inside-avoid mb-3 bg-cerberus-800/30 border border-cerberus-800 rounded-lg p-3 hover:border-cerberus-600 transition-colors cursor-pointer group relative overflow-hidden"
        >
            {note.pinned && <div className="absolute top-2 right-2 text-cerberus-accent"><Pin size={12} fill="currentColor"/></div>}
            
            {note.title && <h3 className="font-bold text-sm text-gray-200 mb-1 pr-4 line-clamp-2">{note.title}</h3>}
            
            <div className="text-xs text-gray-400 line-clamp-6 whitespace-pre-wrap font-sans leading-relaxed">
                {note.body || (note.checklistItems ? `${note.checklistItems.filter(i => !i.done).length} items remaining` : 'Empty note')}
            </div>
            
            <div className="mt-2 flex gap-2 overflow-hidden">
                {note.tags && note.tags.map(t => (
                    <span key={t} className="text-[9px] bg-black/40 px-1.5 py-0.5 rounded text-gray-500 uppercase tracking-wide">#{t}</span>
                ))}
            </div>
        </div>
    );
};

const NoteEditor: React.FC<{noteId: string, onClose: () => void}> = ({ noteId, onClose }) => {
    const [note, setNote] = useState<OrgNote | null>(null);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [preview, setPreview] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Load Note
    useEffect(() => {
        const load = async () => {
            const n = await db.notes.get(noteId);
            if (n) {
                setNote(n);
                setTitle(n.title);
                setBody(n.body);
            }
        };
        load();
    }, [noteId]);

    // Auto-Save
    useEffect(() => {
        if (!note) return;
        
        const timeout = setTimeout(async () => {
            if (title !== note.title || body !== note.body) {
                setIsSaving(true);
                await db.notes.update(note.id, { 
                    title, 
                    body, 
                    updatedAt: Date.now() 
                });
                setIsSaving(false);
            }
        }, 800);

        return () => clearTimeout(timeout);
    }, [title, body, note]);

    // Save immediately on unmount
    useEffect(() => {
        return () => {
            if (note && (title !== note.title || body !== note.body)) {
                db.notes.update(note.id, { title, body, updatedAt: Date.now() });
            }
        };
    }, []);

    const handleDelete = async () => {
        if (confirm("Delete this note?")) {
            await db.notes.delete(noteId);
            onClose();
        }
    };

    const handleTogglePin = async () => {
        if (note) {
            await db.notes.update(noteId, { pinned: !note.pinned, updatedAt: Date.now() });
            setNote(prev => prev ? ({ ...prev, pinned: !prev.pinned }) : null);
        }
    };

    if (!note) return <div className="h-full flex items-center justify-center"><RefreshCw className="animate-spin text-cerberus-accent"/></div>;

    return (
        <div className="flex flex-col h-full bg-cerberus-900 animate-fadeIn">
            {/* Toolbar */}
            <div className="h-12 border-b border-cerberus-800 flex items-center justify-between px-2 shrink-0 bg-cerberus-900/95 backdrop-blur z-10">
                <button onClick={onClose} className="p-2 text-gray-400 hover:text-white"><ArrowLeft size={20}/></button>
                <div className="flex items-center gap-2">
                    {isSaving && <span className="text-[10px] text-gray-500 animate-pulse uppercase tracking-wider">Saving...</span>}
                    <button onClick={() => setPreview(!preview)} className={`p-2 rounded hover:bg-cerberus-800 ${preview ? 'text-cerberus-accent' : 'text-gray-400'}`} title="Preview Markdown"><Eye size={18}/></button>
                    <button onClick={handleTogglePin} className={`p-2 rounded hover:bg-cerberus-800 ${note.pinned ? 'text-cerberus-accent' : 'text-gray-400'}`}><Pin size={18} fill={note.pinned ? "currentColor" : "none"}/></button>
                    <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={18}/></button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 max-w-3xl mx-auto w-full">
                <input 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    placeholder="Title" 
                    className="w-full bg-transparent text-xl font-bold text-white placeholder-gray-600 mb-4 focus:outline-none"
                />
                
                {preview ? (
                    <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                        <ReactMarkdown>{body}</ReactMarkdown>
                    </div>
                ) : (
                    <textarea 
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        placeholder="Start typing..."
                        className="w-full h-[calc(100vh-200px)] bg-transparent text-sm text-gray-300 placeholder-gray-700 resize-none focus:outline-none font-mono leading-relaxed"
                        autoFocus
                    />
                )}
            </div>
        </div>
    );
};

// --- MAIN MODULE ---

export default function NotesModule() {
    const [view, setView] = useState<'home' | 'editor' | 'search'>('home');
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'pinned'>('all');

    // Queries
    const notes = useLiveQuery(async () => {
        let collection = db.notes.orderBy('updatedAt').reverse();
        if (filter === 'pinned') {
            // @ts-ignore
            collection = db.notes.where('pinned').equals(true); // Dexie doesn't like boolean index in types sometimes, but it works
        }
        
        let result = await collection.limit(50).toArray(); // Pagination cap for V1
        
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(n => (n.title && n.title.toLowerCase().includes(q)) || n.body.toLowerCase().includes(q));
        }
        
        return result;
    }, [filter, searchQuery]) || [];

    const handleCreateNote = async () => {
        const id = uuidv4();
        await db.notes.add({
            id,
            type: 'text',
            title: '',
            body: '',
            pinned: false,
            archived: false,
            tags: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
        setSelectedNoteId(id);
        setView('editor');
    };

    const handleOpenNote = (id: string) => {
        setSelectedNoteId(id);
        setView('editor');
    };

    // --- RENDERERS ---

    if (view === 'editor' && selectedNoteId) {
        return (
            <NotesErrorBoundary>
                <NoteEditor noteId={selectedNoteId} onClose={() => setView('home')} />
            </NotesErrorBoundary>
        );
    }

    return (
        <NotesErrorBoundary>
            <div className="flex flex-col h-full bg-cerberus-900 font-sans">
                
                {/* Header */}
                <div className="p-4 border-b border-cerberus-800 flex flex-col gap-3 shrink-0 bg-cerberus-900 z-10">
                    <div className="flex justify-between items-center">
                        <h2 className="text-sm font-serif font-bold text-cerberus-accent tracking-widest uppercase">NOTES</h2>
                        <div className="flex gap-2">
                            <button onClick={() => setView('search')} className={`p-2 rounded ${view === 'search' ? 'bg-cerberus-800 text-white' : 'text-gray-500'}`}><Search size={18}/></button>
                        </div>
                    </div>

                    {/* Filter Chips */}
                    {view !== 'search' && (
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold whitespace-nowrap border transition-colors ${filter === 'all' ? 'bg-cerberus-800 text-white border-cerberus-600' : 'bg-transparent text-gray-500 border-gray-700'}`}>All Notes</button>
                            <button onClick={() => setFilter('pinned')} className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold whitespace-nowrap border transition-colors ${filter === 'pinned' ? 'bg-cerberus-800 text-white border-cerberus-600' : 'bg-transparent text-gray-500 border-gray-700'}`}>Pinned</button>
                        </div>
                    )}

                    {/* Search Bar */}
                    {view === 'search' && (
                        <div className="flex gap-2 items-center animate-fadeIn">
                            <div className="flex-1 bg-black/30 border border-cerberus-700 rounded-lg flex items-center px-3 py-2">
                                <Search size={14} className="text-gray-500 mr-2"/>
                                <input 
                                    autoFocus
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search notes..."
                                    className="bg-transparent border-none outline-none text-xs text-white w-full"
                                />
                                {searchQuery && <button onClick={() => setSearchQuery('')}><X size={14} className="text-gray-500"/></button>}
                            </div>
                            <button onClick={() => { setView('home'); setSearchQuery(''); }} className="text-xs text-gray-400">Cancel</button>
                        </div>
                    )}
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                    {notes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-600 opacity-50">
                            <Book size={48} className="mb-4"/>
                            <p className="text-xs font-mono uppercase tracking-widest">No Records Found</p>
                        </div>
                    ) : (
                        <div className="columns-2 md:columns-3 gap-3 space-y-3 pb-20">
                            {notes.map(note => (
                                <NoteCard key={note.id} note={note} onClick={() => handleOpenNote(note.id)} />
                            ))}
                        </div>
                    )}
                </div>

                {/* FAB */}
                <div className="absolute bottom-20 right-6 z-20">
                    <button 
                        onClick={handleCreateNote}
                        className="w-14 h-14 bg-cerberus-600 hover:bg-cerberus-500 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
                    >
                        <Plus size={28}/>
                    </button>
                </div>

            </div>
        </NotesErrorBoundary>
    );
}
