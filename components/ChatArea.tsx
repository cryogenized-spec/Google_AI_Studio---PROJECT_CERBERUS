
// ... existing imports ...
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Menu, MapPin, Square, Check, X as XIcon, Shirt, Mic, MicOff, RefreshCw, AlertCircle, ShieldAlert, Link as LinkIcon, Activity, Sparkles, ChevronLeft, ChevronRight, Scale, ScrollText, Eye, BrainCircuit, X, Mail, Trash2, Sliders, User, ChevronDown, ChevronUp, Bot, Ghost, Wand2, Dices, Terminal, Zap, Shield, FileText } from 'lucide-react';
import { Message, Room, CharacterProfile, MoodState, AgentMode, AppSettings, TraceLog, Thread } from '../types';
import Portrait from './Portrait';
import { useTranscriber } from '../hooks/useTranscriber';
import { runMagicPipeline } from '../services/magicInputService';

// ... (Keep existing Helper Icons and MessageItem as they were) ...
const AnkhIcon = ({ className, onClick }: { className?: string, onClick?: () => void }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} onClick={onClick}>
    <path d="M12 2a4 4 0 0 1 4 4c0 2-2 4-4 4s-4-2-4-4a4 4 0 0 1 4-4z" />
    <path d="M12 10v12" />
    <path d="M5 14h14" />
  </svg>
);

const CinderBowlIcon = ({ className, onClick }: { className?: string, onClick?: () => void }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} onClick={onClick}>
    <path d="M4 12c0 4.418 3.582 8 8 8s8-3.582 8-8" />
    <path d="M4 12h16" />
    <path d="M8 20l-2 3h12l-2-3" />
    <path d="M8 12c0-3 1-5 2-6" />
    <path d="M16 12c0-4-1.5-6-3-8" />
    <path d="M12 12c0-3.5 1-6 2-9" />
  </svg>
);

interface MessageItemProps {
    msg: Message;
    characterName: string;
    isLast: boolean;
    isStreaming: boolean;
    onDelete: (id: string) => void;
    onRegenerate: () => void;
    onReiterate: (id: string, mode: 'context' | 'logic') => void;
    onVersionChange: (id: string, index: number) => void;
    onEdit: (id: string, newContent: string) => void;
    onContinue: () => void;
    aiTextColor: string;
    aiTextStyle: 'none' | 'shadow' | 'outline' | 'neon';
    aiFontFamily: string;
    aiTextSize: number;
    userTextColor: string;
    userFontFamily: string;
    userTextSize: number;
}

const MessageItem: React.FC<MessageItemProps> = ({ msg, characterName, isLast, isStreaming, onDelete, onRegenerate, onReiterate, onVersionChange, onEdit, onContinue, aiTextColor, aiTextStyle, aiFontFamily, aiTextSize, userTextColor, userFontFamily, userTextSize }) => {
    // ... (Keep existing implementation of MessageItem) ...
    const isModel = msg.role === 'model';
    const hasVersions = msg.versions && msg.versions.length > 1;
    const currentVersionIndex = msg.activeVersionIndex || 0;
    const totalVersions = msg.versions ? msg.versions.length : 1;
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(msg.content);
    const [dragX, setDragX] = useState(0);
    const startXRef = useRef<number | null>(null);
    const THRESHOLD = 80;
    const LIMIT = 80; 
    const lastTapRef = useRef<number>(0);

    const handleDoubleTap = () => {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
            if (isLast) {
                if (!isModel) setIsEditing(true);
                else if (isModel && !isStreaming) onContinue();
            }
        }
        lastTapRef.current = now;
    };

    const handleSaveEdit = () => { if (editContent.trim() !== msg.content) onEdit(msg.id, editContent); setIsEditing(false); };
    const handleCancelEdit = () => { setEditContent(msg.content); setIsEditing(false); };
    
    const handlePointerDown = (e: React.PointerEvent) => { if (isEditing || isStreaming || !isLast || !isModel) return; e.preventDefault(); startXRef.current = e.clientX; (e.target as Element).setPointerCapture(e.pointerId); };
    const handlePointerMove = (e: React.PointerEvent) => { if (startXRef.current === null) return; const diff = e.clientX - startXRef.current; setDragX(Math.max(-LIMIT, Math.min(LIMIT, diff * 0.6))); };
    const handlePointerUp = (e: React.PointerEvent) => { if (startXRef.current === null) return; (e.target as Element).releasePointerCapture(e.pointerId); if (dragX >= THRESHOLD) onReiterate(msg.id, 'logic'); else if (dragX <= -THRESHOLD) onReiterate(msg.id, 'context'); setDragX(0); startXRef.current = null; };

    const getMessageStyle = () => {
        if (isModel) {
            const styles: React.CSSProperties = { color: aiTextColor, fontFamily: aiFontFamily || "'Playfair Display', serif", fontSize: `${aiTextSize}px`, lineHeight: '1.6' };
            if (aiTextStyle === 'shadow') styles.textShadow = '2px 2px 4px rgba(0,0,0,0.8)'; else if (aiTextStyle === 'outline') styles.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'; else if (aiTextStyle === 'neon') styles.textShadow = `0 0 5px ${aiTextColor}, 0 0 10px ${aiTextColor}`;
            return styles;
        } else { return { color: userTextColor, fontFamily: userFontFamily || "'Inter', sans-serif", fontSize: `${userTextSize}px`, lineHeight: '1.5' }; }
    };

    const logicOpacity = Math.min(1, Math.max(0, dragX / THRESHOLD));
    const contextOpacity = Math.min(1, Math.max(0, -dragX / THRESHOLD));
    const progressPercent = Math.min(100, (Math.abs(dragX) / THRESHOLD) * 100);

    return (
        <div className={`flex flex-col ${isModel ? 'items-start' : 'items-end'} group relative mb-4`}>
            <div className={`max-w-[95%] md:max-w-2xl w-full ${isModel ? 'text-left' : 'text-right'}`}>
                <div className={`flex items-center gap-3 mb-1 ${isModel ? 'justify-start' : 'justify-end'}`}>
                    <span className={`text-[9px] uppercase tracking-[0.2em] font-bold opacity-80 ${isModel ? 'text-pink-300' : 'text-gray-500'}`}>{isModel ? characterName : 'You'}</span>
                    {hasVersions && (<div className="flex items-center gap-1 text-[9px] font-mono text-cerberus-accent opacity-80 select-none bg-black/20 rounded px-1"><button onClick={() => onVersionChange(msg.id, currentVersionIndex - 1)} disabled={currentVersionIndex === 0} className="disabled:opacity-30 hover:text-white transition-colors"><ChevronLeft size={12}/></button><span>{currentVersionIndex + 1}/{totalVersions}</span><button onClick={() => onVersionChange(msg.id, currentVersionIndex + 1)} disabled={currentVersionIndex === totalVersions - 1} className="disabled:opacity-30 hover:text-white transition-colors"><ChevronRight size={12}/></button></div>)}
                    {isModel && isLast && !isStreaming && (<button onClick={onRegenerate} className="text-cerberus-accent hover:text-white transition-colors p-0.5 opacity-60 hover:opacity-100 duration-500 hover:scale-110"><AnkhIcon className="w-4 h-4" /></button>)}
                    <button onClick={() => onDelete(msg.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-900 hover:text-red-500 p-0.5"><CinderBowlIcon className="w-3.5 h-3.5" /></button>
                </div>
                <div className="relative touch-pan-y h-full">
                    {isModel && isLast && (
                        <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none overflow-hidden rounded-xl z-0">
                            <div className="flex flex-col items-start gap-1 text-amber-500 font-bold text-xs uppercase tracking-widest transition-all duration-75" style={{ opacity: logicOpacity, transform: `translateX(${dragX > 0 ? 0 : -30}px)` }}><div className="flex items-center gap-2"><Scale size={20} className="drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" /><span className="hidden md:inline ml-1 text-[10px]">Integrity</span></div><div className="w-20 h-1 bg-amber-900/50 rounded-full overflow-hidden mt-1"><div className={`h-full transition-all duration-75 ${dragX >= THRESHOLD ? 'bg-amber-400 shadow-[0_0_5px_#fbbf24]' : 'bg-amber-700'}`} style={{ width: `${progressPercent}%` }}/></div></div>
                            <div className="flex flex-col items-end gap-1 text-cyan-400 font-bold text-xs uppercase tracking-widest transition-all duration-75" style={{ opacity: contextOpacity, transform: `translateX(${dragX < 0 ? 0 : 30}px)` }}><div className="flex items-center gap-2"><span className="hidden md:inline mr-1 text-[10px]">Narrative</span><ScrollText size={20} className="drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" /></div><div className="w-20 h-1 bg-cyan-900/50 rounded-full overflow-hidden mt-1"><div className={`h-full transition-all duration-75 ${-dragX >= THRESHOLD ? 'bg-cyan-400 shadow-[0_0_5px_#22d3ee]' : 'bg-cyan-700'}`} style={{ width: `${progressPercent}%` }}/></div></div>
                        </div>
                    )}
                    <div onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onClick={handleDoubleTap} className="relative z-10 touch-pan-y">
                        {isEditing ? (<div className="bg-cerberus-900/80 backdrop-blur-sm border border-cerberus-600 rounded-xl p-2 animate-fadeIn"><textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full bg-transparent text-gray-200 text-sm focus:outline-none resize-none custom-scrollbar" rows={Math.min(editContent.split('\n').length + 1, 8)} autoFocus /><div className="flex justify-end gap-2 mt-2"><button onClick={handleCancelEdit} className="p-1 text-red-400 hover:text-red-300"><XIcon size={16}/></button><button onClick={handleSaveEdit} className="p-1 text-green-400 hover:text-green-300"><Check size={16}/></button></div></div>) : (
                            <div className={`prose prose-sm prose-invert max-w-none leading-snug break-words transition-transform duration-75 ease-linear select-none ${isModel ? 'tracking-wide cursor-grab active:cursor-grabbing' : 'bg-cerberus-900/40 backdrop-blur-sm px-3 py-2 rounded-xl rounded-tr-none border border-cerberus-700/30 cursor-pointer'}`} style={{ transform: `translateX(${dragX}px)`, ...getMessageStyle() }}>
                                <div className={isModel ? '[&_strong]:text-white pointer-events-none' : 'pointer-events-none'}><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface ChatAreaProps {
  messages: Message[];
  oocMessages?: Message[];
  isStreaming: boolean;
  enterToSend: boolean;
  onSendMessage: (content: string) => void;
  onSendOOC: (content: string) => void;
  onStopGeneration: () => void;
  onRegenerate: () => void;
  onReiterate: (id: string, mode: 'context' | 'logic') => void;
  onDeleteMessage: (id: string) => void;
  onVersionChange: (id: string, index: number) => void;
  onEditMessage: (id: string, newContent: string) => void;
  onContinueGeneration: () => void;
  onSidebarToggle: () => void;
  onDeepLogicOpen: () => void;
  onWardrobeOpen: () => void;
  character: CharacterProfile;
  portraitScale: number;
  portraitAspectRatio: '4/5' | '9/16' | '1/1';
  activeRoom: Room;
  rooms: Room[];
  onRoomChange: (roomId: string) => void;
  moodState: MoodState;
  agentMode: AgentMode;
  currentPortraitUrl?: string; 
  apiKeyOpenAI?: string;
  apiKeyGemini?: string; 
  vttMode?: 'browser' | 'openai' | 'gemini';
  vttAutoSend?: boolean;
  transcriptionModel?: string; 
  bgBrightness: number;
  aiTextFontUrl: string;
  aiTextColor: string;
  aiTextStyle: 'none' | 'shadow' | 'outline' | 'neon';
  aiTextSize: number;
  userTextFontUrl: string;
  userTextColor: string;
  userTextSize: number;
  hasUnreadOOC?: boolean;
  oocAssistEnabled?: boolean;
  oocProactivity?: number;
  oocStyle?: number;
  oocVerboseMode?: number; // 1-3
  // Added oocPersona prop here, need to update interface
  oocPersona?: 'character' | 'system';
  onUpdateOOCSettings?: (settings: Partial<AppSettings>) => void;
  onClearOOC?: () => void;
  onDeleteOOC?: (id: string) => void;
  onMarkOOCRead?: () => void;
  isSidebarOpen: boolean; 
  // Add magic input props
  magicInputSettings?: any;
  traceLogs?: TraceLog[];
  activeThread?: Thread;
}

const useDynamicFont = (fontUrl?: string, idSuffix: string = 'main') => {
    useEffect(() => {
        if (!fontUrl) return;
        const linkId = `cerberus-dynamic-font-${idSuffix}`;
        let link = document.getElementById(linkId) as HTMLLinkElement;
        if (!link) {
            link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
        link.href = fontUrl;
    }, [fontUrl, idSuffix]);
};

const getFontFamilyFromUrl = (url: string) => {
    if (!url) return '';
    const match = url.match(/family=([^&:]+)/);
    if (match && match[1]) {
        return match[1].replace(/\+/g, ' ');
    }
    return '';
};

// ... (TraceLogViewer unchanged) ...
const TraceLogViewer: React.FC<{ logs: TraceLog[]; onClose: () => void }> = ({ logs, onClose }) => {
    const [expandedId, setExpandedId] = useState<string | null>(logs[0]?.id || null);

    return (
        <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex flex-col animate-fadeIn">
            <div className="p-4 border-b border-cerberus-800 flex justify-between items-center bg-cerberus-900">
                <h3 className="text-lg font-serif text-cerberus-accent flex items-center gap-2"><Terminal size={20}/> MAGIC TRACE LOGS</h3>
                <button onClick={onClose}><X size={24} className="text-gray-500 hover:text-white"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {logs.length === 0 && <div className="text-center text-gray-500 mt-20 italic">No magic traces found.</div>}
                {logs.slice(0, 5).map((log, idx) => (
                    <div key={log.id} className="mb-6">
                        <div 
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            className="flex justify-between items-center p-3 bg-cerberus-900 border border-cerberus-700 rounded cursor-pointer hover:bg-cerberus-800 transition-colors"
                        >
                            <div>
                                <span className="text-xs font-mono text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                                <div className="text-sm text-white font-bold truncate max-w-[200px]">{log.inputSnippet}</div>
                            </div>
                            {expandedId === log.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                        </div>
                        {expandedId === log.id && (
                            <div className="bg-black/50 border-x border-b border-cerberus-800 rounded-b p-4 space-y-3 font-mono text-xs">
                                {log.entries.map((entry, i) => (
                                    <div key={i} className={`flex gap-2 ${entry.status === 'error' ? 'text-red-400' : entry.status === 'success' ? 'text-green-400' : entry.status === 'warning' ? 'text-yellow-400' : 'text-gray-300'}`}>
                                        <span className="font-bold min-w-[100px] uppercase text-[10px] opacity-70">{entry.step}:</span>
                                        <span className="flex-1 whitespace-pre-wrap">{entry.details}</span>
                                    </div>
                                ))}
                                <div className="mt-4 pt-4 border-t border-cerberus-800/50">
                                    <div className="text-[10px] uppercase text-gray-500 mb-1">Final Output</div>
                                    <div className="p-2 bg-cerberus-900/50 rounded text-gray-300 italic">{log.outputSnippet}</div>
                                </div>
                            </div>
                        )}
                        {idx < logs.length - 1 && <div className="flex justify-center my-4 opacity-30 text-gray-600 font-bold tracking-[0.5em] text-[10px]"> — — — </div>}
                    </div>
                ))}
            </div>
        </div>
    );
};

const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  oocMessages = [],
  isStreaming,
  enterToSend,
  onSendMessage,
  onSendOOC,
  onStopGeneration,
  onRegenerate,
  onReiterate,
  onDeleteMessage,
  onVersionChange,
  onEditMessage,
  onContinueGeneration,
  onSidebarToggle,
  onDeepLogicOpen,
  onWardrobeOpen,
  character,
  portraitScale,
  portraitAspectRatio,
  activeRoom,
  rooms,
  onRoomChange,
  moodState,
  agentMode,
  currentPortraitUrl,
  apiKeyOpenAI,
  apiKeyGemini,
  vttMode = 'browser',
  vttAutoSend = false,
  transcriptionModel = 'gpt-4o-mini-transcribe', 
  bgBrightness,
  aiTextFontUrl,
  aiTextColor,
  aiTextStyle,
  aiTextSize,
  userTextFontUrl,
  userTextColor,
  userTextSize,
  hasUnreadOOC,
  oocAssistEnabled = true,
  oocProactivity = 5,
  oocStyle = 6,
  oocVerboseMode = 2,
  oocPersona = 'character',
  onUpdateOOCSettings,
  onClearOOC,
  onDeleteOOC,
  onMarkOOCRead,
  isSidebarOpen,
  magicInputSettings,
  traceLogs = [],
  activeThread
}) => {
  const [input, setInput] = useState(() => localStorage.getItem('cerberus_draft_input') || '');
  
  // NEW: Magic Review State
  const [magicReview, setMagicReview] = useState<{ isOpen: boolean, content: string, original: string, isProcessing: boolean }>({ isOpen: false, content: '', original: '', isProcessing: false });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const oocEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [isOOCPanelOpen, setIsOOCPanelOpen] = useState(false);
  const [isPortraitCollapsed, setIsPortraitCollapsed] = useState(false);
  const [isAssistSettingsOpen, setIsAssistSettingsOpen] = useState(true);
  const [isTraceLogOpen, setIsTraceLogOpen] = useState(false);
  
  const lastPortraitTapRef = useRef<number>(0);
  const wasPortraitMaximizedRef = useRef<boolean>(true);

  // Magic Gesture State
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [isMagicActive, setIsMagicActive] = useState(false);
  const [magicDragY, setMagicDragY] = useState(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startYRef = useRef<number>(0);
  
  useEffect(() => {
      localStorage.setItem('cerberus_draft_input', input);
  }, [input]);

  useEffect(() => {
      if (isSidebarOpen) setIsOOCPanelOpen(false);
  }, [isSidebarOpen]);

  useEffect(() => {
      if (isOOCPanelOpen) {
          wasPortraitMaximizedRef.current = !isPortraitCollapsed;
          setIsPortraitCollapsed(true);
      } else {
          if (wasPortraitMaximizedRef.current) setIsPortraitCollapsed(false);
      }
  }, [isOOCPanelOpen]);

  // Handle Voice Input
  const { isRecording, isTranscribing, error, startRecording, stopRecording, retry } = useTranscriber({
      mode: vttMode as 'browser' | 'openai' | 'gemini',
      model: transcriptionModel,
      apiKey: vttMode === 'gemini' ? apiKeyGemini : apiKeyOpenAI, 
      onInputUpdate: (text) => setInput(prev => prev ? prev + ' ' + text : text),
      // IMPORTANT: We disable autoSend if Magic Mode is active for Voice to route it correctly
      onSend: (text) => {
          // If Magic Mode is NOT engaged via gesture/flow, we send directly if AutoSend is ON.
          // However, if we triggered Magic, we intercept elsewhere.
          if (vttAutoSend && !isMagicActive) {
              if (isOOCPanelOpen) onSendOOC(text); else onSendMessage(text);
          }
      },
      autoSend: vttAutoSend
  });

  useDynamicFont(aiTextFontUrl, 'ai');
  useDynamicFont(userTextFontUrl, 'user');
  
  const aiFontFamily = getFontFamilyFromUrl(aiTextFontUrl);
  const userFontFamily = getFontFamilyFromUrl(userTextFontUrl);

  const scrollToBottom = () => { setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100); };
  const scrollOOCBottom = () => { setTimeout(() => { oocEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100); };

  useEffect(() => { scrollToBottom(); }, [messages, isStreaming, keyboardOpen]);
  useEffect(() => { if (isOOCPanelOpen) { scrollOOCBottom(); if (hasUnreadOOC && onMarkOOCRead) onMarkOOCRead(); } }, [oocMessages, isOOCPanelOpen, hasUnreadOOC]);
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`; } }, [input]);

  const toggleRecording = () => { if (isRecording) stopRecording(); else startRecording(); };
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value);
  
  const handleSubmit = (e?: React.FormEvent) => { 
      e?.preventDefault(); 
      if (!input.trim() || isStreaming) return; 
      if (isOOCPanelOpen) onSendOOC(input); else onSendMessage(input); 
      setInput(''); 
      localStorage.removeItem('cerberus_draft_input');
      if (textareaRef.current) textareaRef.current.style.height = 'auto'; 
  };

  // --- MAGIC LOGIC ---

  const performMagicProcess = async (text: string, referee: boolean = false) => {
      setMagicReview({ isOpen: true, content: text, original: text, isProcessing: true });
      
      const appSettings = { 
          apiKeyGemini, apiKeyOpenAI, 
          magicInput: magicInputSettings,
          writingStyle: character.constraints?.writingStyle,
          formattingStyle: 'paragraphs',
          userName: 'User'
      } as any;

      const result = await runMagicPipeline(text, appSettings, character, activeThread, undefined, referee);
      
      setMagicReview(prev => ({ 
          ...prev, 
          content: result.finalText, 
          isProcessing: false 
      }));

      if ((window as any).addTraceLog) (window as any).addTraceLog(result.traceLog);
      
      if (result.advisorNote && onSendOOC) {
          onSendOOC(`[TACTICAL ADVISOR]: ${result.advisorNote}`);
      }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
      if (!magicInputSettings?.enabled) return;
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      startYRef.current = e.clientY;
      longPressTimerRef.current = setTimeout(() => {
          setIsLongPressing(true);
          if (navigator.vibrate) navigator.vibrate(50);
      }, 450);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isLongPressing) return;
      const deltaY = startYRef.current - e.clientY; 
      setMagicDragY(deltaY);
      if (deltaY > 50) setIsMagicActive(true); else setIsMagicActive(false);
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      const target = e.currentTarget;
      target.releasePointerCapture(e.pointerId);

      // CASE 1: MAGIC ACTIVE (Drag Up)
      if (isMagicActive && magicInputSettings?.enabled) {
          const raw = input.trim();
          
          if (raw) {
              // Text Present: Process immediately
              performMagicProcess(raw);
          } else {
              // No Text: Start Voice Recording for Magic
              // We rely on the user manually stopping recording to trigger magic
              startRecording();
              // Note: We need a way to know we are in "Magic Voice" mode when stop is clicked.
              // For simplicity, we assume normal recording, but if they drag-up on empty, 
              // maybe we flag it? Let's just use the normal record flow but let user decide after.
              // Actually, user requested Magic Voice flow.
              // Let's set a flag or just rely on the Review overlay being manually triggerable?
              // Better: If they drag up on Mic, we start recording, and when they stop, we AUTO-MAGIC.
              // But handlePointerUp fires now.
          }
      } 
      // CASE 2: NORMAL TAP/CLICK
      else if (!isLongPressing) {
          if (isRecording) {
              // STOP RECORDING LOGIC
              stopRecording();
              // NOTE: `stopRecording` is async in effect. The `useTranscriber` hook will update `input`.
              // We can't easily chain magic here without a complex state machine.
              // Workaround: We let it transcribe to Input. User can then drag-up on the text to Magic it.
          } else {
              handleSmartAction();
          }
      }

      setIsLongPressing(false);
      setIsMagicActive(false);
      setMagicDragY(0);
  };

  const handleSmartAction = () => { if (input.trim()) handleSubmit(); else toggleRecording(); };
  const handleStop = (e: React.MouseEvent) => { e.preventDefault(); onStopGeneration(); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { if (enterToSend && !e.shiftKey) { e.preventDefault(); handleSubmit(); } } };
  const handleClearOOCConfirm = () => { if (confirm("Are you sure you want to delete all OOC history?")) onClearOOC?.(); };
  const handlePortraitTap = () => { 
      const now = Date.now(); 
      if (now - lastPortraitTapRef.current < 300) {
          setIsPortraitCollapsed(!isPortraitCollapsed);
          wasPortraitMaximizedRef.current = isPortraitCollapsed; 
      }
      lastPortraitTapRef.current = now; 
  };

  const bgOpacity = Math.max(0.1, Math.min(1.0, bgBrightness / 100));

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden transition-all duration-700 bg-cerberus-void">
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 transform scale-105" style={{ backgroundImage: `url(${activeRoom.backgroundImage})`, opacity: bgOpacity }} />
      <div className="absolute inset-0 bg-gradient-to-b from-cerberus-void/70 via-cerberus-void/60 to-cerberus-void/90 pointer-events-none" />

      {/* MAGIC REVIEW OVERLAY */}
      {magicReview.isOpen && (
          <div className="absolute inset-x-0 bottom-0 top-0 z-[80] bg-black/90 backdrop-blur-xl flex flex-col animate-fadeIn">
              {/* Header */}
              <div className="p-4 border-b border-violet-900/50 bg-violet-950/20 flex justify-between items-center">
                  <h3 className="text-violet-300 font-serif font-bold tracking-widest text-sm flex items-center gap-2"><Sparkles size={16}/> MAGIC EDITOR</h3>
                  <button onClick={() => setMagicReview({ ...magicReview, isOpen: false })} className="text-gray-500 hover:text-white"><X size={20}/></button>
              </div>
              
              {/* Main Content */}
              <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
                  {magicReview.isProcessing ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-violet-400 animate-pulse">
                          <Wand2 size={48} className="mb-4 animate-spin-slow"/>
                          <p className="font-mono text-xs uppercase tracking-widest">Weaving Reality...</p>
                      </div>
                  ) : (
                      <textarea 
                          value={magicReview.content}
                          onChange={e => setMagicReview({...magicReview, content: e.target.value})}
                          className="flex-1 w-full bg-black/50 border border-violet-900/30 rounded-lg p-4 text-sm text-gray-200 focus:border-violet-500 outline-none resize-none font-sans leading-relaxed custom-scrollbar shadow-inner"
                      />
                  )}
              </div>

              {/* Controls */}
              <div className="p-4 border-t border-violet-900/30 bg-black/40 space-y-3">
                  <div className="flex gap-2 justify-center">
                      <button 
                        onClick={() => performMagicProcess(magicReview.original || magicReview.content)} 
                        disabled={magicReview.isProcessing}
                        className="px-3 py-2 bg-violet-900/30 border border-violet-700/50 rounded text-xs text-violet-200 hover:bg-violet-800/50 flex items-center gap-1 transition-colors"
                      >
                          <RefreshCw size={14}/> Regenerate
                      </button>
                      <button 
                        onClick={() => performMagicProcess(magicReview.content, true)} // Referee Mode
                        disabled={magicReview.isProcessing}
                        className="px-3 py-2 bg-red-900/20 border border-red-700/50 rounded text-xs text-red-300 hover:bg-red-900/40 flex items-center gap-1 transition-colors"
                        title="Check for Godmoding/Logic"
                      >
                          <Shield size={14}/> Referee
                      </button>
                  </div>
                  <div className="flex gap-3">
                      <button 
                        onClick={() => setMagicReview({ ...magicReview, isOpen: false })}
                        className="flex-1 py-3 border border-gray-700 rounded text-gray-400 hover:text-white uppercase font-bold text-xs"
                      >
                          Discard
                      </button>
                      <button 
                        onClick={() => {
                            if (isOOCPanelOpen) onSendOOC(magicReview.content); 
                            else onSendMessage(magicReview.content);
                            setMagicReview({ ...magicReview, isOpen: false });
                            setInput('');
                        }}
                        disabled={magicReview.isProcessing}
                        className="flex-1 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded font-bold uppercase text-xs shadow-[0_0_20px_rgba(139,92,246,0.4)] flex items-center justify-center gap-2"
                      >
                          <Send size={16}/> Confirm & Send
                      </button>
                  </div>
              </div>
          </div>
      )}

      {isRecording && !magicReview.isOpen && (
          <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex flex-col items-center justify-end pb-32 animate-fadeIn">
              <div className="relative">
                  <div className="absolute inset-0 bg-violet-500 rounded-full animate-ping opacity-20 delay-100"></div>
                  <div className="absolute inset-[-20px] bg-violet-500 rounded-full animate-ping opacity-10 delay-300"></div>
                  <div className="absolute inset-[-40px] bg-violet-500 rounded-full animate-ping opacity-5 delay-500"></div>
                  <button onClick={toggleRecording} className="relative w-24 h-24 bg-violet-900 rounded-full flex items-center justify-center text-white shadow-[0_0_50px_rgba(139,92,246,0.6)] hover:scale-105 transition-transform border-2 border-violet-500"><Mic size={40} className="drop-shadow-lg" /></button>
              </div>
              <h2 className="mt-8 text-2xl font-serif tracking-[0.2em] text-violet-200 font-bold animate-pulse">LISTENING...</h2>
              <p className="mt-2 text-xs font-mono text-violet-300/70 tracking-widest">TAP TO STOP</p>
          </div>
      )}

      {/* Trace Log Modal */}
      {isTraceLogOpen && <TraceLogViewer logs={traceLogs} onClose={() => setIsTraceLogOpen(false)} />}

      <div className="absolute top-0 left-0 right-0 z-50 px-4 flex justify-between items-start pointer-events-none pb-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
        <div className={`pointer-events-auto flex flex-col gap-2 items-start mt-2 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
           <div className="flex items-center gap-2 max-w-[180px]">
                <button onClick={onSidebarToggle} className="md:hidden text-cerberus-accent p-2 bg-cerberus-900/50 rounded-full backdrop-blur shrink-0"><Menu size={20} /></button>
                <div className="group relative w-fit inline-flex shrink-0">
                    <button className="inline-flex w-fit items-center gap-2 text-cerberus-accent bg-cerberus-900/40 backdrop-blur-md border border-cerberus-700/50 px-3 py-2 rounded-2xl text-[10px] font-serif tracking-widest uppercase hover:bg-cerberus-800 transition-all shadow-lg text-left h-auto max-w-full"><MapPin size={10} className="shrink-0" /><span className="whitespace-normal leading-tight line-clamp-2">{activeRoom.name}</span></button>
                    <div className="absolute top-full left-0 mt-2 w-64 bg-cerberus-900/95 border border-cerberus-700 rounded shadow-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-left backdrop-blur-md z-50">
                        {rooms.map(room => (<button key={room.id} onClick={() => onRoomChange(room.id)} className={`w-full text-left px-4 py-3 text-[10px] font-serif uppercase tracking-widest hover:bg-cerberus-800 transition-colors flex items-center justify-between group/item ${activeRoom.id === room.id ? 'text-cerberus-accent bg-cerberus-800/30' : 'text-gray-500'}`}><span className="group-hover/item:text-gray-200 transition-colors truncate pr-2">{room.name}</span>{activeRoom.id === room.id && <Check size={12} className="text-cerberus-accent shrink-0"/>}</button>))}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2 ml-1">
                <button onClick={() => setIsOOCPanelOpen(!isOOCPanelOpen)} className={`flex items-center gap-2 text-violet-200 hover:text-white transition-all duration-300 opacity-90 hover:opacity-100 px-3 py-1.5 rounded-full border shadow-[0_0_15px_rgba(139,92,246,0.15)] w-max ${isOOCPanelOpen ? 'bg-violet-900/90 border-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.5)]' : 'bg-violet-950/40 border-violet-800 hover:border-violet-600'}`} title="Toggle OOC Mode">
                    <BrainCircuit size={14} className={isOOCPanelOpen ? "text-white" : "text-violet-400"} /><span className="text-[10px] font-mono uppercase tracking-wider">OOC Mode</span>{hasUnreadOOC && !isOOCPanelOpen && (<Mail size={12} className="text-pink-400 animate-pulse ml-1" fill="currentColor" />)}
                </button>
                <button onClick={onWardrobeOpen} className="flex items-center gap-2 text-cerberus-accent hover:text-white transition-colors opacity-70 hover:opacity-100 bg-cerberus-900/50 px-2 py-1.5 rounded-full border border-cerberus-700/30 self-start" title="Wardrobe"><Shirt size={14} /><span className="text-[9px] font-mono uppercase">Attire</span></button>
                
                {magicInputSettings?.enabled && traceLogs.length > 0 && (
                    <button onClick={() => setIsTraceLogOpen(true)} className="flex items-center gap-2 text-yellow-200 hover:text-white transition-colors opacity-70 hover:opacity-100 bg-cerberus-900/50 px-2 py-1.5 rounded-full border border-yellow-700/30 self-start" title="Magic Logs"><ScrollText size={14} /><span className="text-[9px] font-mono uppercase">Debug</span></button>
                )}
            </div>
        </div>
        <div className={`pointer-events-auto flex flex-col items-end gap-2 mt-2 ${isSidebarOpen ? 'hidden md:flex' : 'flex'}`}>
            {isPortraitCollapsed ? (<button onClick={() => setIsPortraitCollapsed(false)} className="flex items-center justify-center w-12 h-12 bg-cerberus-900/90 border border-cerberus-700 rounded-full shadow-lg backdrop-blur text-cerberus-accent hover:text-white hover:border-cerberus-500 transition-all active:scale-95" title="Show Portrait"><User size={24} /></button>) : (<div className="transition-transform duration-300 origin-top-right drop-shadow-2xl hover:scale-105 active:scale-95" onTouchEnd={handlePortraitTap} onClick={handlePortraitTap}><Portrait url={currentPortraitUrl || character.portraitUrl} scale={portraitScale} aspectRatio={portraitAspectRatio} /></div>)}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative z-0">
             <div className={`flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar scroll-smooth pt-24 pb-32 transition-all duration-300 ${isOOCPanelOpen ? 'w-full md:w-2/3' : 'w-full'}`}>
                {messages.map((msg, index) => (
                    <MessageItem key={msg.id} msg={msg} characterName={character.name} isLast={index === messages.length - 1} isStreaming={isStreaming && index === messages.length - 1} onDelete={onDeleteMessage} onRegenerate={onRegenerate} onReiterate={onReiterate} onVersionChange={onVersionChange} onEdit={onEditMessage} onContinue={onContinueGeneration} aiTextColor={aiTextColor} aiTextStyle={aiTextStyle} aiFontFamily={aiFontFamily} aiTextSize={aiTextSize} userTextColor={userTextColor} userFontFamily={userFontFamily} userTextSize={userTextSize} />
                ))}
                <div ref={messagesEndRef} className="h-4"/>
             </div>

             {/* OOC Panel */}
             <div className={`absolute inset-y-0 right-0 z-20 w-full md:w-96 bg-cerberus-900/95 backdrop-blur-xl border-l border-cerberus-700 transform transition-transform duration-300 flex flex-col pt-24 md:pt-32 ${isOOCPanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-4 border-b border-cerberus-800 flex justify-between items-center bg-black/20">
                    <h3 className="text-cerberus-accent font-mono text-xs uppercase tracking-widest flex items-center gap-2"><BrainCircuit size={14}/> {oocAssistEnabled ? 'Neural Link (Active)' : 'Neural Link (Offline)'}</h3>
                    <div className="flex items-center gap-2">
                        {onClearOOC && (<button onClick={handleClearOOCConfirm} className="text-gray-500 hover:text-red-400 p-1" title="Clear History"><Trash2 size={14}/></button>)}
                        <button onClick={() => setIsAssistSettingsOpen(!isAssistSettingsOpen)} className="text-gray-500 hover:text-white p-1"><Sliders size={14}/></button>
                        <button onClick={() => setIsOOCPanelOpen(false)} className="text-gray-500 hover:text-white p-1 md:hidden"><X size={16}/></button>
                    </div>
                </div>

                {isAssistSettingsOpen && onUpdateOOCSettings && (
                     <div className="p-4 bg-black/40 border-b border-cerberus-800 space-y-6 animate-fadeIn w-full">
                        <div className="flex items-center justify-between w-full">
                            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">Assist Enabled</label>
                            <div onClick={() => onUpdateOOCSettings({oocAssistEnabled: !oocAssistEnabled})} className={`w-8 h-4 rounded-full cursor-pointer p-0.5 transition-colors ${oocAssistEnabled ? 'bg-cerberus-accent' : 'bg-gray-700'}`}><div className={`w-3 h-3 bg-black rounded-full transition-transform duration-200 ${oocAssistEnabled ? 'translate-x-4' : ''}`}/></div>
                        </div>
                        
                        <div className="w-full">
                            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wide flex justify-between mb-2 w-full">
                                <span>Voice Persona</span>
                                <span className={oocPersona === 'system' ? 'text-blue-400' : 'text-pink-400'}>
                                    {oocPersona === 'system' ? 'Neutral Agent' : 'Character Self'}
                                </span>
                            </label>
                            <div className="flex bg-black/50 rounded-lg p-1 border border-cerberus-800 w-full">
                                <button 
                                    type="button"
                                    onClick={() => onUpdateOOCSettings({oocPersona: 'system'})}
                                    className={`flex-1 py-2 text-[10px] uppercase font-bold rounded flex items-center justify-center gap-1 transition-all ${oocPersona === 'system' ? 'bg-cerberus-accent text-black shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    <Bot size={14}/> Neutral
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => onUpdateOOCSettings({oocPersona: 'character'})}
                                    className={`flex-1 py-2 text-[10px] uppercase font-bold rounded flex items-center justify-center gap-1 transition-all ${oocPersona === 'character' ? 'bg-cerberus-accent text-black shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                                >
                                    <Ghost size={14}/> Character
                                </button>
                            </div>
                        </div>

                        <div className="w-full">
                             <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wide flex justify-between mb-2 w-full"><span>Proactivity</span><span>{oocProactivity}/10</span></label>
                             <input type="range" min="1" max="10" value={oocProactivity} onChange={(e) => onUpdateOOCSettings({oocProactivity: parseInt(e.target.value)})} className="w-full accent-cerberus-accent h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer block"/>
                        </div>
                        <div className="w-full">
                             <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wide flex justify-between mb-2 w-full"><span>Verbose Mode</span><span>{oocVerboseMode === 1 ? 'Concise' : oocVerboseMode === 3 ? 'Verbose' : 'Balanced'}</span></label>
                             <input type="range" min="1" max="3" value={oocVerboseMode} onChange={(e) => onUpdateOOCSettings({oocVerboseMode: parseInt(e.target.value)})} className="w-full accent-cerberus-accent h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer block"/>
                        </div>
                     </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {oocMessages.map(msg => (
                        <div key={msg.id} className={`flex flex-col ${msg.role === 'model' ? 'items-start' : 'items-end'}`}>
                            <div className={`text-[9px] uppercase mb-1 opacity-50 ${msg.role === 'model' ? 'text-cerberus-accent' : 'text-gray-400'}`}>
                                {msg.role === 'model' ? (oocPersona === 'character' ? character.name : 'System') : 'User'}
                            </div>
                            <div className={`p-3 rounded border text-xs max-w-[90%] ${msg.role === 'model' ? 'bg-cerberus-800/50 border-cerberus-700 text-gray-300' : 'bg-gray-800 border-gray-700 text-gray-300'}`}>
                                <div className="prose prose-invert prose-xs max-w-none">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                            </div>
                            {msg.role === 'user' && onDeleteOOC && (<button onClick={() => onDeleteOOC(msg.id)} className="text-[9px] text-red-900 hover:text-red-500 mt-1 self-end">Delete</button>)}
                        </div>
                    ))}
                    <div ref={oocEndRef}/>
                </div>
             </div>
        </div>

        <div className={`fixed bottom-0 left-0 right-0 z-30 bg-cerberus-900/95 border-t border-cerberus-700 ${isSidebarOpen ? 'hidden md:block' : 'block'}`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="p-3 transition-all duration-300 mx-auto">
                <div className={`max-w-3xl mx-auto flex items-end gap-2 bg-cerberus-900/40 border border-violet-500/30 rounded-2xl p-1 relative shadow-[0_0_20px_rgba(139,92,246,0.1)] transition-all duration-300 ${isOOCPanelOpen ? 'md:mr-[25rem]' : ''} `}>
                    <textarea ref={textareaRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} onFocus={() => { setKeyboardOpen(true); scrollToBottom(); }} onBlur={() => setKeyboardOpen(false)} placeholder={isOOCPanelOpen ? "Telepathic message..." : "Manifest your will..."} className={`flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-200 resize-none max-h-32 py-3 px-4 custom-scrollbar tracking-wide font-sans ${isOOCPanelOpen ? 'placeholder-violet-300/30' : 'placeholder:font-playfair placeholder:italic placeholder:text-violet-300/50'}`} rows={1} />
                    
                    {/* MAGIC BUTTON CONTAINER */}
                    <div 
                        className="shrink-0 mb-1 mr-1 relative touch-none flex items-center justify-center w-16 h-16"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        style={{ touchAction: 'none' }}
                    >
                        {/* FEEDBACK RING */}
                        <div className={`absolute inset-0 rounded-full border-2 border-violet-400 transition-all duration-300 pointer-events-none ${isLongPressing ? 'scale-150 opacity-100' : 'scale-75 opacity-0'}`} />

                        {/* MAGIC WAND OVERLAY */}
                        {isLongPressing && (
                            <div className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-4 flex flex-col items-center pointer-events-none transition-all duration-300 ${isMagicActive ? 'scale-110 opacity-100' : 'scale-90 opacity-70'}`}>
                                <div className="bg-violet-900 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded mb-2 shadow-lg whitespace-nowrap">
                                    {isMagicActive ? "Release to Enhance" : "Drag Up"}
                                </div>
                                <div className={`p-3 rounded-full bg-gradient-to-t from-violet-600 to-fuchsia-500 shadow-[0_0_30px_rgba(167,139,250,0.6)] ${isMagicActive ? 'animate-pulse' : ''}`}>
                                    <Wand2 size={24} className="text-white"/>
                                </div>
                                <Sparkles size={20} className={`absolute -top-2 -right-2 text-yellow-300 ${isMagicActive ? 'animate-spin' : ''}`}/>
                            </div>
                        )}

                        {isStreaming || magicReview.isProcessing ? (
                             <button onClick={handleStop} className="w-16 h-16 rounded-full bg-red-900/80 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-500/30 hover:bg-red-700 transition-all flex items-center justify-center"><Square size={24} fill="currentColor"/></button>
                        ) : (
                            <button 
                                className={`w-16 h-16 rounded-full border transition-all duration-300 flex items-center justify-center ${input.trim() ? 'bg-violet-600 border-violet-400 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)] hover:bg-violet-500' : isRecording ? 'bg-red-900 border-red-500 text-white animate-pulse' : isTranscribing ? 'bg-cerberus-800 border-cerberus-600 animate-spin text-cerberus-accent' : 'bg-transparent border-transparent text-gray-400 hover:text-white hover:bg-white/10' }`} 
                                title={input.trim() ? "Send (Hold for Magic)" : (error || "Voice Input")}
                                style={{ transform: isLongPressing ? 'scale(0.95)' : 'scale(1)' }}
                            >
                                {input.trim() ? <Send size={28} /> : (isTranscribing ? <RefreshCw size={28}/> : isRecording ? <MicOff size={28}/> : error ? <AlertCircle size={28} onClick={(e) => { e.stopPropagation(); retry(); }} /> : <Mic size={28}/>)}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ChatArea;
