import React, { useState, useEffect, useRef } from 'react';
import { ChatState, Message, Thread, AgentMode, Room, CharacterProfile, AppSettings, Outfit, ScheduledEvents, ScriptoriumConfig } from './types';
import { DEFAULT_SETTINGS, DEFAULT_PROFILE, DEFAULT_ROOMS, DEFAULT_MOOD_STATE, DEFAULT_DEEP_LOGIC, DEFAULT_OUTFITS, STATIC_THREAD_ID, DEFAULT_SCHEDULE, SCRIPTORIUM_THREAD_ID, DEFAULT_SCRIPTORIUM_CONFIG } from './constants';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import WardrobeDrawer from './components/WardrobeDrawer';
import ScriptoriumOverlay from './components/ScriptoriumOverlay';
import { streamGeminiResponse } from './services/geminiService';
import { streamGrokResponse } from './services/grokService';
import { applyEvent, decayStats, executePassiveLoop, logToSheet } from './services/agentService';
import { runWakeCycleLogic } from './services/wakeService';
import { v4 as uuidv4 } from 'uuid';
import { fetchSettings } from './services/firebaseService';

const STORAGE_KEY = 'project_cerberus_state_v5'; 

// Helper hook for interval
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current(), delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

const App: React.FC = () => {
  // --- State Initialization ---
  const [state, setState] = useState<ChatState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const migratedThreads = (parsed.threads || []).map((t: any) => ({
            ...t,
            type: t.type || (t.id === STATIC_THREAD_ID ? 'static' : t.id === SCRIPTORIUM_THREAD_ID ? 'scriptorium' : 'ritual'),
            messages: t.messages.map((m: any) => ({
                ...m,
                versions: m.versions || [m.content],
                activeVersionIndex: m.activeVersionIndex ?? 0
            }))
        }));

        if (!migratedThreads.find((t: Thread) => t.id === STATIC_THREAD_ID)) {
             migratedThreads.unshift({ id: STATIC_THREAD_ID, type: 'static', title: 'Static Connection', messages: [], lastUpdated: Date.now() });
        }
        if (!migratedThreads.find((t: Thread) => t.id === SCRIPTORIUM_THREAD_ID)) {
             migratedThreads.push({ id: SCRIPTORIUM_THREAD_ID, type: 'scriptorium', title: 'Ebon Scriptorium', messages: [], lastUpdated: Date.now() });
        }

        const currentRooms = parsed.rooms || DEFAULT_ROOMS;
        const cleanRooms = currentRooms.filter((r: Room) => r.id !== 'scriptorium');
        DEFAULT_ROOMS.forEach(defRoom => {
             if (defRoom.id !== 'scriptorium' && !cleanRooms.find((r: Room) => r.id === defRoom.id)) {
                 cleanRooms.push(defRoom);
             }
        });

        return {
           ...parsed,
           threads: migratedThreads,
           rooms: cleanRooms,
           settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
           character: { ...DEFAULT_PROFILE, ...parsed.character },
           moodState: parsed.moodState || DEFAULT_MOOD_STATE,
           deepLogic: parsed.deepLogic || DEFAULT_DEEP_LOGIC,
           agentMode: parsed.agentMode || 'active',
           lastInteractionTimestamp: parsed.lastInteractionTimestamp || Date.now(),
           outfits: parsed.outfits || DEFAULT_OUTFITS,
           currentOutfitId: parsed.currentOutfitId || DEFAULT_OUTFITS[0].id,
           scheduledEvents: parsed.scheduledEvents || DEFAULT_SCHEDULE,
           isScriptoriumOpen: parsed.isScriptoriumOpen || false,
           scriptoriumConfig: parsed.scriptoriumConfig || DEFAULT_SCRIPTORIUM_CONFIG
        };
      } catch (e) {
        console.error("Failed to parse saved state", e);
      }
    }
    const staticThread: Thread = { id: STATIC_THREAD_ID, type: 'static', title: 'Static Connection', messages: [], lastUpdated: Date.now() };
    const scriptoriumThread: Thread = { id: SCRIPTORIUM_THREAD_ID, type: 'scriptorium', title: 'Ebon Scriptorium', messages: [], lastUpdated: Date.now() };
    const initialThread: Thread = { id: uuidv4(), type: 'ritual', title: 'First Ritual', messages: [], lastUpdated: Date.now() };
    return {
      threads: [staticThread, scriptoriumThread, initialThread],
      activeThreadId: initialThread.id,
      rooms: DEFAULT_ROOMS.filter(r => r.id !== 'scriptorium'),
      activeRoomId: DEFAULT_ROOMS[0].id,
      settings: DEFAULT_SETTINGS,
      character: DEFAULT_PROFILE,
      agentMode: 'active',
      lastInteractionTimestamp: Date.now(),
      moodState: DEFAULT_MOOD_STATE,
      deepLogic: DEFAULT_DEEP_LOGIC,
      outfits: DEFAULT_OUTFITS,
      currentOutfitId: DEFAULT_OUTFITS[0].id,
      scheduledEvents: DEFAULT_SCHEDULE,
      isScriptoriumOpen: false,
      scriptoriumConfig: DEFAULT_SCRIPTORIUM_CONFIG
    };
  });

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [settingsModalState, setSettingsModalState] = useState<{isOpen: boolean, initialTab?: 'api' | 'deeplogic'}>({isOpen: false});
  const [isWardrobeOpen, setWardrobeOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- WAKE CYCLE CHECK (Client Side Heartbeat) ---
  // Runs periodically to simulate the scheduled job while app is open.
  useInterval(() => {
      const executeWakeCycle = async () => {
          if (state.settings.firebaseConfig?.apiKey) {
              const addSystemMessage = (msg: Message) => {
                  const staticThread = state.threads.find(t => t.id === STATIC_THREAD_ID);
                  if (staticThread) {
                      updateThreadMessages(STATIC_THREAD_ID, [...staticThread.messages, msg]);
                  }
              };
              await runWakeCycleLogic(state.settings, state, addSystemMessage);
          }
      };
      executeWakeCycle();
  }, 15 * 60 * 1000); // Check every 15 minutes

  // Run once on mount to catch up
  useEffect(() => {
      const initCheck = async () => {
          if (state.settings.firebaseConfig?.apiKey) {
              const addSystemMessage = (msg: Message) => {
                  const staticThread = state.threads.find(t => t.id === STATIC_THREAD_ID);
                  if (staticThread) {
                      updateThreadMessages(STATIC_THREAD_ID, [...staticThread.messages, msg]);
                  }
              };
              await runWakeCycleLogic(state.settings, state, addSystemMessage);
          }
      };
      // Short delay to ensure state is ready
      const t = setTimeout(initCheck, 5000);
      return () => clearTimeout(t);
  }, []);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // --- Helpers ---
  const getActiveThread = () => state.threads.find(t => t.id === state.activeThreadId) || state.threads[0];
  const getActiveRoom = () => state.rooms.find(r => r.id === state.activeRoomId) || state.rooms[0];
  const getScriptoriumThread = () => state.threads.find(t => t.id === SCRIPTORIUM_THREAD_ID) || state.threads[0];

  // Helper to determine the current portrait URL
  const getCurrentPortraitUrl = () => {
      const outfit = state.outfits.find(o => o.id === state.currentOutfitId);
      // Logic: Use wornImageUrl if exists, otherwise fallback to standard portrait
      if (outfit && outfit.wornImageUrl) {
          return outfit.wornImageUrl;
      }
      return state.character.portraitUrl;
  };

  const updateThreadMessages = (threadId: string, newMessages: Message[]) => {
      setState(prev => ({
          ...prev,
          threads: prev.threads.map(t => t.id === threadId ? { ...t, messages: newMessages, lastUpdated: Date.now() } : t)
      }));
  };

  const updateActiveThreadMessages = (newMessages: Message[]) => {
      if (state.activeThreadId) updateThreadMessages(state.activeThreadId, newMessages);
  };

  const updateThreadTitle = (threadId: string, title: string) => {
    setState(prev => ({
        ...prev,
        threads: prev.threads.map(t => t.id === threadId ? { ...t, title } : t)
    }));
  };

  // --- Core Action Logic ---

  const performGeneration = async (
      messagesContext: Message[], 
      modelMsgId: string, 
      isRegeneration: boolean,
      overrideSettings?: Partial<AppSettings>,
      startText: string = '',
      targetThreadId?: string 
  ) => {
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    let fullResponseText = startText;
    const effectiveSettings = { ...state.settings, ...overrideSettings };
    const threadIdToUpdate = targetThreadId || state.activeThreadId;
    const isScriptoriumGen = targetThreadId === SCRIPTORIUM_THREAD_ID;

    try {
        const room = isScriptoriumGen 
            ? { ...DEFAULT_ROOMS[0], name: 'Scriptorium', description: 'The Administrative Domain.', systemPromptOverride: state.scriptoriumConfig.systemPrompt } 
            : getActiveRoom();
            
        const currentOutfit = state.outfits.find(o => o.id === state.currentOutfitId);
        
        const augmentedCharacter = {
            ...state.character,
            systemPrompt: isScriptoriumGen 
                ? state.scriptoriumConfig.systemPrompt 
                : `${state.character.systemPrompt}\n[CURRENT OUTFIT: ${currentOutfit?.name} - ${currentOutfit?.description}]`
        };

        const onChunk = (text: string) => {
            fullResponseText += text;
            setState(prev => ({
                ...prev,
                threads: prev.threads.map(t => {
                    if (t.id !== threadIdToUpdate) return t;
                    const msgs = t.messages.map(m => {
                        if (m.id === modelMsgId) {
                            const newVersions = [...m.versions];
                            newVersions[m.activeVersionIndex] = fullResponseText;
                            return { ...m, versions: newVersions, content: fullResponseText };
                        }
                        return m;
                    });
                    return { ...t, messages: msgs };
                })
            }));
        };

        if (effectiveSettings.activeProvider === 'gemini') {
            await streamGeminiResponse(
                messagesContext, 
                room, 
                effectiveSettings, 
                augmentedCharacter, 
                state.moodState,
                onChunk,
                abortControllerRef.current.signal,
                isScriptoriumGen ? state.scriptoriumConfig.tools : undefined 
            );
        } else {
            await streamGrokResponse(
                messagesContext, 
                room, 
                effectiveSettings, 
                augmentedCharacter, 
                onChunk,
                abortControllerRef.current.signal
            );
        }

    } catch (error) {
        // Handled
    } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
    }
  };

  // --- Agentic Loop & Schedule (Client Side Sim) ---
  // This interval runs frequently for granular updates (every 1 min)
  useInterval(() => {
      const nowTs = Date.now();
      const diffMinutes = (nowTs - state.lastInteractionTimestamp) / 1000 / 60;
      let newMode: AgentMode = state.agentMode;

      if (state.agentMode === 'active' && diffMinutes > state.deepLogic.activeTimeout) {
          newMode = 'passive';
      }
      let newMoodState = decayStats(state.moodState);
      if (newMode === 'passive') {
         executePassiveLoop(state, (entry) => {
             logToSheet(state.deepLogic.secrets.sheetId, 'AuditLog', { type: 'PASSIVE_ACTION', entry });
         });
      }
      setState(prev => ({ ...prev, agentMode: newMode, moodState: newMoodState }));
  }, 60000);

  // --- Interaction Handlers ---
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setIsStreaming(false);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    const activeThread = getActiveThread();
    const newMessages = activeThread.messages.filter(m => m.id !== messageId);
    updateActiveThreadMessages(newMessages);
  };

  const handleVersionChange = (messageId: string, newIndex: number) => {
    const activeThread = getActiveThread();
    const updatedMessages = activeThread.messages.map(m => {
        if (m.id === messageId && newIndex >= 0 && newIndex < m.versions.length) {
            return {
                ...m,
                activeVersionIndex: newIndex,
                content: m.versions[newIndex] 
            };
        }
        return m;
    });
    updateActiveThreadMessages(updatedMessages);
  };

  const handleCreateThread = () => {
    const newThread: Thread = {
      id: uuidv4(),
      type: 'ritual',
      title: 'New Ritual',
      messages: [],
      lastUpdated: Date.now()
    };
    setState(prev => ({
      ...prev,
      threads: [newThread, ...prev.threads],
      activeThreadId: newThread.id
    }));
  };

  const handleDeleteThread = (id: string) => {
    if (id === STATIC_THREAD_ID || id === SCRIPTORIUM_THREAD_ID) return;
    const newThreads = state.threads.filter(t => t.id !== id);
    setState(prev => ({
      ...prev,
      threads: newThreads,
      activeThreadId: prev.activeThreadId === id ? STATIC_THREAD_ID : prev.activeThreadId
    }));
  };

  const handleExport = () => {
     const dataStr = JSON.stringify(state.threads, null, 2);
     const blob = new Blob([dataStr], { type: "application/json" });
     const url = URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.download = `project_cerberus_export_${Date.now()}.json`;
     link.click();
  };

  // --- Shared Send Message Logic ---
  const handleSendMessageGeneric = async (content: string, threadId: string) => {
      const thread = state.threads.find(t => t.id === threadId);
      if (!thread) return;

      const userMsg: Message = {
          id: uuidv4(),
          role: 'user',
          content,
          versions: [content],
          activeVersionIndex: 0,
          timestamp: Date.now()
      };

      const updatedMessages = [...thread.messages, userMsg];
      updateThreadMessages(threadId, updatedMessages);

      if (threadId !== SCRIPTORIUM_THREAD_ID) {
          // Mood logic only for main chat
          let eventType = 'USER_MESSAGE_SHORT';
          if (content.length > 50) eventType = 'USER_MESSAGE_LONG';
          if (content.toLowerCase().includes('love') || content.toLowerCase().includes('please')) eventType = 'USER_FLIRT';
          if (content.toLowerCase().includes('good') || content.toLowerCase().includes('thank')) eventType = 'USER_PRAISES';
          const newMoodState = applyEvent(state.moodState, eventType as any);
          setState(prev => ({ ...prev, lastInteractionTimestamp: Date.now(), agentMode: 'active', moodState: newMoodState }));
      }

      if (thread.messages.length === 0 && thread.type === 'ritual') {
          const words = content.split(' ').slice(0, 5).join(' ');
          updateThreadTitle(thread.id, words + '...');
      }

      const modelMsgId = uuidv4();
      const modelMsg: Message = {
          id: modelMsgId,
          role: 'model',
          content: '',
          versions: [''], 
          activeVersionIndex: 0,
          timestamp: Date.now()
      };
      
      const messagesWithModel = [...updatedMessages, modelMsg];
      updateThreadMessages(threadId, messagesWithModel);

      // Perform Generation
      await performGeneration(updatedMessages, modelMsgId, false, undefined, '', threadId);
  };

  // Main Chat Send
  const handleSendMessage = (content: string) => {
      if (!state.activeThreadId) return;
      handleSendMessageGeneric(content, state.activeThreadId);
  };

  // Scriptorium Send
  const handleSendMessageScriptorium = (content: string) => {
      handleSendMessageGeneric(content, SCRIPTORIUM_THREAD_ID);
  };

  const handleRegenerate = async () => {
      const activeThread = getActiveThread();
      if (activeThread.messages.length === 0) return;
      
      const lastMsg = activeThread.messages[activeThread.messages.length - 1];
      if (lastMsg.role !== 'model') return;

      const newVersionIndex = lastMsg.versions.length;
      const updatedMessages = activeThread.messages.map(m => {
          if (m.id === lastMsg.id) {
              return {
                  ...m,
                  versions: [...m.versions, ''], 
                  activeVersionIndex: newVersionIndex,
                  content: '' 
              };
          }
          return m;
      });
      updateActiveThreadMessages(updatedMessages);
      const apiContext = activeThread.messages.slice(0, -1);
      await performGeneration(apiContext, lastMsg.id, true);
  };

  const handleEditUserMessage = async (messageId: string, newContent: string) => {
    const activeThread = getActiveThread();
    const updatedMessages = activeThread.messages.map(m => {
        if (m.id === messageId) {
            return { ...m, versions: [...m.versions, newContent], activeVersionIndex: m.versions.length, content: newContent };
        }
        return m;
    });
    
    const isLast = activeThread.messages[activeThread.messages.length - 1].id === messageId;
    if (isLast) {
        updateActiveThreadMessages(updatedMessages);
        const modelMsgId = uuidv4();
        const modelMsg: Message = { id: modelMsgId, role: 'model', content: '', versions: [''], activeVersionIndex: 0, timestamp: Date.now() };
        const messagesWithModel = [...updatedMessages, modelMsg];
        updateActiveThreadMessages(messagesWithModel);
        await performGeneration(updatedMessages, modelMsgId, false);
    } else {
        updateActiveThreadMessages(updatedMessages);
    }
  };

  const handleContinueGeneration = async () => {
      const activeThread = getActiveThread();
      const lastMsg = activeThread.messages[activeThread.messages.length - 1];
      if (!lastMsg || lastMsg.role !== 'model') return;

      const continuationPrompt: Message = {
          id: 'temp-continue',
          role: 'user',
          content: "[System: Your last message ended abruptly. Please complete the final sentence or thought immediately. Limit to 40 words.]",
          versions: [],
          activeVersionIndex: 0,
          timestamp: Date.now()
      };

      const apiContext = [...activeThread.messages, continuationPrompt];
      const currentContent = lastMsg.content;
      
      await performGeneration(
          apiContext, 
          lastMsg.id, 
          false, 
          { maxOutputTokens: 60, tokenTarget: 40 },
          currentContent 
      );
  };

  // --- MANUAL NTFY PING ---
  const handleManualPing = async () => {
      if (!state.settings.firebaseConfig?.apiKey) {
          alert("Firebase credentials not configured.");
          return;
      }

      const toolsSettings = await fetchSettings('tools');
      const topic = toolsSettings?.ntfy?.topic || state.deepLogic.secrets.ntfyTopic;
      const baseUrl = toolsSettings?.ntfy?.baseUrl || 'https://ntfy.sh';

      if (!topic) {
          alert("NTFY Topic not configured in Deep Logic or Tools.");
          return;
      }

      // 1. Generate Message content using AI
      const prompt = `
          You are Ysaraith. The user has requested a manual presence check.
          Write a short, engaging notification (under 150 characters) to confirm you are active and watching.
          Tone: ${state.moodState.currentMood}.
      `;
      
      let generatedText = "";
      try {
          await streamGeminiResponse(
              [{ id: 'sys', role: 'user', content: prompt, versions: [], activeVersionIndex: 0, timestamp: Date.now() }],
              { id: 'void', name: 'Void', description: 'System Context', backgroundImage: '' }, 
              state.settings,
              state.character,
              state.moodState,
              (chunk) => { generatedText += chunk; }
          );
      } catch (e) {
          generatedText = "Ysaraith is present.";
      }

      // 2. Send to NTFY
      try {
          await fetch(`${baseUrl}/${topic}`, {
              method: 'POST',
              body: generatedText,
              headers: { 'Title': `Ysaraith: Manual Ping` }
          });
          alert(`Ping sent to ${topic}: "${generatedText}"`);
      } catch (e) {
          console.error(e);
          alert("Failed to send NTFY ping.");
      }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-cerberus-void text-gray-200 overflow-hidden font-sans">
      <Sidebar
        threads={state.threads}
        activeThreadId={state.activeThreadId}
        onSelectThread={(id) => setState(prev => ({ ...prev, activeThreadId: id }))}
        onCreateThread={handleCreateThread}
        onDeleteThread={handleDeleteThread}
        onOpenSettings={() => setSettingsModalState({isOpen: true, initialTab: 'api'})}
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onExport={handleExport}
        onOpenScriptorium={() => setState(prev => ({ ...prev, isScriptoriumOpen: true }))}
      />

      <ChatArea
        messages={getActiveThread().messages}
        isStreaming={isStreaming}
        enterToSend={state.settings.enterToSend}
        onSendMessage={handleSendMessage}
        onStopGeneration={handleStopGeneration}
        onRegenerate={handleRegenerate}
        onDeleteMessage={handleDeleteMessage}
        onVersionChange={handleVersionChange}
        onEditMessage={handleEditUserMessage}
        onContinueGeneration={handleContinueGeneration}
        onSidebarToggle={() => setSidebarOpen(!isSidebarOpen)}
        onDeepLogicOpen={() => setSettingsModalState({isOpen: true, initialTab: 'deeplogic'})}
        onWardrobeOpen={() => setWardrobeOpen(true)}
        character={state.character}
        portraitScale={state.settings.portraitScale}
        portraitAspectRatio={state.settings.portraitAspectRatio}
        activeRoom={getActiveRoom()}
        rooms={state.rooms}
        onRoomChange={(roomId) => setState(prev => ({ ...prev, activeRoomId: roomId }))}
        moodState={state.moodState}
        agentMode={state.agentMode}
        currentPortraitUrl={getCurrentPortraitUrl()}
        bgBrightness={state.settings.bgBrightness}
        aiTextFontUrl={state.settings.aiTextFontUrl}
        aiTextColor={state.settings.aiTextColor}
        aiTextStyle={state.settings.aiTextStyle}
        aiTextSize={state.settings.aiTextSize}
        userTextFontUrl={state.settings.userTextFontUrl}
        userTextColor={state.settings.userTextColor}
        userTextSize={state.settings.userTextSize}
      />

      {/* Scriptorium Overlay */}
      <ScriptoriumOverlay 
          isOpen={state.isScriptoriumOpen}
          onClose={() => setState(prev => ({ ...prev, isScriptoriumOpen: false }))}
          messages={getScriptoriumThread().messages}
          config={state.scriptoriumConfig}
          isStreaming={isStreaming}
          onSendMessage={handleSendMessageScriptorium}
          onUpdateConfig={(newConfig) => setState(prev => ({ ...prev, scriptoriumConfig: newConfig }))}
          onClearMessages={() => updateThreadMessages(SCRIPTORIUM_THREAD_ID, [])}
          onStopGeneration={handleStopGeneration}
          enterToSend={state.settings.enterToSend}
          onManualPing={handleManualPing}
      />

      <SettingsModal
        isOpen={settingsModalState.isOpen}
        onClose={() => setSettingsModalState({isOpen: false})}
        initialTab={settingsModalState.initialTab}
        settings={state.settings}
        character={state.character}
        rooms={state.rooms}
        scriptoriumConfig={state.scriptoriumConfig}
        deepLogicConfig={state.deepLogic}
        onSave={(newSettings, newChar, newRooms, newScriptorium, newDeepLogic) => setState(prev => ({ 
            ...prev, 
            settings: newSettings, 
            character: newChar,
            rooms: newRooms || prev.rooms,
            scriptoriumConfig: newScriptorium || prev.scriptoriumConfig,
            deepLogic: newDeepLogic || prev.deepLogic
        }))}
        onRestore={(newState) => setState(newState)}
      />

      <WardrobeDrawer 
        isOpen={isWardrobeOpen}
        onClose={() => setWardrobeOpen(false)}
        outfits={state.outfits}
        currentOutfitId={state.currentOutfitId}
        onSelectOutfit={(id) => setState(prev => ({ ...prev, currentOutfitId: id }))}
        onUpdateOutfit={(updated) => setState(prev => ({
            ...prev,
            outfits: prev.outfits.map(o => o.id === updated.id ? updated : o)
        }))}
        onCreateOutfit={(newOutfit) => setState(prev => ({
            ...prev,
            outfits: [...prev.outfits, newOutfit]
        }))}
      />
    </div>
  );
};

export default App;