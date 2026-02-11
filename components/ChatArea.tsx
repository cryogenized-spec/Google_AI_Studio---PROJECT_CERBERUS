import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Menu, Sparkles, MapPin, ShieldAlert, Square, Check, X as XIcon, Shirt, Mic, MicOff } from 'lucide-react';
import { Message, Room, CharacterProfile, MoodState, AgentMode } from '../types';
import Portrait from './Portrait';

// --- Icons (Vector Components) ---

const AnkhIcon = ({ className, onClick }: { className?: string, onClick?: () => void }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className} 
    onClick={onClick}
  >
    {/* Loop */}
    <path d="M12 2a4 4 0 0 1 4 4c0 2-2 4-4 4s-4-2-4-4a4 4 0 0 1 4-4z" />
    {/* Vertical Stem */}
    <path d="M12 10v12" />
    {/* Horizontal Bar */}
    <path d="M5 14h14" />
  </svg>
);

const CinderBowlIcon = ({ className, onClick }: { className?: string, onClick?: () => void }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className} 
    onClick={onClick}
  >
    {/* Bowl */}
    <path d="M4 12c0 4.418 3.582 8 8 8s8-3.582 8-8" />
    <path d="M4 12h16" />
    {/* Base */}
    <path d="M8 20l-2 3h12l-2-3" />
    {/* Flames */}
    <path d="M8 12c0-3 1-5 2-6" />
    <path d="M16 12c0-4-1.5-6-3-8" />
    <path d="M12 12c0-3.5 1-6 2-9" />
  </svg>
);

// --- Sub-Components ---

interface MessageItemProps {
    msg: Message;
    characterName: string;
    isLast: boolean;
    isStreaming: boolean;
    onDelete: (id: string) => void;
    onRegenerate: () => void;
    onVersionChange: (id: string, index: number) => void;
    onEdit: (id: string, newContent: string) => void;
    onContinue: () => void;
    
    // Aesthetic Props - Entity
    aiTextColor: string;
    aiTextStyle: 'none' | 'shadow' | 'outline' | 'neon';
    aiFontFamily: string;
    aiTextSize: number;

    // Aesthetic Props - User
    userTextColor: string;
    userFontFamily: string;
    userTextSize: number;
}

const MessageItem: React.FC<MessageItemProps> = ({ 
    msg, 
    characterName, 
    isLast,
    isStreaming,
    onDelete, 
    onRegenerate,
    onVersionChange,
    onEdit,
    onContinue,
    aiTextColor,
    aiTextStyle,
    aiFontFamily,
    aiTextSize,
    userTextColor,
    userFontFamily,
    userTextSize
}) => {
    const isModel = msg.role === 'model';
    const hasVersions = msg.versions && msg.versions.length > 1;
    const currentVersionIndex = msg.activeVersionIndex || 0;
    const totalVersions = msg.versions ? msg.versions.length : 1;
    
    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(msg.content);

    // Swipe State
    const [dragX, setDragX] = useState(0);
    const startXRef = useRef<number | null>(null);

    // Double Tap Logic
    const lastTapRef = useRef<number>(0);
    const handleDoubleTap = () => {
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;
        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
            // Action
            if (isLast) {
                if (!isModel) {
                    setIsEditing(true);
                } else if (isModel && !isStreaming) {
                    onContinue();
                }
            }
        }
        lastTapRef.current = now;
    };

    const handleSaveEdit = () => {
        if (editContent.trim() !== msg.content) {
            onEdit(msg.id, editContent);
        }
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setEditContent(msg.content);
        setIsEditing(false);
    };

    const handleStart = (clientX: number) => {
        if (!hasVersions || isEditing) return;
        startXRef.current = clientX;
    };

    const handleMove = (clientX: number) => {
        if (startXRef.current === null || !hasVersions || isEditing) return;
        const diff = clientX - startXRef.current;
        setDragX(diff / 2.5);
    };

    const handleEnd = () => {
        if (startXRef.current === null || !hasVersions || isEditing) {
            setDragX(0);
            return;
        }

        const threshold = 50; 
        if (dragX > threshold && currentVersionIndex > 0) {
             onVersionChange(msg.id, currentVersionIndex - 1);
        } else if (dragX < -threshold && currentVersionIndex < totalVersions - 1) {
             onVersionChange(msg.id, currentVersionIndex + 1);
        }
        
        setDragX(0);
        startXRef.current = null;
    };

    // Style Generation
    const getMessageStyle = () => {
        if (isModel) {
            const styles: React.CSSProperties = {
                color: aiTextColor,
                fontFamily: aiFontFamily || "'Playfair Display', serif",
                fontSize: `${aiTextSize}px`,
                lineHeight: '1.6'
            };

            if (aiTextStyle === 'shadow') {
                styles.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
            } else if (aiTextStyle === 'outline') {
                styles.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
            } else if (aiTextStyle === 'neon') {
                styles.textShadow = `0 0 5px ${aiTextColor}, 0 0 10px ${aiTextColor}`;
            }
            return styles;
        } else {
            // User Styles
            return {
                color: userTextColor,
                fontFamily: userFontFamily || "'Inter', sans-serif",
                fontSize: `${userTextSize}px`,
                lineHeight: '1.5'
            };
        }
    };

    return (
        <div className={`flex flex-col ${isModel ? 'items-start' : 'items-end'} group relative mb-4`}>
            <div className={`max-w-[95%] md:max-w-2xl w-full ${isModel ? 'text-left' : 'text-right'}`}>
                
                {/* Meta Controls */}
                <div className={`flex items-center gap-3 mb-1 ${isModel ? 'justify-start' : 'justify-end'}`}>
                    {/* Role Label */}
                    <span className={`text-[9px] uppercase tracking-[0.2em] font-bold opacity-80 ${isModel ? 'text-pink-300' : 'text-gray-500'}`}>
                        {isModel ? characterName : 'You'}
                    </span>
                    
                    {/* Version Indicator */}
                    {hasVersions && (
                        <span className="text-[9px] font-mono text-cerberus-accent opacity-80 select-none">
                            {currentVersionIndex + 1}/{totalVersions}
                        </span>
                    )}

                    {/* Regeneration Ankh - Only on last model message */}
                    {isModel && isLast && !isStreaming && (
                         <button 
                            onClick={onRegenerate}
                            className="text-cerberus-accent hover:text-white transition-colors p-0.5 opacity-60 hover:opacity-100 duration-500 hover:scale-110"
                            title="Regenerate"
                        >
                            <AnkhIcon className="w-4 h-4" />
                        </button>
                    )}

                    {/* Delete Button (Cinder Bowl) */}
                    <button 
                        onClick={() => onDelete(msg.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-900 hover:text-red-500 p-0.5"
                        title="Burn this memory"
                    >
                        <CinderBowlIcon className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Content Bubble */}
                <div 
                    className="relative touch-pan-y"
                    onMouseDown={(e) => handleStart(e.clientX)}
                    onMouseMove={(e) => handleMove(e.clientX)}
                    onMouseUp={handleEnd}
                    onMouseLeave={handleEnd}
                    onTouchStart={(e) => handleStart(e.touches[0].clientX)}
                    onTouchMove={(e) => handleMove(e.touches[0].clientX)}
                    onTouchEnd={handleEnd}
                    onClick={handleDoubleTap} 
                >
                    {isEditing ? (
                         <div className="bg-cerberus-900/80 backdrop-blur-sm border border-cerberus-600 rounded-xl p-2 animate-fadeIn">
                            <textarea 
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="w-full bg-transparent text-gray-200 text-sm focus:outline-none resize-none custom-scrollbar"
                                rows={Math.min(editContent.split('\n').length + 1, 8)}
                                autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={handleCancelEdit} className="p-1 text-red-400 hover:text-red-300"><XIcon size={16}/></button>
                                <button onClick={handleSaveEdit} className="p-1 text-green-400 hover:text-green-300"><Check size={16}/></button>
                            </div>
                         </div>
                    ) : (
                        <div 
                            className={`
                            prose prose-sm prose-invert max-w-none leading-snug break-words transition-transform duration-200 ease-out select-none
                            ${isModel 
                                ? 'tracking-wide cursor-grab active:cursor-grabbing' 
                                : 'bg-cerberus-900/40 backdrop-blur-sm px-3 py-2 rounded-xl rounded-tr-none border border-cerberus-700/30 cursor-pointer'}
                            `}
                            style={{ 
                                transform: `translateX(${dragX}px)`,
                                ...getMessageStyle() 
                            }}
                        >
                            <div className={isModel ? '[&_strong]:text-white pointer-events-none' : 'pointer-events-none'}>
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                        </div>
                    )}
                </div>

                {/* Pagination Dots */}
                {hasVersions && (
                    <div className="flex justify-center gap-1 mt-1">
                        {msg.versions.map((_, i) => (
                            <div 
                                key={i} 
                                className={`w-1 h-1 rounded-full ${i === currentVersionIndex ? 'bg-cerberus-accent' : 'bg-cerberus-800'}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};


// --- Main ChatArea ---

interface ChatAreaProps {
  messages: Message[];
  isStreaming: boolean;
  enterToSend: boolean;
  onSendMessage: (content: string) => void;
  onStopGeneration: () => void;
  onRegenerate: () => void;
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
  
  // Appearance Props
  bgBrightness: number;
  aiTextFontUrl: string;
  aiTextColor: string;
  aiTextStyle: 'none' | 'shadow' | 'outline' | 'neon';
  aiTextSize: number;
  
  // User Appearance Props
  userTextFontUrl: string;
  userTextColor: string;
  userTextSize: number;
}

// Helper to inject font dynamically
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

const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  isStreaming,
  enterToSend,
  onSendMessage,
  onStopGeneration,
  onRegenerate,
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
  bgBrightness,
  aiTextFontUrl,
  aiTextColor,
  aiTextStyle,
  aiTextSize,
  userTextFontUrl,
  userTextColor,
  userTextSize
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  
  // VTT State
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef('');

  // Dynamic Fonts
  useDynamicFont(aiTextFontUrl, 'ai');
  useDynamicFont(userTextFontUrl, 'user');
  
  const aiFontFamily = getFontFamilyFromUrl(aiTextFontUrl);
  const userFontFamily = getFontFamilyFromUrl(userTextFontUrl);

  const scrollToBottom = () => {
    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, keyboardOpen]);

  useEffect(() => {
    const handleResize = () => { scrollToBottom(); };
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleResize);
        return () => window.visualViewport?.removeEventListener('resize', handleResize);
    } else {
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    } else {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Voice recognition not supported in this browser.");
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      baseInputRef.current = input;
      recognition.onstart = () => { setIsRecording(true); };
      recognition.onresult = (event: any) => {
        const sessionTranscript = Array.from(event.results).map((res: any) => res[0].transcript).join('');
        const spacer = (baseInputRef.current && !baseInputRef.current.endsWith(' ')) ? ' ' : '';
        setInput(baseInputRef.current + spacer + sessionTranscript);
      };
      recognition.onerror = (event: any) => { console.error('Speech error', event.error); setIsRecording(false); };
      recognition.onend = () => { setIsRecording(false); };
      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (isRecording) baseInputRef.current = e.target.value;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSendMessage(input);
    setInput('');
    baseInputRef.current = '';
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleStop = (e: React.MouseEvent) => {
    e.preventDefault();
    onStopGeneration();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        if (enterToSend && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }
  };

  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
  const isScriptorium = activeRoom.id === 'scriptorium';

  const bgOpacity = Math.max(0.1, Math.min(1.0, bgBrightness / 100));

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden transition-all duration-700 bg-cerberus-void">
      
      {/* Immersive Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 transform scale-105"
        style={{ 
            backgroundImage: `url(${activeRoom.backgroundImage})`,
            opacity: bgOpacity
        }}
      />
      
      {/* Dynamic Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-cerberus-void/70 via-cerberus-void/60 to-cerberus-void/90 pointer-events-none" />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-start pointer-events-none">
        
        {/* Left Side: Controls & Status */}
        <div className="pointer-events-auto flex flex-col gap-3">
           {/* Room Selector */}
           <div className="flex items-center gap-2">
                <button onClick={onSidebarToggle} className="md:hidden text-cerberus-accent p-2 bg-cerberus-900/50 rounded-full backdrop-blur">
                    <Menu size={20} />
                </button>
                <div className="group relative">
                    <button className="flex items-center gap-2 text-cerberus-accent bg-cerberus-900/40 backdrop-blur-md border border-cerberus-700/50 px-3 py-1 rounded-full text-[10px] font-serif tracking-widest uppercase hover:bg-cerberus-800 transition-all shadow-lg">
                        <MapPin size={10} />
                        <span>{activeRoom.name}</span>
                    </button>
                    <div className="absolute top-full left-0 mt-2 w-64 bg-cerberus-900/95 border border-cerberus-700 rounded shadow-xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-left backdrop-blur-md z-50">
                        {rooms.map(room => (
                            <div 
                                key={room.id}
                                onClick={() => onRoomChange(room.id)}
                                className={`p-3 cursor-pointer hover:bg-cerberus-800 transition-colors border-b border-cerberus-800 last:border-0 ${activeRoom.id === room.id ? 'bg-cerberus-800/50 text-cerberus-accent' : 'text-gray-400'}`}
                            >
                                <div className="font-serif text-sm font-bold mb-1">{room.name}</div>
                                <div className="text-[10px] leading-tight opacity-70 line-clamp-2">{room.description}</div>
                            </div>
                        ))}
                    </div>
                </div>
           </div>
           
           {/* Mood/Agent Status */}
           <div className="flex items-center gap-2 ml-1 opacity-70 hover:opacity-100 transition-opacity">
                <div className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider backdrop-blur-sm ${agentMode === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-blue-900/30 text-blue-400'}`}>
                    {agentMode}
                </div>
                <div className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider bg-cerberus-800/30 text-cerberus-accent border border-cerberus-800/50 backdrop-blur-sm">
                    {moodState.currentMood}
                </div>
           </div>

           {/* Action Buttons */}
           <div className="flex gap-2 ml-1">
                <button onClick={onWardrobeOpen} className="flex items-center gap-2 text-cerberus-accent hover:text-white transition-colors opacity-70 hover:opacity-100 bg-cerberus-900/50 px-2 py-1.5 rounded-full border border-cerberus-700/30" title="Wardrobe">
                    <Shirt size={14} />
                    <span className="text-[9px] font-mono uppercase">Attire</span>
                </button>
                <button onClick={onDeepLogicOpen} className="flex items-center gap-2 text-red-900 hover:text-red-500 transition-colors opacity-50 hover:opacity-100 bg-cerberus-900/50 px-2 py-1.5 rounded-full border border-red-900/20" title="Deep Logic">
                    <ShieldAlert size={14} />
                    <span className="text-[9px] font-mono uppercase">Logic</span>
                </button>
            </div>
        </div>

        {/* Right Side: Portrait */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
            <div className="transition-transform duration-300 origin-top-right drop-shadow-2xl hover:scale-105">
                <Portrait url={currentPortraitUrl || character.portraitUrl} scale={portraitScale} aspectRatio={portraitAspectRatio} />
            </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-16 lg:px-32 pt-48 pb-4 z-0 scroll-smooth custom-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-cerberus-600 opacity-50 select-none">
             <Sparkles size={48} className="mb-4 animate-pulse" />
             <p className="font-serif text-xl drop-shadow-lg">The Void awaits...</p>
          </div>
        )}

        {messages.map((msg) => (
            <MessageItem 
                key={msg.id}
                msg={msg}
                characterName={character.name}
                isLast={msg.id === lastMessageId}
                isStreaming={isStreaming}
                onDelete={onDeleteMessage}
                onRegenerate={onRegenerate}
                onVersionChange={onVersionChange}
                onEdit={onEditMessage}
                onContinue={onContinueGeneration}
                aiTextColor={aiTextColor}
                aiTextStyle={aiTextStyle}
                aiFontFamily={aiFontFamily}
                aiTextSize={aiTextSize}
                userTextColor={userTextColor}
                userFontFamily={userFontFamily}
                userTextSize={userTextSize}
            />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-gradient-to-t from-black via-black/80 to-transparent z-20 shrink-0 flex flex-col items-center">
        {isScriptorium && (
            <button onClick={toggleRecording} className={`mb-2 p-2 rounded-full transition-all duration-300 border ${isRecording ? 'bg-red-900 text-white border-red-500 animate-pulse' : 'bg-cerberus-900/80 text-gray-400 border-gray-700 hover:text-white hover:border-cerberus-accent'}`} title={isRecording ? "Stop Recording" : "Start Voice Recording"}>
                {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
        )}

        <div className="max-w-4xl w-full mx-auto relative flex items-end gap-2">
          <textarea ref={textareaRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} onFocus={() => { setKeyboardOpen(true); scrollToBottom(); }} onBlur={() => setKeyboardOpen(false)} placeholder="Whisper..." className="flex-1 bg-cerberus-900/60 backdrop-blur-md border border-cerberus-700/50 text-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-cerberus-500/50 focus:bg-cerberus-900/80 resize-none shadow-lg text-sm max-h-24 custom-scrollbar" rows={1} disabled={isStreaming} />
          <button onClick={(e) => isStreaming ? handleStop(e) : handleSubmit()} disabled={!isStreaming && !input.trim()} className={`p-3 rounded-full transition-all duration-300 ease-in-out shrink-0 mb-0.5 flex items-center justify-center ${isStreaming ? 'bg-red-900/90 text-white hover:bg-red-700 shadow-[0_0_20px_rgba(220,38,38,0.5)] border border-red-500/30' : (!input.trim() ? 'text-gray-600 bg-transparent' : 'text-cerberus-900 bg-cerberus-accent hover:bg-white hover:text-cerberus-900 shadow-[0_0_10px_rgba(212,175,55,0.3)]')}`}>
            <div className="relative w-5 h-5">
                <span className={`absolute inset-0 flex items-center justify-center transition-all duration-300 transform ${isStreaming ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-180 scale-50'}`}><Square size={14} fill="currentColor" /></span>
                <span className={`absolute inset-0 flex items-center justify-center transition-all duration-300 transform ${!isStreaming ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-180 scale-50'}`}><Send size={18} /></span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;