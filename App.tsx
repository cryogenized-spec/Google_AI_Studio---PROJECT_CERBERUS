
import React, { useState, useEffect, useRef } from 'react';
import { ChatState, Message, Thread, AgentMode, Room, CharacterProfile, AppSettings, Outfit, ScheduledEvents, ScriptoriumConfig, DungeonConfig } from './types';
import { DEFAULT_SETTINGS, DEFAULT_PROFILE, DEFAULT_ROOMS, DEFAULT_MOOD_STATE, DEFAULT_DEEP_LOGIC, DEFAULT_OUTFITS, STATIC_THREAD_ID, DEFAULT_SCHEDULE, SCRIPTORIUM_THREAD_ID, DUNGEON_THREAD_ID, DEFAULT_SCRIPTORIUM_CONFIG, DEFAULT_DUNGEON_CONFIG, DM_SYSTEM_PROMPT, YSARAITH_PLAYER_PROMPT_ADDENDUM, DEFAULT_MAPPING_LOGIC, OOC_SYSTEM_PROMPT, OOC_ADVISORY_SYSTEM_PROMPT, DEFAULT_TEMPLATES } from './constants';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import WardrobeDrawer from './components/WardrobeDrawer';
import ScriptoriumOverlay from './components/ScriptoriumOverlay';
import DungeonOverlay from './components/DungeonOverlay';
import TowerOfMirrors from './components/TowerOfMirrors'; 
import CharacterGallery from './components/CharacterGallery';
import QuickPanel from './components/QuickPanel';
import KeyManager from './components/KeyManager';
import { streamGeminiResponse } from './services/geminiService';
import { streamGrokResponse } from './services/grokService';
import { applyEvent, decayStats, executePassiveLoop, logToSheet } from './services/agentService';
import { runWakeCycleLogic } from './services/wakeService';
import { v4 as uuidv4 } from 'uuid';
import { fetchSettings } from './services/firebaseService';
import { db } from './services/organizerDb';

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
  // --- ROUTING LOGIC ---
  const [isQuickMode, setIsQuickMode] = useState(window.location.pathname === '/quick');

  useEffect(() => {
      // Handle back button behavior for SPA
      const handlePopState = () => {
          setIsQuickMode(window.location.pathname === '/quick');
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- Boot Sequence Handoff ---
  useEffect(() => {
    // CRITICAL: Signal to index.html that React is mounted and ready to show
    if ((window as any).signalAppReady) {
        // Small delay to ensure render paint
        setTimeout(() => { (window as any).signalAppReady(); }, 100);
    }
  }, []);

  // --- EARLY EXIT FOR QUICK PANEL ---
  if (isQuickMode) {
      return <QuickPanel />;
  }

  // --- State Initialization ---
  const [state, setState] = useState<ChatState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // --- MIGRATION LOGIC V5 -> V6 (Multi-Character) ---
        
        // 1. Ensure Character List & Sanitize
        let characters: CharacterProfile[] = parsed.characters || [];
        let activeCharacterId = parsed.activeCharacterId;

        // If no characters exist but we have a legacy profile, create the first user char from it
        if (characters.length === 0) {
            if (parsed.character) {
                const legacyChar: CharacterProfile = {
                    ...DEFAULT_PROFILE, // Start with defaults
                    ...parsed.character, // Overwrite with saved data
                    id: 'legacy_ysaraith_v1',
                    versionNumber: 1,
                    isTemplate: false,
                    lastUsedAt: Date.now()
                };
                characters.push(legacyChar);
                activeCharacterId = legacyChar.id;
            } else {
                // FALLBACK: If absolutely nothing exists, use Default
                characters.push(DEFAULT_PROFILE);
                activeCharacterId = DEFAULT_PROFILE.id;
            }
        }

        // 1b. DEEP SANITIZATION: Ensure every character has a theme object (Legacy Fix)
        // Also ensure sheet exists
        characters = characters.map(c => ({
            ...c,
            theme: { ...DEFAULT_PROFILE.theme, ...(c.theme || {}) },
            sheet: { ...DEFAULT_PROFILE.sheet, ...(c.sheet || {}) },
            portraitUrl: c.portraitUrl || DEFAULT_PROFILE.portraitUrl,
            name: c.name || 'Unknown Entity'
        }));

        // 2. Ensure Threads have characterId
        const migratedThreads = (parsed.threads || []).map((t: any) => ({
            ...t,
            characterId: t.characterId || activeCharacterId,
            type: t.type || (t.id === STATIC_THREAD_ID ? 'static' : t.id === SCRIPTORIUM_THREAD_ID ? 'scriptorium' : t.id === DUNGEON_THREAD_ID ? 'dungeon' : 'ritual'),
            messages: (t.messages || []).map((m: any) => ({
                ...m,
                versions: m.versions || [m.content],
                activeVersionIndex: m.activeVersionIndex ?? 0
            })),
            oocMessages: t.oocMessages || [] 
        }));

        // Ensure critical threads exist
        const ensureThread = (id: string, type: any, title: string) => {
            if (!migratedThreads.find((t: Thread) => t.id === id)) {
                migratedThreads.push({ id, characterId: activeCharacterId, type, title, messages: [], oocMessages: [], lastUpdated: Date.now() });
            }
        };
        ensureThread(STATIC_THREAD_ID, 'static', 'Static Connection');
        ensureThread(SCRIPTORIUM_THREAD_ID, 'scriptorium', 'Ebon Scriptorium');
        ensureThread(DUNGEON_THREAD_ID, 'dungeon', 'The Gauntlet');

        const currentRooms = parsed.rooms || DEFAULT_ROOMS;
        const cleanRooms = currentRooms.filter((r: Room) => r.id !== 'scriptorium');
        DEFAULT_ROOMS.forEach(defRoom => { if (defRoom.id !== 'scriptorium' && !cleanRooms.find((r: Room) => r.id === defRoom.id)) cleanRooms.push(defRoom); });

        // Resolve active character safely
        const activeCharProfile = characters.find(c => c.id === activeCharacterId) || characters[0];

        // Sanitize Configs (Deep Merge to ensure tools/fonts exist)
        const sanitizedScriptorium = { 
            ...DEFAULT_SCRIPTORIUM_CONFIG, 
            ...(parsed.scriptoriumConfig || {}),
            tools: { ...DEFAULT_SCRIPTORIUM_CONFIG.tools, ...(parsed.scriptoriumConfig?.tools || {}) }
        };

        const sanitizedDungeon = {
            ...DEFAULT_DUNGEON_CONFIG,
            ...(parsed.dungeonConfig || {})
        };

        return {
           ...parsed,
           threads: migratedThreads,
           characters,
           activeCharacterId: activeCharProfile.id,
           character: activeCharProfile, // Synced legacy prop
           rooms: cleanRooms,
           settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
           moodState: parsed.moodState || DEFAULT_MOOD_STATE,
           deepLogic: parsed.deepLogic || DEFAULT_DEEP_LOGIC,
           agentMode: parsed.agentMode || 'active',
           lastInteractionTimestamp: parsed.lastInteractionTimestamp || Date.now(),
           outfits: parsed.outfits || DEFAULT_OUTFITS,
           currentOutfitId: parsed.currentOutfitId || DEFAULT_OUTFITS[0].id,
           scheduledEvents: parsed.scheduledEvents || DEFAULT_SCHEDULE,
           isScriptoriumOpen: parsed.isScriptoriumOpen || false,
           scriptoriumConfig: sanitizedScriptorium,
           isDungeonOpen: parsed.isDungeonOpen || false,
           dungeonConfig: sanitizedDungeon,
           hasUnreadOOC: parsed.hasUnreadOOC || false,
           isTowerOpen: parsed.isTowerOpen || false 
        };
      } catch (e) {
        console.error("Failed to parse saved state", e);
        // Fallback to fresh install if parsing fails completely
        return getFreshInstallState();
      }
    }
    
    return getFreshInstallState();
  });

  // Extracted Fresh Install Logic
  function getFreshInstallState(): ChatState {
    const initialCharId = 'legacy_ysaraith_v1';
    const staticThread: Thread = { id: STATIC_THREAD_ID, characterId: initialCharId, type: 'static', title: 'Static Connection', messages: [], oocMessages: [], lastUpdated: Date.now() };
    const scriptoriumThread: Thread = { id: SCRIPTORIUM_THREAD_ID, characterId: initialCharId, type: 'scriptorium', title: 'Ebon Scriptorium', messages: [], oocMessages: [], lastUpdated: Date.now() };
    const dungeonThread: Thread = { id: DUNGEON_THREAD_ID, characterId: initialCharId, type: 'dungeon', title: 'The Gauntlet', messages: [], oocMessages: [], lastUpdated: Date.now() };
    const initialThread: Thread = { id: uuidv4(), characterId: initialCharId, type: 'ritual', title: 'First Ritual', messages: [], oocMessages: [], lastUpdated: Date.now() };
    
    return {
      threads: [staticThread, scriptoriumThread, dungeonThread, initialThread],
      characters: [DEFAULT_PROFILE],
      activeCharacterId: initialCharId,
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
      scriptoriumConfig: DEFAULT_SCRIPTORIUM_CONFIG,
      isDungeonOpen: false,
      dungeonConfig: DEFAULT_DUNGEON_CONFIG,
      hasUnreadOOC: false,
      isTowerOpen: false
    };
  }

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [settingsModalState, setSettingsModalState] = useState<{isOpen: boolean, initialTab?: 'api' | 'deeplogic'}>({isOpen: false});
  const [isWardrobeOpen, setWardrobeOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false); 
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeDungeonThreadId, setActiveDungeonThreadId] = useState<string>(DUNGEON_THREAD_ID);
  
  // KEY MANAGEMENT STATE
  const [keyManagerMode, setKeyManagerMode] = useState<'onboarding' | 'unlock' | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // --- KEY CHECK ON BOOT ---
  useEffect(() => {
      const checkKeys = async () => {
          // If keys are already in memory (e.g. from session persistence or hardcoded for dev), we are good
          if (state.settings.apiKeyGemini || state.settings.apiKeyGrok) return;

          try {
              if (!db || !db.secrets) throw new Error("DB Not Ready");
              
              const secrets = await db.secrets.toArray();
              const hasEncrypted = secrets.some(s => s.mode === 'encrypted');
              
              if (hasEncrypted) {
                  setKeyManagerMode('unlock');
              } else {
                  setKeyManagerMode('onboarding');
              }
          } catch (e) {
              console.error("Failed to check secrets DB:", e);
              // Fallback to onboarding if DB fails
              setKeyManagerMode('onboarding');
          }
      };
      checkKeys();
  }, []);

  const handleKeysReady = (keys: Partial<AppSettings>) => {
      setState(prev => ({
          ...prev,
          settings: { ...prev.settings, ...keys }
      }));
      setKeyManagerMode(null);
  };

  // --- PERSISTENCE WITH KEY STRIPPING ---
  useEffect(() => {
    // SECURITY: Create a copy of state to save, explicitly stripping sensitive keys
    const stateToSave = {
        ...state,
        settings: {
            ...state.settings,
            apiKeyGemini: '',
            apiKeyGrok: '',
            apiKeyOpenAI: ''
        }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [state]);

  // --- WAKE CYCLE CHECK ---
  useInterval(() => {
      const executeWakeCycle = async () => {
          if (state.settings.firebaseConfig?.apiKey) {
              const addSystemMessage = (msg: Message) => {
                  const staticThread = state.threads.find(t => t.id === STATIC_THREAD_ID && t.characterId === state.activeCharacterId);
                  if (staticThread) {
                      updateThreadMessages(STATIC_THREAD_ID, [...staticThread.messages, msg]);
                  }
              };
              await runWakeCycleLogic(state.settings, state, addSystemMessage);
          }
      };
      executeWakeCycle();
  }, 15 * 60 * 1000); 

  useEffect(() => {
      const initCheck = async () => {
          if (state.settings.firebaseConfig?.apiKey) {
              const addSystemMessage = (msg: Message) => {
                  const staticThread = state.threads.find(t => t.id === STATIC_THREAD_ID && t.characterId === state.activeCharacterId);
                  if (staticThread) {
                      updateThreadMessages(STATIC_THREAD_ID, [...staticThread.messages, msg]);
                  }
              };
              await runWakeCycleLogic(state.settings, state, addSystemMessage);
          }
      };
      const t = setTimeout(initCheck, 5000);
      return () => clearTimeout(t);
  }, []);

  // --- SELECTORS ---
  // IMPORTANT: Filter threads by ACTIVE CHARACTER
  const getActiveCharacter = () => {
      const found = state.characters.find(c => c.id === state.activeCharacterId);
      // Fallback with Theme Guarantee
      return found || state.characters[0] || { ...DEFAULT_PROFILE };
  };

  const activeChar = getActiveCharacter(); // Safe access

  const getCharacterThreads = () => state.threads.filter(t => t.characterId === state.activeCharacterId);
  const getActiveThread = () => getCharacterThreads().find(t => t.id === state.activeThreadId) || getCharacterThreads()[0] || state.threads[0];
  const getActiveRoom = () => state.rooms.find(r => r.id === state.activeRoomId) || state.rooms[0];
  
  // Specific Threads per character
  const getScriptoriumThread = () => getCharacterThreads().find(t => t.type === 'scriptorium') || state.threads.find(t => t.id === SCRIPTORIUM_THREAD_ID) as Thread;
  const getActiveDungeonThread = () => getCharacterThreads().find(t => t.id === activeDungeonThreadId) || getCharacterThreads().find(t => t.type === 'dungeon') || state.threads.find(t => t.id === DUNGEON_THREAD_ID) as Thread;
  const getDungeonThreads = () => getCharacterThreads().filter(t => t.type === 'dungeon');

  const getCurrentPortraitUrl = () => {
      const outfit = state.outfits.find(o => o.id === state.currentOutfitId);
      if (outfit && outfit.wornImageUrl) return outfit.wornImageUrl;
      return activeChar.portraitUrl;
  };

  const updateThreadMessages = (threadId: string, newMessages: Message[]) => {
      setState(prev => ({ ...prev, threads: prev.threads.map(t => t.id === threadId ? { ...t, messages: newMessages, lastUpdated: Date.now() } : t) }));
  };

  const updateThreadOOC = (threadId: string, newOOC: Message[]) => {
      setState(prev => ({ ...prev, threads: prev.threads.map(t => t.id === threadId ? { ...t, oocMessages: newOOC, lastUpdated: Date.now() } : t) }));
  };

  const updateActiveThreadMessages = (newMessages: Message[]) => { if (state.activeThreadId) updateThreadMessages(state.activeThreadId, newMessages); };
  const updateThreadTitle = (threadId: string, title: string) => { setState(prev => ({ ...prev, threads: prev.threads.map(t => t.id === threadId ? { ...t, title } : t) })); };

  // --- CHARACTER SYSTEM LOGIC ---

  const handleSelectCharacter = (id: string) => {
      const charThreads = state.threads.filter(t => t.characterId === id);
      let nextThreadId = charThreads.find(t => t.type === 'ritual' || t.type === 'static')?.id;
      if (!nextThreadId && charThreads.length > 0) nextThreadId = charThreads[0].id;

      setState(prev => ({
          ...prev,
          activeCharacterId: id,
          activeThreadId: nextThreadId || null,
          character: prev.characters.find(c => c.id === id) || prev.character 
      }));
  };

  const handleUseTemplate = (template: CharacterProfile) => {
      const newCharId = uuidv4();
      const newCharacter: CharacterProfile = {
          ...template,
          id: newCharId,
          baseTemplateId: template.id,
          versionNumber: 1,
          isTemplate: false,
          createdAt: Date.now(),
          lastUsedAt: Date.now()
      };

      const staticThread: Thread = { id: uuidv4(), characterId: newCharId, type: 'static', title: 'Static Connection', messages: [], oocMessages: [], lastUpdated: Date.now() };
      const scriptoriumThread: Thread = { id: uuidv4(), characterId: newCharId, type: 'scriptorium', title: 'The Desk', messages: [], oocMessages: [], lastUpdated: Date.now() };
      const dungeonThread: Thread = { id: uuidv4(), characterId: newCharId, type: 'dungeon', title: 'The Gauntlet', messages: [], oocMessages: [], lastUpdated: Date.now() };
      const mainThread: Thread = { id: uuidv4(), characterId: newCharId, type: 'ritual', title: 'First Ritual', messages: [], oocMessages: [], lastUpdated: Date.now() };

      setState(prev => ({
          ...prev,
          characters: [...prev.characters, newCharacter],
          threads: [...prev.threads, staticThread, scriptoriumThread, dungeonThread, mainThread],
          activeCharacterId: newCharId,
          activeThreadId: mainThread.id,
          character: newCharacter,
          isGalleryOpen: false 
      }));
  };

  // --- Core Action Logic ---

  const performGeneration = async (
      messagesContext: Message[], 
      modelMsgId: string, 
      isRegeneration: boolean,
      overrideSettings?: Partial<AppSettings>,
      startText: string = '',
      targetThreadId?: string,
      dungeonMode?: 'dm' | 'player',
      injectionPrompt?: string 
  ) => {
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    let fullResponseText = startText;
    const effectiveSettings = { ...state.settings, ...overrideSettings };
    const threadIdToUpdate = targetThreadId || state.activeThreadId;
    
    const targetThread = state.threads.find(t => t.id === threadIdToUpdate);
    const isScriptoriumGen = targetThread?.type === 'scriptorium';
    const isDungeonGen = targetThread?.type === 'dungeon';

    try {
        const room = isScriptoriumGen 
            ? { ...DEFAULT_ROOMS[0], name: 'Scriptorium', description: 'The Administrative Domain.', systemPromptOverride: state.scriptoriumConfig.systemPrompt } 
            : isDungeonGen
                ? { ...DEFAULT_ROOMS[0], name: 'The Gauntlet', description: 'A table set in shadows.', systemPromptOverride: state.dungeonConfig.dmSystemPrompt }
                : getActiveRoom();
            
        const currentOutfit = state.outfits.find(o => o.id === state.currentOutfitId);
        
        let effectiveSystemPrompt = activeChar.systemPrompt;
        
        const mappingBlock = activeChar.mappingLogic 
            ? `\n\n[STRICT SPATIAL ADHERENCE REQUIRED]\n${activeChar.mappingLogic}\n` 
            : '';

        if (isScriptoriumGen) {
            effectiveSystemPrompt = state.scriptoriumConfig.systemPrompt;
        } else if (isDungeonGen) {
            if (dungeonMode === 'dm') {
                effectiveSystemPrompt = state.dungeonConfig.dmSystemPrompt;
            } else {
                const persona = `\n[CURRENT DEMEANOR: ${state.dungeonConfig.ysaraithDemeanorInfo || state.dungeonConfig.ysaraithDemeanorLabel}]\n`;
                effectiveSystemPrompt = `${activeChar.systemPrompt}${mappingBlock}\n${YSARAITH_PLAYER_PROMPT_ADDENDUM}${persona}`;
            }
        } else {
            effectiveSystemPrompt = `${activeChar.systemPrompt}${mappingBlock}\n[CURRENT OUTFIT: ${currentOutfit?.name} - ${currentOutfit?.description}]`;
        }

        if (effectiveSettings.roleplayIntensity !== undefined || effectiveSettings.writingStyle || effectiveSettings.formattingStyle) {
            effectiveSystemPrompt += `\n\n**STYLE MODIFIERS:**\n`;
            if (effectiveSettings.roleplayIntensity < 50) effectiveSystemPrompt += `- Adherence: Relaxed. Breaks in character are permissible for clarity.\n`;
            else effectiveSystemPrompt += `- Adherence: Strict (${effectiveSettings.roleplayIntensity}%). Total immersion.\n`;

            if (effectiveSettings.writingStyle === 'plain') effectiveSystemPrompt += `- Style: Direct, concise, functional.\n`;
            else if (effectiveSettings.writingStyle === 'ornate') effectiveSystemPrompt += `- Style: Poetic, vivid, sensory-rich, dramatic.\n`;
            
            if (effectiveSettings.formattingStyle === 'bubbles') effectiveSystemPrompt += `- Format: Casual messaging style. Short bursts.\n`;
            else if (effectiveSettings.formattingStyle === 'screenplay') effectiveSystemPrompt += `- Format: Screenplay (Action lines, Dialogue tags).\n`;
            else if (effectiveSettings.formattingStyle === 'markdown') effectiveSystemPrompt += `- Format: Heavy use of Markdown headers/lists.\n`;
        }

        if (injectionPrompt) {
            effectiveSystemPrompt += `\n\n${injectionPrompt}\n`;
        }

        const augmentedCharacter = { ...activeChar, systemPrompt: effectiveSystemPrompt };

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
                            return { ...m, versions: newVersions, content: fullResponseText, speaker: (isDungeonGen ? (dungeonMode === 'dm' ? 'DM' : 'Ysaraith') : undefined) as Message['speaker'] };
                        }
                        return m;
                    });
                    return { ...t, messages: msgs };
                })
            }));
        };

        if (effectiveSettings.activeProvider === 'gemini') {
            await streamGeminiResponse(
                messagesContext, room, effectiveSettings, augmentedCharacter, state.moodState, onChunk, abortControllerRef.current.signal, isScriptoriumGen ? state.scriptoriumConfig.tools : undefined 
            );
        } else {
            await streamGrokResponse(
                messagesContext, room, effectiveSettings, augmentedCharacter, onChunk, abortControllerRef.current.signal
            );
        }

        if (state.settings.oocAssistEnabled && !isScriptoriumGen && !isDungeonGen && !isRegeneration && !injectionPrompt) {
            setTimeout(() => { performAdvisoryGeneration(messagesContext, fullResponseText, threadIdToUpdate || STATIC_THREAD_ID); }, 1000);
        }

    } catch (error: any) {
        console.error("Generation Error:", error);
        let errorMsg = `[System Error: ${error.message || 'Unknown Connection Failure'}]`;
        try {
            const raw = error.message || '';
            const jsonMatch = raw.match(/"message":\s*"([^"]+)"/);
            if (jsonMatch && jsonMatch[1]) errorMsg = `[System Error: ${jsonMatch[1]}]`;
        } catch (e) {}

        setState(prev => ({
            ...prev,
            threads: prev.threads.map(t => {
                if (t.id !== threadIdToUpdate) return t;
                const msgs = t.messages.map(m => { if (m.id === modelMsgId) { return { ...m, content: errorMsg, versions: [errorMsg] }; } return m; });
                return { ...t, messages: msgs };
            })
        }));
    } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
    }
  };

  const performAdvisoryGeneration = async (context: Message[], lastResponse: string, threadId: string) => {
      const recentHistory = context.slice(-3); 
      const fullContextText = recentHistory.map(m => `${m.role}: ${m.content}`).join('\n') + `\nmodel: ${lastResponse}`;
      let advisoryPrompt = OOC_ADVISORY_SYSTEM_PROMPT;

      if (state.settings.oocPersona === 'character') {
          advisoryPrompt = `**MODE: PROACTIVE ADVISORY (IN-CHARACTER)**\nIdentity: ${activeChar.name}.\nGoal: Guide story without breaking persona.\nCriteria: Logical errors, lore breaks.`;
      }
      advisoryPrompt += `\n**Context:**\n${fullContextText}`;

      let advisoryText = "";
      try {
          const tempChar = { ...activeChar, systemPrompt: advisoryPrompt };
          if (state.settings.activeProvider === 'gemini') {
              await streamGeminiResponse([{ id: 'sys', role: 'user', content: "Analyze.", versions: [], activeVersionIndex: 0, timestamp: Date.now() }], { ...DEFAULT_ROOMS[0], name: 'Advisory', description: '' }, { ...state.settings, maxOutputTokens: 150 }, tempChar, state.moodState, (chunk) => { advisoryText += chunk; });
          } else {
              await streamGrokResponse([{ id: 'sys', role: 'user', content: "Analyze.", versions: [], activeVersionIndex: 0, timestamp: Date.now() }], { ...DEFAULT_ROOMS[0], name: 'Advisory', description: '' }, { ...state.settings, maxOutputTokens: 150 }, tempChar, (chunk) => { advisoryText += chunk; });
          }

          if (advisoryText.trim() && !advisoryText.includes("NO_ADVISORY")) {
              const newOOCMsg: Message = { id: uuidv4(), role: 'model', content: advisoryText.trim(), versions: [advisoryText.trim()], activeVersionIndex: 0, timestamp: Date.now() };
              const currentThread = state.threads.find(t => t.id === threadId);
              if (currentThread) {
                  const updatedOOC = [...(currentThread.oocMessages || []), newOOCMsg];
                  updateThreadOOC(threadId, updatedOOC);
                  setState(prev => ({ ...prev, hasUnreadOOC: true }));
              }
          }
      } catch (e) { console.error("Advisory Gen Failed", e); }
  };

  const performOOCGeneration = async (oocHistory: Message[], narrativeContext: Message[], targetThreadId: string) => {
      setIsStreaming(true);
      abortControllerRef.current = new AbortController();
      let fullResponseText = "";
      const modelMsgId = uuidv4();
      
      const updatedOOC = [...oocHistory, { id: modelMsgId, role: 'model', content: '', versions: [''], activeVersionIndex: 0, timestamp: Date.now() } as Message];
      updateThreadOOC(targetThreadId, updatedOOC);

      let verbosityInstruction = "";
      switch (state.settings.oocVerboseMode) {
          case 1: verbosityInstruction = "Be extremely concise."; break;
          case 3: verbosityInstruction = "Be verbose and detailed."; break;
          default: verbosityInstruction = "Maintain balanced length."; break;
      }

      let baseOocPrompt = OOC_SYSTEM_PROMPT; 
      if (state.settings.oocPersona === 'character') {
          baseOocPrompt = `**MODE: METAGAMING (IN-CHARACTER)**\nIdentity: ${activeChar.name}.\nGoal: Discuss meta-topics in character.`;
      }

      const narrativeSummary = narrativeContext.slice(-5).map(m => `${m.role === 'model' ? activeChar.name : 'User'}: ${m.content}`).join('\n');
      const systemPrompt = `${baseOocPrompt}\n**Constraint:** ${verbosityInstruction}\n[RECENT NARRATIVE]\n${narrativeSummary}`;
      const augmentedCharacter = { ...activeChar, systemPrompt };

      const onChunk = (text: string) => {
          fullResponseText += text;
          setState(prev => ({ ...prev, threads: prev.threads.map(t => { if (t.id !== targetThreadId) return t; const newOOC = t.oocMessages?.map(m => { if (m.id === modelMsgId) return { ...m, content: fullResponseText }; return m; }); return { ...t, oocMessages: newOOC }; }) }));
      };

      try {
           if (state.settings.activeProvider === 'gemini') {
                await streamGeminiResponse(updatedOOC, { ...DEFAULT_ROOMS[0], name: 'OOC Channel', description: 'Meta-space' }, state.settings, augmentedCharacter, state.moodState, onChunk, abortControllerRef.current.signal);
           } else {
                await streamGrokResponse(updatedOOC, { ...DEFAULT_ROOMS[0], name: 'OOC Channel', description: 'Meta-space' }, state.settings, augmentedCharacter, onChunk, abortControllerRef.current.signal);
           }
      } catch (e: any) {
          console.error("OOC Gen Failed", e);
          const errorMsg = `[Connection Error: ${e.message}]`;
          setState(prev => ({ ...prev, threads: prev.threads.map(t => { if (t.id !== targetThreadId) return t; const newOOC = t.oocMessages?.map(m => { if (m.id === modelMsgId) return { ...m, content: errorMsg }; return m; }); return { ...t, oocMessages: newOOC }; }) }));
      } finally {
          setIsStreaming(false);
          abortControllerRef.current = null;
      }
  };

  const handleExportTxt = () => {
      let output = `PROJECT CERBERUS EXPORT\nGenerated: ${new Date().toLocaleString()}\n=================================================\n\n`;
      getCharacterThreads().forEach(t => {
          output += `THREAD: ${t.title} [${t.type.toUpperCase()}]\nID: ${t.id}\n-------------------------------------------------\n\n`;
          if (t.messages.length === 0) output += `(No messages)\n`;
          else t.messages.forEach(m => { const author = m.role === 'model' ? (m.speaker || activeChar.name) : (state.settings.userName || 'User'); const time = new Date(m.timestamp).toLocaleString(); output += `[${author} - ${time}]\n${m.content}\n\n-------------------------------------------------\n\n`; });
          output += `\n\n`;
      });
      const blob = new Blob([output], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = `cerberus_chat_export_${Date.now()}.txt`; link.click(); URL.revokeObjectURL(url);
  };

  useInterval(() => {
      const nowTs = Date.now();
      const diffMinutes = (nowTs - state.lastInteractionTimestamp) / 1000 / 60;
      let newMode: AgentMode = state.agentMode;
      if (state.agentMode === 'active' && diffMinutes > state.deepLogic.activeTimeout) newMode = 'passive';
      let newMoodState = decayStats(state.moodState);
      if (newMode === 'passive') executePassiveLoop(state, (entry) => logToSheet(state.deepLogic.secrets.sheetId, 'AuditLog', { type: 'PASSIVE_ACTION', entry }));
      setState(prev => ({ ...prev, agentMode: newMode, moodState: newMoodState }));
  }, 60000);

  const handleStopGeneration = () => { if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; setIsStreaming(false); } };
  const handleDeleteMessage = (messageId: string) => { const activeThread = getActiveThread(); const newMessages = activeThread.messages.filter(m => m.id !== messageId); updateActiveThreadMessages(newMessages); };
  const handleVersionChange = (messageId: string, newIndex: number) => { const activeThread = getActiveThread(); const updatedMessages = activeThread.messages.map(m => { if (m.id === messageId && newIndex >= 0 && newIndex < m.versions.length) { return { ...m, activeVersionIndex: newIndex, content: m.versions[newIndex] }; } return m; }); updateActiveThreadMessages(updatedMessages); };

  const handleReiterate = async (messageId: string, mode: 'context' | 'logic') => {
      const activeThread = getActiveThread();
      const targetIndex = activeThread.messages.findIndex(m => m.id === messageId);
      if (targetIndex === -1) return;
      const targetMsg = activeThread.messages[targetIndex];
      let promptInjection = "";
      if (mode === 'logic') promptInjection = `[SYSTEM INTERVENTION: LOGIC AUDIT]\nStop. A Spatial or Meta-gaming violation was detected.\nRewrite strictly adhering to physics and logic.`;
      else promptInjection = `[SYSTEM INTERVENTION: REITERATE - NARRATIVE FOCUS]\nStop. Re-read previous messages. Trace cause and effect.\nGenerate a response that logically follows events.`;

      if (targetMsg.role === 'model') {
          const newVersionIndex = targetMsg.versions.length;
          const updatedMessages = activeThread.messages.map(m => { if (m.id === targetMsg.id) { return { ...m, versions: [...m.versions, ''], activeVersionIndex: newVersionIndex, content: '' }; } return m; });
          updateActiveThreadMessages(updatedMessages);
          const apiContext = activeThread.messages.slice(0, targetIndex);
          await performGeneration(apiContext, targetMsg.id, true, undefined, '', undefined, undefined, promptInjection);
      } 
  };

  const handleCreateThread = () => { const newThread: Thread = { id: uuidv4(), characterId: state.activeCharacterId, type: 'ritual', title: 'New Ritual', messages: [], oocMessages: [], lastUpdated: Date.now() }; setState(prev => ({ ...prev, threads: [newThread, ...prev.threads], activeThreadId: newThread.id })); };
  const handleCreateDungeonThread = () => { const newThread: Thread = { id: uuidv4(), characterId: state.activeCharacterId, type: 'dungeon', title: `Campaign ${getDungeonThreads().length + 1}`, messages: [], oocMessages: [], lastUpdated: Date.now() }; setState(prev => ({ ...prev, threads: [...prev.threads, newThread] })); setActiveDungeonThreadId(newThread.id); };
  const handleDeleteThread = (id: string) => { if (id === STATIC_THREAD_ID || id === SCRIPTORIUM_THREAD_ID || id === DUNGEON_THREAD_ID) return; const newThreads = state.threads.filter(t => t.id !== id); setState(prev => ({ ...prev, threads: newThreads, activeThreadId: prev.activeThreadId === id ? STATIC_THREAD_ID : prev.activeThreadId })); };
  const handleExport = () => { const dataStr = JSON.stringify(state.threads, null, 2); const blob = new Blob([dataStr], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `project_cerberus_export_${Date.now()}.json`; link.click(); };

  const handleSendMessageGeneric = async (content: string, threadId: string, dungeonMode?: 'dm' | 'player') => {
      const thread = state.threads.find(t => t.id === threadId);
      if (!thread) return;
      const userMsg: Message = { id: uuidv4(), role: 'user', content, versions: [content], activeVersionIndex: 0, timestamp: Date.now() };
      const updatedMessages = [...thread.messages, userMsg];
      updateThreadMessages(threadId, updatedMessages);

      if (thread.type !== 'scriptorium' && thread.type !== 'dungeon') {
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
      const modelMsg: Message = { id: modelMsgId, role: 'model', content: '', versions: [''], activeVersionIndex: 0, timestamp: Date.now(), speaker: dungeonMode === 'dm' ? 'DM' : (thread.type === 'dungeon' ? 'Ysaraith' : undefined) };
      const messagesWithModel = [...updatedMessages, modelMsg];
      updateThreadMessages(threadId, messagesWithModel);
      await performGeneration(updatedMessages, modelMsgId, false, undefined, '', threadId, dungeonMode);
  };

  const handleSendMessage = (content: string) => { if (!state.activeThreadId) return; handleSendMessageGeneric(content, state.activeThreadId); };
  const handleSendOOC = async (content: string) => { if (!state.activeThreadId) return; const thread = getActiveThread(); const userMsg: Message = { id: uuidv4(), role: 'user', content, versions: [content], activeVersionIndex: 0, timestamp: Date.now() }; const updatedOOC = [...(thread.oocMessages || []), userMsg]; updateThreadOOC(thread.id, updatedOOC); await performOOCGeneration(updatedOOC, thread.messages, thread.id); };
  const handleDeleteOOC = (msgId: string) => { const activeThread = getActiveThread(); if (!activeThread.oocMessages) return; const newOOC = activeThread.oocMessages.filter(m => m.id !== msgId); updateThreadOOC(activeThread.id, newOOC); };
  const handleClearOOC = () => { const activeThread = getActiveThread(); updateThreadOOC(activeThread.id, []); };
  const handleUpdateOOCSettings = (newSettings: Partial<AppSettings>) => { setState(prev => ({ ...prev, settings: { ...prev.settings, ...newSettings } })); };
  const handleSendMessageScriptorium = (content: string) => { handleSendMessageGeneric(content, SCRIPTORIUM_THREAD_ID); };
  const handleSendMessageDungeon = (content: string) => { handleSendMessageGeneric(content, activeDungeonThreadId, 'player'); };
  const handleTriggerDM = async () => { const thread = getActiveDungeonThread(); const modelMsgId = uuidv4(); const modelMsg: Message = { id: modelMsgId, role: 'model', content: '', versions: [''], activeVersionIndex: 0, timestamp: Date.now(), speaker: 'DM' }; const updatedMessages = [...thread.messages, modelMsg]; updateThreadMessages(thread.id, updatedMessages); await performGeneration(thread.messages, modelMsgId, false, undefined, '', thread.id, 'dm'); };
  const handleRegenerate = async () => { const activeThread = getActiveThread(); if (activeThread.messages.length === 0) return; const lastMsg = activeThread.messages[activeThread.messages.length - 1]; if (lastMsg.role !== 'model') return; const newVersionIndex = lastMsg.versions.length; const updatedMessages = activeThread.messages.map(m => { if (m.id === lastMsg.id) { return { ...m, versions: [...m.versions, ''], activeVersionIndex: newVersionIndex, content: '' }; } return m; }); updateActiveThreadMessages(updatedMessages); const apiContext = activeThread.messages.slice(0, -1); await performGeneration(apiContext, lastMsg.id, true); };
  const handleEditUserMessage = async (messageId: string, newContent: string) => { const activeThread = getActiveThread(); const updatedMessages = activeThread.messages.map(m => { if (m.id === messageId) { return { ...m, versions: [...m.versions, newContent], activeVersionIndex: m.versions.length, content: newContent }; } return m; }); const isLast = activeThread.messages[activeThread.messages.length - 1].id === messageId; if (isLast) { updateActiveThreadMessages(updatedMessages); const modelMsgId = uuidv4(); const modelMsg: Message = { id: modelMsgId, role: 'model', content: '', versions: [''], activeVersionIndex: 0, timestamp: Date.now() }; const messagesWithModel = [...updatedMessages, modelMsg]; updateActiveThreadMessages(messagesWithModel); await performGeneration(updatedMessages, modelMsgId, false); } else { updateActiveThreadMessages(updatedMessages); } };
  const handleContinueGeneration = async () => { const activeThread = getActiveThread(); const lastMsg = activeThread.messages[activeThread.messages.length - 1]; if (!lastMsg || lastMsg.role !== 'model') return; const continuationPrompt: Message = { id: 'temp-continue', role: 'user', content: "[System: Your last message ended abruptly. Please complete the final sentence or thought immediately. Limit to 40 words.]", versions: [], activeVersionIndex: 0, timestamp: Date.now() }; const apiContext = [...activeThread.messages, continuationPrompt]; const currentContent = lastMsg.content; await performGeneration(apiContext, lastMsg.id, false, { maxOutputTokens: 60, tokenTarget: 40 }, currentContent); };
  const handleManualPing = async () => { if (!state.settings.firebaseConfig?.apiKey) { alert("Firebase credentials not configured."); return; } const toolsSettings = await fetchSettings('tools'); const topic = toolsSettings?.ntfy?.topic || state.deepLogic.secrets.ntfyTopic; const baseUrl = toolsSettings?.ntfy?.baseUrl || 'https://ntfy.sh'; if (!topic) { alert("NTFY Topic not configured."); return; } const prompt = `You are ${activeChar.name}. Write a short notification ping. Tone: ${state.moodState.currentMood}.`; let generatedText = ""; try { await streamGeminiResponse([{ id: 'sys', role: 'user', content: prompt, versions: [], activeVersionIndex: 0, timestamp: Date.now() }], { id: 'void', name: 'Void', description: 'System Context', backgroundImage: '' }, state.settings, activeChar, state.moodState, (chunk) => { generatedText += chunk; }); } catch (e) { generatedText = "Ysaraith is present."; } try { await fetch(`${baseUrl}/${topic}`, { method: 'POST', body: generatedText, headers: { 'Title': `${activeChar.name}: Manual Ping` } }); alert(`Ping sent: "${generatedText}"`); } catch (e) { console.error(e); alert("Failed to send NTFY ping."); } };

  // Use Optional Chaining for Style Variables to prevent crash if theme is somehow missing
  const styleVars = {
      '--active-accent': activeChar.theme?.accentColor || '#d4af37',
      '--active-bg': activeChar.theme?.backgroundColor || '#0d1117',
      '--active-font': activeChar.theme?.fontFamily || "'Cinzel', serif"
  } as React.CSSProperties;

  return (
    <div className="flex h-[100dvh] w-full bg-cerberus-void text-gray-200 overflow-hidden font-sans" style={styleVars}>
      
      {keyManagerMode && (
          <KeyManager 
            mode={keyManagerMode} 
            onKeysReady={handleKeysReady} 
          />
      )}

      <Sidebar threads={getCharacterThreads()} activeThreadId={state.activeThreadId} onSelectThread={(id) => setState(prev => ({ ...prev, activeThreadId: id }))} onCreateThread={handleCreateThread} onDeleteThread={handleDeleteThread} onOpenSettings={() => setSettingsModalState({isOpen: true, initialTab: 'api'})} isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onExport={handleExport} onOpenScriptorium={() => setState(prev => ({ ...prev, isScriptoriumOpen: true }))} onOpenDungeon={() => setState(prev => ({ ...prev, isDungeonOpen: true }))} onOpenTower={() => setState(prev => ({ ...prev, isTowerOpen: true }))} onOpenCharacters={() => setIsGalleryOpen(true)} />
      <ChatArea isSidebarOpen={isSidebarOpen} messages={getActiveThread().messages} oocMessages={getActiveThread().oocMessages} isStreaming={isStreaming} enterToSend={state.settings.enterToSend} onSendMessage={handleSendMessage} onSendOOC={handleSendOOC} onStopGeneration={handleStopGeneration} onRegenerate={handleRegenerate} onReiterate={handleReiterate} onDeleteMessage={handleDeleteMessage} onVersionChange={handleVersionChange} onEditMessage={handleEditUserMessage} onContinueGeneration={handleContinueGeneration} onSidebarToggle={() => setSidebarOpen(!isSidebarOpen)} onDeepLogicOpen={() => setSettingsModalState({isOpen: true, initialTab: 'deeplogic'})} onWardrobeOpen={() => setWardrobeOpen(true)} character={activeChar} portraitScale={state.settings.portraitScale} portraitAspectRatio={state.settings.portraitAspectRatio} activeRoom={getActiveRoom()} rooms={state.rooms} onRoomChange={(roomId) => setState(prev => ({ ...prev, activeRoomId: roomId }))} moodState={state.moodState} agentMode={state.agentMode} currentPortraitUrl={getCurrentPortraitUrl()} apiKeyOpenAI={state.settings.apiKeyOpenAI} apiKeyGemini={state.settings.apiKeyGemini} vttMode={state.settings.vttMode} vttAutoSend={state.settings.vttAutoSend} transcriptionModel={state.settings.transcriptionModel} bgBrightness={state.settings.bgBrightness} aiTextFontUrl={state.settings.aiTextFontUrl} aiTextColor={state.settings.aiTextColor} aiTextStyle={state.settings.aiTextStyle} aiTextSize={state.settings.aiTextSize} userTextFontUrl={state.settings.userTextFontUrl} userTextColor={state.settings.userTextColor} userTextSize={state.settings.userTextSize} hasUnreadOOC={state.hasUnreadOOC} oocAssistEnabled={state.settings.oocAssistEnabled} oocProactivity={state.settings.oocProactivity} oocStyle={state.settings.oocStyle} oocVerboseMode={state.settings.oocVerboseMode || 2} onUpdateOOCSettings={handleUpdateOOCSettings} onClearOOC={handleClearOOC} onDeleteOOC={handleDeleteOOC} onMarkOOCRead={() => setState(prev => ({...prev, hasUnreadOOC: false}))} />
      
      {state.isScriptoriumOpen && (
        <ScriptoriumOverlay isOpen={state.isScriptoriumOpen} onClose={() => setState(prev => ({ ...prev, isScriptoriumOpen: false }))} messages={getScriptoriumThread().messages} config={state.scriptoriumConfig} isStreaming={isStreaming} onSendMessage={handleSendMessageScriptorium} onUpdateConfig={(newConfig) => setState(prev => ({ ...prev, scriptoriumConfig: newConfig }))} onClearMessages={() => updateThreadMessages(SCRIPTORIUM_THREAD_ID, [])} onStopGeneration={handleStopGeneration} enterToSend={state.settings.enterToSend} onManualPing={handleManualPing} apiKeyOpenAI={state.settings.apiKeyOpenAI} apiKeyGemini={state.settings.apiKeyGemini} vttMode={state.settings.vttMode} vttAutoSend={state.settings.vttAutoSend} transcriptionModel={state.settings.transcriptionModel} />
      )}
      
      {state.isDungeonOpen && (
        <DungeonOverlay isOpen={state.isDungeonOpen} onClose={() => setState(prev => ({ ...prev, isDungeonOpen: false }))} activeThread={getActiveDungeonThread()} dungeonThreads={getDungeonThreads()} config={state.dungeonConfig} isStreaming={isStreaming} onSendMessage={handleSendMessageDungeon} onTriggerDM={handleTriggerDM} onClearMessages={() => updateThreadMessages(activeDungeonThreadId, [])} onStopGeneration={handleStopGeneration} enterToSend={state.settings.enterToSend} onSelectThread={(id) => setActiveDungeonThreadId(id)} onCreateThread={handleCreateDungeonThread} onUpdateConfig={(cfg) => setState(prev => ({...prev, dungeonConfig: cfg}))} appSettings={state.settings} />
      )}
      
      {state.isTowerOpen && (
        <TowerOfMirrors isOpen={state.isTowerOpen} onClose={() => setState(prev => ({ ...prev, isTowerOpen: false }))} settings={state.settings} onUpdateSettings={(newSettings) => setState(prev => ({ ...prev, settings: { ...prev.settings, ...newSettings } }))} character={activeChar} />
      )}
      
      {settingsModalState.isOpen && (
        <SettingsModal isOpen={settingsModalState.isOpen} onClose={() => setSettingsModalState({isOpen: false})} initialTab={settingsModalState.initialTab} settings={state.settings} character={activeChar} rooms={state.rooms} scriptoriumConfig={state.scriptoriumConfig} deepLogicConfig={state.deepLogic} onSave={(newSettings, newChar, newRooms, newScriptorium, newDeepLogic) => setState(prev => ({ ...prev, settings: newSettings, characters: prev.characters.map(c => c.id === activeChar.id ? newChar : c), rooms: newRooms || prev.rooms, scriptoriumConfig: newScriptorium || prev.scriptoriumConfig, deepLogic: newDeepLogic || prev.deepLogic }))} onRestore={(newState) => setState(newState)} onExportTxt={handleExportTxt} />
      )}
      
      <WardrobeDrawer isOpen={isWardrobeOpen} onClose={() => setWardrobeOpen(false)} outfits={state.outfits} currentOutfitId={state.currentOutfitId} onSelectOutfit={(id) => setState(prev => ({ ...prev, currentOutfitId: id }))} onUpdateOutfit={(updated) => setState(prev => ({ ...prev, outfits: prev.outfits.map(o => o.id === updated.id ? updated : o) }))} onCreateOutfit={(newOutfit) => setState(prev => ({ ...prev, outfits: [...prev.outfits, newOutfit] }))} />
      <CharacterGallery isOpen={isGalleryOpen} onClose={() => setIsGalleryOpen(false)} templates={DEFAULT_TEMPLATES} userCharacters={state.characters} activeCharacterId={state.activeCharacterId} onSelectCharacter={handleSelectCharacter} onUseTemplate={handleUseTemplate} />
    </div>
  );
};

export default App;
