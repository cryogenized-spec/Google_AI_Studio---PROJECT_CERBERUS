
import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message, Room, CharacterProfile, AppSettings, Thread, ChatState, MoodState, DeepLogicConfig, AgentMode, ScriptoriumConfig, DungeonConfig, Outfit, ScheduleSettings, RuntimeSettings, MemoryPolicy, ToolSettings, WakeLog, QuickPreset } from './types';
import { DEFAULT_PROFILE, DEFAULT_ROOMS, DEFAULT_SETTINGS, DEFAULT_MOOD_STATE, DEFAULT_DEEP_LOGIC, DEFAULT_OUTFITS, DEFAULT_SCHEDULE_SETTINGS, DEFAULT_SCRIPTORIUM_CONFIG, DEFAULT_DUNGEON_CONFIG, OOC_ADVISORY_SYSTEM_PROMPT, OOC_SYSTEM_PROMPT, YSARAITH_PLAYER_PROMPT_ADDENDUM, STATIC_THREAD_ID, SCRIPTORIUM_THREAD_ID, DUNGEON_THREAD_ID, EVENT_DELTAS, STORAGE_KEY, UI_STATE_KEY } from './constants';
import { compileCharacterSystemPrompt } from './services/promptCompiler';
import { streamGeminiResponse } from './services/geminiService';
import { streamGrokResponse } from './services/grokService';
import { runWakeCycleLogic } from './services/wakeService';
import { fetchSettings, saveSettings } from './services/firebaseService';
import { decayStats, applyEvent, executePassiveLoop, logToSheet } from './services/agentService';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import KeyManager from './components/KeyManager';
import ScriptoriumOverlay from './components/ScriptoriumOverlay';
import DungeonOverlay from './components/DungeonOverlay';
import TowerOfMirrors from './components/TowerOfMirrors';
import WardrobeDrawer from './components/WardrobeDrawer';
import CharacterGallery from './components/CharacterGallery';
import CharacterSheetModal from './components/CharacterSheetModal';
import CharacterEditorModal from './components/CharacterEditorModal';
import QuickPanel from './components/QuickPanel';
import { TEMPLATES } from './data/templates';
import { db } from './services/organizerDb';

// Utility Hook for Intervals
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
  
  // Exit Intent State
  const [exitIntent, setExitIntent] = useState(false);
  const [showExitToast, setShowExitToast] = useState(false);

  useEffect(() => {
      const handlePopState = () => {
          setIsQuickMode(window.location.pathname === '/quick');
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- BOOT SEQUENCE HANDOFF (CRITICAL FIX) ---
  useEffect(() => {
    // This tells index.html that React has mounted successfully
    if ((window as any).signalAppReady) {
        setTimeout(() => { (window as any).signalAppReady(); }, 100);
    }
  }, []);

  if (isQuickMode) {
      return <QuickPanel />;
  }

  // --- STATE INITIALIZATION WITH PERSISTENCE ---
  const [state, setState] = useState<ChatState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // 1. Ensure Character List & Sanitize
        let characters: CharacterProfile[] = parsed.characters || [];
        let activeCharacterId = parsed.activeCharacterId;

        if (characters.length === 0) {
            if (parsed.character) {
                const legacyChar: CharacterProfile = {
                    ...DEFAULT_PROFILE,
                    ...parsed.character,
                    id: 'legacy_ysaraith_v1',
                    versionNumber: 1,
                    isTemplate: false,
                    lastUsedAt: Date.now()
                };
                characters.push(legacyChar);
                activeCharacterId = legacyChar.id;
            } else {
                characters.push(DEFAULT_PROFILE);
                activeCharacterId = DEFAULT_PROFILE.id;
            }
        }

        // Deep sanitize characters
        characters = characters.map(c => ({
            ...c,
            theme: { ...DEFAULT_PROFILE.theme, ...(c.theme || {}) },
            constraints: c.constraints || DEFAULT_PROFILE.constraints,
            capabilities: c.capabilities || DEFAULT_PROFILE.capabilities,
            roles: c.roles || { taskAgent: false, narrativeTrustMode: false },
            progression: c.progression || DEFAULT_PROFILE.progression,
            portraitUrl: c.portraitUrl || DEFAULT_PROFILE.portraitUrl,
            name: c.name || 'Unknown Entity'
        }));

        // Restore Threads
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

        // Ensure system threads exist
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

        const activeCharProfile = characters.find(c => c.id === activeCharacterId) || characters[0];

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
           character: activeCharProfile,
           rooms: cleanRooms,
           settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
           moodState: parsed.moodState || DEFAULT_MOOD_STATE,
           deepLogic: parsed.deepLogic || DEFAULT_DEEP_LOGIC,
           agentMode: parsed.agentMode || 'active',
           lastInteractionTimestamp: parsed.lastInteractionTimestamp || Date.now(),
           outfits: parsed.outfits || DEFAULT_OUTFITS,
           currentOutfitId: parsed.currentOutfitId || DEFAULT_OUTFITS[0].id,
           scheduledEvents: parsed.scheduledEvents || DEFAULT_SCHEDULE_SETTINGS,
           isScriptoriumOpen: false,
           scriptoriumConfig: sanitizedScriptorium,
           isDungeonOpen: false,
           dungeonConfig: sanitizedDungeon,
           hasUnreadOOC: parsed.hasUnreadOOC || false,
           isTowerOpen: false,
           traceLogs: parsed.traceLogs || []
        };
      } catch (e) {
        return getFreshInstallState();
      }
    }
    return getFreshInstallState();
  });

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
      scheduledEvents: DEFAULT_SCHEDULE_SETTINGS,
      isScriptoriumOpen: false,
      scriptoriumConfig: DEFAULT_SCRIPTORIUM_CONFIG,
      isDungeonOpen: false,
      dungeonConfig: DEFAULT_DUNGEON_CONFIG,
      hasUnreadOOC: false,
      isTowerOpen: false,
      traceLogs: []
    };
  }

  // --- UI STATE ---
  const getPersistedUI = () => {
      try {
          const stored = localStorage.getItem(UI_STATE_KEY);
          return stored ? JSON.parse(stored) : {};
      } catch (e) { return {}; }
  };
  const uiState = getPersistedUI();

  const [isSidebarOpen, setSidebarOpen] = useState(uiState.isSidebarOpen || false);
  const [settingsModalState, setSettingsModalState] = useState<{isOpen: boolean, initialTab?: 'api' | 'deeplogic'}>(uiState.settingsModalState || {isOpen: false});
  const [isWardrobeOpen, setWardrobeOpen] = useState(uiState.isWardrobeOpen || false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(uiState.isGalleryOpen || false); 
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeDungeonThreadId, setActiveDungeonThreadId] = useState<string>(DUNGEON_THREAD_ID);
  
  const [editingCharacter, setEditingCharacter] = useState<CharacterProfile | null>(null);
  const [viewingCharacter, setViewingCharacter] = useState<CharacterProfile | null>(null);
  const [keyManagerMode, setKeyManagerMode] = useState<'onboarding' | 'unlock' | 'settings' | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- UI PERSISTENCE ---
  useEffect(() => {
      const currentUI = {
          isSidebarOpen,
          settingsModalState,
          isWardrobeOpen,
          isGalleryOpen,
      };
      localStorage.setItem(UI_STATE_KEY, JSON.stringify(currentUI));
  }, [isSidebarOpen, settingsModalState, isWardrobeOpen, isGalleryOpen]);

  // --- DATA PERSISTENCE ---
  useEffect(() => {
    // Save state but strip sensitive keys from settings before writing to LS
    const stateToSave = {
        ...state,
        settings: { ...state.settings, apiKeyGemini: '', apiKeyGrok: '', apiKeyOpenAI: '' }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  }, [state]);

  // --- BACK BUTTON GUARD ---
  useEffect(() => {
      try { window.history.pushState({ ui: 'root' }, '', null); } catch(e) {}

      const handlePopState = (event: PopStateEvent) => {
          let handled = false;

          // 1. Close Modals (Deepest First)
          if (editingCharacter) { setEditingCharacter(null); handled = true; }
          else if (viewingCharacter) { setViewingCharacter(null); handled = true; }
          else if (settingsModalState.isOpen) { setSettingsModalState({ isOpen: false }); handled = true; }
          else if (isWardrobeOpen) { setWardrobeOpen(false); handled = true; }
          else if (isGalleryOpen) { setIsGalleryOpen(false); handled = true; }
          else if (state.isScriptoriumOpen) { setState(prev => ({...prev, isScriptoriumOpen: false})); handled = true; }
          else if (state.isDungeonOpen) { setState(prev => ({...prev, isDungeonOpen: false})); handled = true; }
          else if (state.isTowerOpen) { setState(prev => ({...prev, isTowerOpen: false})); handled = true; }
          else if (isSidebarOpen) { setSidebarOpen(false); handled = true; }

          if (handled) {
              try { window.history.pushState({ ui: 'root' }, '', null); } catch(e) {}
          } else {
              // Exit Intent
              if (!exitIntent) {
                  setExitIntent(true);
                  setShowExitToast(true);
                  try { window.history.pushState({ ui: 'root' }, '', null); } catch(e) {}
                  setTimeout(() => { setExitIntent(false); setShowExitToast(false); }, 2500);
              }
          }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
  }, [
      isSidebarOpen, settingsModalState, isWardrobeOpen, isGalleryOpen,
      state.isScriptoriumOpen, state.isDungeonOpen, state.isTowerOpen,
      editingCharacter, viewingCharacter, exitIntent 
  ]);

  const pushUIState = () => { try { /* Optional manual pushes */ } catch (e) {} };

  // --- KEY CHECK ON BOOT ---
  useEffect(() => {
      const checkKeys = async () => {
          // If keys are already in memory (e.g. from session persistence or hardcoded for dev), we are good
          if (state.settings?.apiKeyGemini || state.settings?.apiKeyGrok) return;

          try {
              if (!db || !db.secrets) throw new Error("DB Not Ready");
              
              const secrets = await db.secrets.toArray();
              const hasEncrypted = secrets.some(s => s.mode === 'encrypted');
              
              if (hasEncrypted) {
                  setKeyManagerMode('unlock');
              } else {
                  // Check for plaintext keys to auto-load
                  const plaintextKeys: Partial<AppSettings> = {};
                  let foundPlain = false;
                  
                  secrets.forEach(s => {
                      if (s.mode === 'plaintext' && s.value) {
                          if (s.id === 'gemini') plaintextKeys.apiKeyGemini = s.value;
                          if (s.id === 'grok') plaintextKeys.apiKeyGrok = s.value;
                          if (s.id === 'openai') plaintextKeys.apiKeyOpenAI = s.value;
                          foundPlain = true;
                      }
                  });

                  if (foundPlain) {
                      handleKeysReady(plaintextKeys);
                  } else {
                      setKeyManagerMode('onboarding');
                  }
              }
          } catch (e) {
              console.error("Failed to check secrets DB:", e);
              setKeyManagerMode('onboarding');
          }
      };
      checkKeys();
  }, []);

  const handleKeysReady = (keys: Partial<AppSettings>) => {
      setState(prev => ({ ...prev, settings: { ...prev.settings, ...keys } }));
      setKeyManagerMode(null);
  };

  // --- WAKE CYCLE ---
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

  // --- SELECTORS & HELPERS ---
  const getActiveCharacter = () => {
      const found = state.characters.find(c => c.id === state.activeCharacterId);
      return found || state.characters[0] || { ...DEFAULT_PROFILE };
  };
  const activeChar = getActiveCharacter();
  const getCharacterThreads = () => state.threads.filter(t => t.characterId === state.activeCharacterId);
  const getActiveThread = () => getCharacterThreads().find(t => t.id === state.activeThreadId) || getCharacterThreads()[0] || state.threads[0];
  const getActiveRoom = () => state.rooms.find(r => r.id === state.activeRoomId) || state.rooms[0];
  const getScriptoriumThread = () => getCharacterThreads().find(t => t.type === 'scriptorium') || state.threads.find(t => t.id === SCRIPTORIUM_THREAD_ID) as Thread;
  const getActiveDungeonThread = () => getCharacterThreads().find(t => t.id === activeDungeonThreadId) || getCharacterThreads().find(t => t.type === 'dungeon') || state.threads.find(t => t.id === DUNGEON_THREAD_ID) as Thread;
  const getDungeonThreads = () => getCharacterThreads().filter(t => t.type === 'dungeon');
  
  const getCurrentPortraitUrl = () => {
      const outfit = state.outfits.find(o => o.id === state.currentOutfitId);
      if (outfit && outfit.wornImageUrl) return outfit.wornImageUrl;
      return activeChar.portraitUrl;
  };

  const updateThreadMessages = (threadId: string, newMessages: Message[]) => { setState(prev => ({ ...prev, threads: prev.threads.map(t => t.id === threadId ? { ...t, messages: newMessages, lastUpdated: Date.now() } : t) })); };
  const updateThreadOOC = (threadId: string, newOOC: Message[]) => { setState(prev => ({ ...prev, threads: prev.threads.map(t => t.id === threadId ? { ...t, oocMessages: newOOC, lastUpdated: Date.now() } : t) })); };
  const updateActiveThreadMessages = (newMessages: Message[]) => { if (state.activeThreadId) updateThreadMessages(state.activeThreadId, newMessages); };
  const updateThreadTitle = (threadId: string, title: string) => { setState(prev => ({ ...prev, threads: prev.threads.map(t => t.id === threadId ? { ...t, title } : t) })); };

  // --- ACTIONS ---
  
  const handleSelectCharacter = (id: string) => {
      const char = state.characters.find(c => c.id === id);
      if (!char) return;
      const updatedChars = state.characters.map(c => c.id === id ? { ...c, lastUsedAt: Date.now() } : c);
      const charThreads = state.threads.filter(t => t.characterId === id);
      let nextThreadId = charThreads.find(t => t.type === 'ritual' || t.type === 'static')?.id;
      
      const newThreads = [...state.threads];
      if (!nextThreadId) {
          const newThread: Thread = { id: uuidv4(), characterId: id, type: 'ritual', title: 'New Ritual', messages: [], oocMessages: [], lastUpdated: Date.now() };
          newThreads.push(newThread);
          nextThreadId = newThread.id;
      }
      setState(prev => ({ ...prev, characters: updatedChars, threads: newThreads, activeCharacterId: id, activeThreadId: nextThreadId || null, character: char }));
  };
  
  const handleUseTemplate = (template: CharacterProfile) => {
      const newCharId = uuidv4();
      const newCharacter: CharacterProfile = { ...template, id: newCharId, baseTemplateId: template.id, versionNumber: 1, isTemplate: false, createdAt: Date.now(), lastUsedAt: Date.now() };
      const staticThread: Thread = { id: uuidv4(), characterId: newCharId, type: 'static', title: 'Static Connection', messages: [], oocMessages: [], lastUpdated: Date.now() };
      const scriptoriumThread: Thread = { id: uuidv4(), characterId: newCharId, type: 'scriptorium', title: 'The Desk', messages: [], oocMessages: [], lastUpdated: Date.now() };
      const dungeonThread: Thread = { id: uuidv4(), characterId: newCharId, type: 'dungeon', title: 'The Gauntlet', messages: [], oocMessages: [], lastUpdated: Date.now() };
      const mainThread: Thread = { id: uuidv4(), characterId: newCharId, type: 'ritual', title: 'First Ritual', messages: [], oocMessages: [], lastUpdated: Date.now() };
      setState(prev => ({ ...prev, characters: [...prev.characters, newCharacter], threads: [...prev.threads, staticThread, scriptoriumThread, dungeonThread, mainThread], activeCharacterId: newCharId, activeThreadId: mainThread.id, character: newCharacter, isGalleryOpen: false }));
      pushUIState(); setEditingCharacter(newCharacter);
  };

  const handleUpdateCharacter = (updatedChar: CharacterProfile) => { setState(prev => ({ ...prev, characters: prev.characters.map(c => c.id === updatedChar.id ? updatedChar : c), character: prev.activeCharacterId === updatedChar.id ? updatedChar : prev.character })); };
  const handleDeleteCharacter = (id: string) => {
      if (state.characters.length <= 1) { alert("Cannot delete the last character."); return; }
      if (!confirm("Are you sure? This will delete all threads and history for this character.")) return;
      const remainingChars = state.characters.filter(c => c.id !== id);
      const remainingThreads = state.threads.filter(t => t.characterId !== id);
      let nextActiveId = state.activeCharacterId;
      if (id === state.activeCharacterId) { nextActiveId = remainingChars[0].id; }
      const nextThreads = remainingThreads.filter(t => t.characterId === nextActiveId);
      const nextThreadId = nextThreads.length > 0 ? nextThreads[0].id : null;
      setState(prev => ({ ...prev, characters: remainingChars, threads: remainingThreads, activeCharacterId: nextActiveId, activeThreadId: nextThreadId, character: remainingChars.find(c => c.id === nextActiveId) || remainingChars[0] }));
  };
  const handleDuplicateCharacter = (char: CharacterProfile) => {
      const newId = uuidv4();
      const copy: CharacterProfile = { ...char, id: newId, name: `${char.name} (Copy)`, versionNumber: 1, createdAt: Date.now(), lastUsedAt: Date.now() };
      const mainThread: Thread = { id: uuidv4(), characterId: newId, type: 'ritual', title: 'First Ritual', messages: [], oocMessages: [], lastUpdated: Date.now() };
      setState(prev => ({ ...prev, characters: [...prev.characters, copy], threads: [...prev.threads, mainThread] }));
  };

  const handleCreateReportThread = (initialContent: string, context: string) => {
      const newThread: Thread = {
          id: uuidv4(),
          characterId: state.activeCharacterId,
          type: 'report',
          title: `AI Report: ${context} (${new Date().toLocaleDateString()})`,
          messages: [{
              id: uuidv4(),
              role: 'model',
              content: initialContent,
              versions: [initialContent],
              activeVersionIndex: 0,
              timestamp: Date.now(),
              speaker: 'System'
          }],
          oocMessages: [],
          lastUpdated: Date.now()
      };
      
      setState(prev => ({
          ...prev,
          threads: [newThread, ...prev.threads],
          activeThreadId: newThread.id
      }));
      setEditingCharacter(null); // Close editor
  };

  // --- GENERATION HANDLERS ---
  const performGeneration = async (messagesContext: Message[], modelMsgId: string, isRegeneration: boolean, overrideSettings?: Partial<AppSettings>, startText: string = '', targetThreadId?: string, dungeonMode?: 'dm' | 'player', injectionPrompt?: string) => {
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();
    let fullResponseText = startText;
    const effectiveSettings = { ...state.settings, ...overrideSettings };
    const threadIdToUpdate = targetThreadId || state.activeThreadId;
    const targetThread = state.threads.find(t => t.id === threadIdToUpdate);
    const isScriptoriumGen = targetThread?.type === 'scriptorium';
    const isDungeonGen = targetThread?.type === 'dungeon';

    try {
        const room = isScriptoriumGen ? { ...DEFAULT_ROOMS[0], name: 'Scriptorium', description: 'The Administrative Domain.', systemPromptOverride: state.scriptoriumConfig.systemPrompt } : isDungeonGen ? { ...DEFAULT_ROOMS[0], name: 'The Gauntlet', description: 'A table set in shadows.', systemPromptOverride: state.dungeonConfig.dmSystemPrompt } : getActiveRoom();
        const currentOutfit = state.outfits.find(o => o.id === state.currentOutfitId);
        let effectiveSystemPrompt = "";
        if (isScriptoriumGen) { effectiveSystemPrompt = state.scriptoriumConfig.systemPrompt; } else if (isDungeonGen) { if (dungeonMode === 'dm') { effectiveSystemPrompt = state.dungeonConfig.dmSystemPrompt; } else { const persona = `\n[CURRENT DEMEANOR: ${state.dungeonConfig.ysaraithDemeanorInfo || state.dungeonConfig.ysaraithDemeanorLabel}]\n`; const base = compileCharacterSystemPrompt(activeChar); effectiveSystemPrompt = `${base}\n${YSARAITH_PLAYER_PROMPT_ADDENDUM}${persona}`; } } else { effectiveSystemPrompt = compileCharacterSystemPrompt(activeChar); effectiveSystemPrompt += `\n\n[CURRENT OUTFIT: ${currentOutfit?.name} - ${currentOutfit?.description}]`; }
        if (effectiveSettings.roleplayIntensity !== undefined || effectiveSettings.writingStyle || effectiveSettings.formattingStyle) { effectiveSystemPrompt += `\n\n**STYLE MODIFIERS:**\n`; if (effectiveSettings.roleplayIntensity < 50) effectiveSystemPrompt += `- Adherence: Relaxed. Breaks in character are permissible for clarity.\n`; else effectiveSystemPrompt += `- Adherence: Strict (${effectiveSettings.roleplayIntensity}%). Total immersion.\n`; }
        if (injectionPrompt) { effectiveSystemPrompt += `\n\n${injectionPrompt}\n`; }
        const augmentedCharacter = { ...activeChar, systemPrompt: effectiveSystemPrompt };
        const onChunk = (text: string) => { fullResponseText += text; setState(prev => ({ ...prev, threads: prev.threads.map(t => { if (t.id !== threadIdToUpdate) return t; const msgs = t.messages.map(m => { if (m.id === modelMsgId) { const newVersions = [...m.versions]; newVersions[m.activeVersionIndex] = fullResponseText; return { ...m, versions: newVersions, content: fullResponseText, speaker: (isDungeonGen ? (dungeonMode === 'dm' ? 'DM' : 'Ysaraith') : undefined) as Message['speaker'] }; } return m; }); return { ...t, messages: msgs }; }) })); };
        if (effectiveSettings.activeProvider === 'gemini') { await streamGeminiResponse(messagesContext, room, effectiveSettings, augmentedCharacter, state.moodState, onChunk, abortControllerRef.current.signal, isScriptoriumGen ? state.scriptoriumConfig.tools : undefined); } else { await streamGrokResponse(messagesContext, room, effectiveSettings, augmentedCharacter, onChunk, abortControllerRef.current.signal); }
        if (state.settings.oocAssistEnabled && !isScriptoriumGen && !isDungeonGen && !isRegeneration && !injectionPrompt) { setTimeout(() => { performAdvisoryGeneration(messagesContext, fullResponseText, threadIdToUpdate || STATIC_THREAD_ID); }, 1000); }
    } catch (error: any) { console.error("Generation Error:", error); let errorMsg = `[System Error: ${error.message || 'Unknown Connection Failure'}]`; try { const raw = error.message || ''; const jsonMatch = raw.match(/"message":\s*"([^"]+)"/); if (jsonMatch && jsonMatch[1]) errorMsg = `[System Error: ${jsonMatch[1]}]`; } catch (e) {} setState(prev => ({ ...prev, threads: prev.threads.map(t => { if (t.id !== threadIdToUpdate) return t; const msgs = t.messages.map(m => { if (m.id === modelMsgId) { return { ...m, content: errorMsg, versions: [errorMsg] }; } return m; }); return { ...t, messages: msgs }; }) })); } finally { setIsStreaming(false); abortControllerRef.current = null; }
  };

  const performAdvisoryGeneration = async (context: Message[], lastResponse: string, threadId: string) => {
      const recentHistory = context.slice(-3); const fullContextText = recentHistory.map(m => `${m.role}: ${m.content}`).join('\n') + `\nmodel: ${lastResponse}`; let advisoryPrompt = OOC_ADVISORY_SYSTEM_PROMPT; if (state.settings.oocPersona === 'character') { advisoryPrompt = `**MODE: PROACTIVE ADVISORY (IN-CHARACTER)**\nIdentity: ${activeChar.name}.\nGoal: Guide story without breaking persona.\nCriteria: Logical errors, lore breaks.`; } advisoryPrompt += `\n**Context:**\n${fullContextText}`; let advisoryText = ""; try { const tempChar = { ...activeChar, systemPrompt: advisoryPrompt }; if (state.settings.activeProvider === 'gemini') { await streamGeminiResponse([{ id: 'sys', role: 'user', content: "Analyze.", versions: [], activeVersionIndex: 0, timestamp: Date.now() }], { ...DEFAULT_ROOMS[0], name: 'Advisory', description: '' }, { ...state.settings, maxOutputTokens: 150 }, tempChar, state.moodState, (chunk) => { advisoryText += chunk; }); } else { await streamGrokResponse([{ id: 'sys', role: 'user', content: "Analyze.", versions: [], activeVersionIndex: 0, timestamp: Date.now() }], { ...DEFAULT_ROOMS[0], name: 'Advisory', description: '' }, { ...state.settings, maxOutputTokens: 150 }, tempChar, (chunk) => { advisoryText += chunk; }); } if (advisoryText.trim() && !advisoryText.includes("NO_ADVISORY")) { const newOOCMsg: Message = { id: uuidv4(), role: 'model', content: advisoryText.trim(), versions: [advisoryText.trim()], activeVersionIndex: 0, timestamp: Date.now() }; const currentThread = state.threads.find(t => t.id === threadId); if (currentThread) { const updatedOOC = [...(currentThread.oocMessages || []), newOOCMsg]; updateThreadOOC(threadId, updatedOOC); setState(prev => ({ ...prev, hasUnreadOOC: true })); } } } catch (e) { console.error("Advisory Gen Failed", e); }
  };

  const performOOCGeneration = async (oocHistory: Message[], narrativeContext: Message[], targetThreadId: string) => {
      setIsStreaming(true); abortControllerRef.current = new AbortController(); let fullResponseText = ""; const modelMsgId = uuidv4(); const updatedOOC = [...oocHistory, { id: modelMsgId, role: 'model', content: '', versions: [''], activeVersionIndex: 0, timestamp: Date.now() } as Message]; updateThreadOOC(targetThreadId, updatedOOC); let verbosityInstruction = ""; switch (state.settings.oocVerboseMode) { case 1: verbosityInstruction = "Be extremely concise."; break; case 3: verbosityInstruction = "Be verbose and detailed."; break; default: verbosityInstruction = "Maintain balanced length."; break; } let baseOocPrompt = OOC_SYSTEM_PROMPT; if (state.settings.oocPersona === 'character') { baseOocPrompt = `**MODE: METAGAMING (IN-CHARACTER)**\nIdentity: ${activeChar.name}.\nGoal: Discuss meta-topics in character.`; } const narrativeSummary = narrativeContext.slice(-5).map(m => `${m.role === 'model' ? activeChar.name : 'User'}: ${m.content}`).join('\n'); const systemPrompt = `${baseOocPrompt}\n**Constraint:** ${verbosityInstruction}\n[RECENT NARRATIVE]\n${narrativeSummary}`; const augmentedCharacter = { ...activeChar, systemPrompt }; const onChunk = (text: string) => { fullResponseText += text; setState(prev => ({ ...prev, threads: prev.threads.map(t => { if (t.id !== targetThreadId) return t; const newOOC = t.oocMessages?.map(m => { if (m.id === modelMsgId) return { ...m, content: fullResponseText }; return m; }); return { ...t, oocMessages: newOOC }; }) })); }; try { if (state.settings.activeProvider === 'gemini') { await streamGeminiResponse(updatedOOC, { ...DEFAULT_ROOMS[0], name: 'OOC Channel', description: 'Meta-space' }, state.settings, augmentedCharacter, state.moodState, onChunk, abortControllerRef.current.signal); } else { await streamGrokResponse(updatedOOC, { ...DEFAULT_ROOMS[0], name: 'OOC Channel', description: 'Meta-space' }, state.settings, augmentedCharacter, onChunk, abortControllerRef.current.signal); } } catch (e: any) { console.error("OOC Gen Failed", e); const errorMsg = `[Connection Error: ${e.message}]`; setState(prev => ({ ...prev, threads: prev.threads.map(t => { if (t.id !== targetThreadId) return t; const newOOC = t.oocMessages?.map(m => { if (m.id === modelMsgId) return { ...m, content: errorMsg }; return m; }); return { ...t, oocMessages: newOOC }; }) })); } finally { setIsStreaming(false); abortControllerRef.current = null; }
  };

  // --- STANDARD HANDLERS ---
  const handleStopGeneration = () => { if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; setIsStreaming(false); } };
  const handleDeleteMessage = (messageId: string) => { const activeThread = getActiveThread(); const newMessages = activeThread.messages.filter(m => m.id !== messageId); updateActiveThreadMessages(newMessages); };
  const handleVersionChange = (messageId: string, newIndex: number) => { const activeThread = getActiveThread(); const updatedMessages = activeThread.messages.map(m => { if (m.id === messageId && newIndex >= 0 && newIndex < m.versions.length) { return { ...m, activeVersionIndex: newIndex, content: m.versions[newIndex] }; } return m; }); updateActiveThreadMessages(updatedMessages); };
  const handleReiterate = async (messageId: string, mode: 'context' | 'logic') => {
      const activeThread = getActiveThread(); const targetIndex = activeThread.messages.findIndex(m => m.id === messageId); if (targetIndex === -1) return; const targetMsg = activeThread.messages[targetIndex]; let promptInjection = ""; if (mode === 'logic') promptInjection = `[SYSTEM INTERVENTION: LOGIC AUDIT]\nStop. A Spatial or Meta-gaming violation was detected.\nRewrite strictly adhering to physics and logic.`; else promptInjection = `[SYSTEM INTERVENTION: REITERATE - NARRATIVE FOCUS]\nStop. Re-read previous messages. Trace cause and effect.\nGenerate a response that logically follows events.`; if (targetMsg.role === 'model') { const newVersionIndex = targetMsg.versions.length; const updatedMessages = activeThread.messages.map(m => { if (m.id === targetMsg.id) { return { ...m, versions: [...m.versions, ''], activeVersionIndex: newVersionIndex, content: '' }; } return m; }); updateActiveThreadMessages(updatedMessages); const apiContext = activeThread.messages.slice(0, targetIndex); await performGeneration(apiContext, targetMsg.id, true, undefined, '', undefined, undefined, promptInjection); }
  };
  const handleCreateThread = () => { const newThread: Thread = { id: uuidv4(), characterId: state.activeCharacterId, type: 'ritual', title: 'New Ritual', messages: [], oocMessages: [], lastUpdated: Date.now() }; setState(prev => ({ ...prev, threads: [newThread, ...prev.threads], activeThreadId: newThread.id })); };
  const handleCreateDungeonThread = () => { const newThread: Thread = { id: uuidv4(), characterId: state.activeCharacterId, type: 'dungeon', title: `Campaign ${getDungeonThreads().length + 1}`, messages: [], oocMessages: [], lastUpdated: Date.now() }; setState(prev => ({ ...prev, threads: [...prev.threads, newThread] })); setActiveDungeonThreadId(newThread.id); };
  const handleDeleteThread = (id: string) => { if (id === STATIC_THREAD_ID || id === SCRIPTORIUM_THREAD_ID || id === DUNGEON_THREAD_ID) return; const newThreads = state.threads.filter(t => t.id !== id); setState(prev => ({ ...prev, threads: newThreads, activeThreadId: prev.activeThreadId === id ? STATIC_THREAD_ID : prev.activeThreadId })); };
  const handleExport = () => { const dataStr = JSON.stringify(state.threads, null, 2); const blob = new Blob([dataStr], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `project_cerberus_export_${Date.now()}.json`; link.click(); };
  const handleSendMessageGeneric = async (content: string, threadId: string, dungeonMode?: 'dm' | 'player') => {
      const thread = state.threads.find(t => t.id === threadId); if (!thread) return; const userMsg: Message = { id: uuidv4(), role: 'user', content, versions: [content], activeVersionIndex: 0, timestamp: Date.now() }; const updatedMessages = [...thread.messages, userMsg]; updateThreadMessages(threadId, updatedMessages); if (thread.type !== 'scriptorium' && thread.type !== 'dungeon') { let eventType = 'USER_MESSAGE_SHORT'; if (content.length > 50) eventType = 'USER_MESSAGE_LONG'; if (content.toLowerCase().includes('love') || content.toLowerCase().includes('please')) eventType = 'USER_FLIRT'; if (content.toLowerCase().includes('good') || content.toLowerCase().includes('thank')) eventType = 'USER_PRAISES'; const newMoodState = applyEvent(state.moodState, eventType as any); setState(prev => ({ ...prev, lastInteractionTimestamp: Date.now(), agentMode: 'active', moodState: newMoodState })); } if (thread.messages.length === 0 && thread.type === 'ritual') { const words = content.split(' ').slice(0, 5).join(' '); updateThreadTitle(thread.id, words + '...'); } const modelMsgId = uuidv4(); const modelMsg: Message = { id: modelMsgId, role: 'model', content: '', versions: [''], activeVersionIndex: 0, timestamp: Date.now(), speaker: dungeonMode === 'dm' ? 'DM' : (thread.type === 'dungeon' ? 'Ysaraith' : undefined) }; const messagesWithModel = [...updatedMessages, modelMsg]; updateThreadMessages(threadId, messagesWithModel); await performGeneration(updatedMessages, modelMsgId, false, undefined, '', threadId, dungeonMode);
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

  // Theme Styles
  const styleVars = {
      '--active-accent': activeChar.theme?.accentColor || '#d4af37',
      '--active-bg': activeChar.theme?.backgroundColor || '#0d1117',
      '--active-font': activeChar.theme?.fontFamily || "'Cinzel', serif"
  } as React.CSSProperties;

  return (
    <div className="flex h-[100dvh] w-full bg-cerberus-void text-gray-200 overflow-hidden font-sans" style={styleVars}>
      
      {showExitToast && (
          <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[200] animate-fadeIn">
              <div className="bg-cerberus-900/90 border border-cerberus-700 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 backdrop-blur-md">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"/>
                  <span className="text-xs font-bold uppercase tracking-widest">Press Back Again to Exit</span>
              </div>
          </div>
      )}

      {keyManagerMode && (
          <KeyManager 
            mode={keyManagerMode} 
            onKeysReady={handleKeysReady} 
          />
      )}

      <Sidebar 
        threads={getCharacterThreads()} 
        activeThreadId={state.activeThreadId} 
        onSelectThread={(id) => setState(prev => ({ ...prev, activeThreadId: id }))} 
        onCreateThread={handleCreateThread} 
        onDeleteThread={handleDeleteThread} 
        onOpenSettings={() => { pushUIState(); setSettingsModalState({isOpen: true, initialTab: 'api'}); }} 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        onExport={handleExport} 
        onOpenScriptorium={() => { pushUIState(); setState(prev => ({ ...prev, isScriptoriumOpen: true })); }} 
        onOpenDungeon={() => { pushUIState(); setState(prev => ({ ...prev, isDungeonOpen: true })); }} 
        onOpenTower={() => { pushUIState(); setState(prev => ({ ...prev, isTowerOpen: true })); }} 
        onOpenCharacters={() => { pushUIState(); setIsGalleryOpen(true); }} 
      />
      <ChatArea isSidebarOpen={isSidebarOpen} messages={getActiveThread().messages} oocMessages={getActiveThread().oocMessages} isStreaming={isStreaming} enterToSend={state.settings.enterToSend} onSendMessage={handleSendMessage} onSendOOC={handleSendOOC} onStopGeneration={handleStopGeneration} onRegenerate={handleRegenerate} onReiterate={handleReiterate} onDeleteMessage={handleDeleteMessage} onVersionChange={handleVersionChange} onEditMessage={handleEditUserMessage} onContinueGeneration={handleContinueGeneration} onSidebarToggle={() => { if(!isSidebarOpen) pushUIState(); setSidebarOpen(!isSidebarOpen); }} onDeepLogicOpen={() => { pushUIState(); setSettingsModalState({isOpen: true, initialTab: 'deeplogic'}); }} onWardrobeOpen={() => { pushUIState(); setWardrobeOpen(true); }} character={activeChar} portraitScale={state.settings.portraitScale} portraitAspectRatio={state.settings.portraitAspectRatio} activeRoom={getActiveRoom()} rooms={state.rooms} onRoomChange={(roomId) => setState(prev => ({ ...prev, activeRoomId: roomId }))} moodState={state.moodState} agentMode={state.agentMode} currentPortraitUrl={getCurrentPortraitUrl()} apiKeyOpenAI={state.settings.apiKeyOpenAI} apiKeyGemini={state.settings.apiKeyGemini} vttMode={state.settings.vttMode} vttAutoSend={state.settings.vttAutoSend} transcriptionModel={state.settings.transcriptionModel} bgBrightness={state.settings.bgBrightness} aiTextFontUrl={state.settings.aiTextFontUrl} aiTextColor={state.settings.aiTextColor} aiTextStyle={state.settings.aiTextStyle} aiTextSize={state.settings.aiTextSize} userTextFontUrl={state.settings.userTextFontUrl} userTextColor={state.settings.userTextColor} userTextSize={state.settings.userTextSize} hasUnreadOOC={state.hasUnreadOOC} oocAssistEnabled={state.settings.oocAssistEnabled} oocProactivity={state.settings.oocProactivity} oocStyle={state.settings.oocStyle} oocVerboseMode={state.settings.oocVerboseMode || 2} onUpdateOOCSettings={handleUpdateOOCSettings} onClearOOC={handleClearOOC} onDeleteOOC={handleDeleteOOC} onMarkOOCRead={() => setState(prev => ({...prev, hasUnreadOOC: false}))} magicInputSettings={state.settings.magicInput} traceLogs={state.traceLogs} activeThread={getActiveThread()} />
      
      {state.isScriptoriumOpen && (
        <ScriptoriumOverlay isOpen={state.isScriptoriumOpen} onClose={() => setState(prev => ({ ...prev, isScriptoriumOpen: false }))} config={state.scriptoriumConfig} isStreaming={isStreaming} onSendMessage={handleSendMessageScriptorium} onUpdateConfig={(newConfig) => setState(prev => ({ ...prev, scriptoriumConfig: newConfig }))} onClearMessages={() => updateThreadMessages(SCRIPTORIUM_THREAD_ID, [])} onStopGeneration={handleStopGeneration} enterToSend={state.settings.enterToSend} onManualPing={handleManualPing} apiKeyOpenAI={state.settings.apiKeyOpenAI} apiKeyGemini={state.settings.apiKeyGemini} vttMode={state.settings.vttMode} vttAutoSend={state.settings.vttAutoSend} transcriptionModel={state.settings.transcriptionModel} messages={getScriptoriumThread().messages}/>
      )}
      
      {state.isDungeonOpen && (
        <DungeonOverlay isOpen={state.isDungeonOpen} onClose={() => setState(prev => ({ ...prev, isDungeonOpen: false }))} activeThread={getActiveDungeonThread()} dungeonThreads={getDungeonThreads()} config={state.dungeonConfig} isStreaming={isStreaming} onSendMessage={handleSendMessageDungeon} onTriggerDM={handleTriggerDM} onClearMessages={() => updateThreadMessages(activeDungeonThreadId, [])} onStopGeneration={handleStopGeneration} enterToSend={state.settings.enterToSend} onSelectThread={(id) => setActiveDungeonThreadId(id)} onCreateThread={handleCreateDungeonThread} onUpdateConfig={(cfg) => setState(prev => ({...prev, dungeonConfig: cfg}))} appSettings={state.settings} />
      )}
      
      {state.isTowerOpen && (
        <TowerOfMirrors isOpen={state.isTowerOpen} onClose={() => setState(prev => ({ ...prev, isTowerOpen: false }))} settings={state.settings} onUpdateSettings={(newSettings) => setState(prev => ({ ...prev, settings: { ...prev.settings, ...newSettings } }))} character={activeChar} />
      )}
      
      {/* --- NEW MODALS --- */}
      {viewingCharacter && (
          <CharacterSheetModal 
            character={viewingCharacter} 
            onClose={() => setViewingCharacter(null)} 
            onCustomize={() => {
                handleUseTemplate(viewingCharacter);
                setViewingCharacter(null);
            }}
          />
      )}

      {editingCharacter && (
          <CharacterEditorModal 
            character={editingCharacter}
            isOpen={true}
            onClose={() => setEditingCharacter(null)}
            onSave={handleUpdateCharacter}
            appSettings={state.settings} 
            onCreateReportThread={(content, context) => {
                const newThreadId = uuidv4();
                const newThread: Thread = { 
                    id: newThreadId, 
                    characterId: state.activeCharacterId, 
                    type: 'report', 
                    title: `AI Report: ${context}`, 
                    messages: [{
                        id: uuidv4(),
                        role: 'model',
                        content: content,
                        versions: [content],
                        activeVersionIndex: 0,
                        timestamp: Date.now(),
                        speaker: 'System'
                    }], 
                    oocMessages: [], 
                    lastUpdated: Date.now() 
                };
                setState(prev => ({ ...prev, threads: [newThread, ...prev.threads], activeThreadId: newThreadId }));
                setEditingCharacter(null);
            }}
          />
      )}

      {settingsModalState.isOpen && (
        <SettingsModal 
            isOpen={settingsModalState.isOpen} 
            onClose={() => setSettingsModalState({isOpen: false})} 
            settings={state.settings} 
            onUpdateSettings={(newSettings) => setState(prev => ({ ...prev, settings: {...prev.settings, ...newSettings} }))} 
            setIsKeyManagerOpen={() => setKeyManagerMode('settings')} 
            deepLogic={state.deepLogic}
            onUpdateDeepLogic={(newDL) => setState(prev => ({ ...prev, deepLogic: { ...prev.deepLogic, ...newDL } }))}
        />
      )}
      
      <WardrobeDrawer isOpen={isWardrobeOpen} onClose={() => setWardrobeOpen(false)} outfits={state.outfits} currentOutfitId={state.currentOutfitId} onSelectOutfit={(id) => setState(prev => ({ ...prev, currentOutfitId: id }))} onUpdateOutfit={(updated) => setState(prev => ({ ...prev, outfits: prev.outfits.map(o => o.id === updated.id ? updated : o) }))} onCreateOutfit={(newOutfit) => setState(prev => ({ ...prev, outfits: [...prev.outfits, newOutfit] }))} />
      
      <CharacterGallery 
        isOpen={isGalleryOpen} 
        onClose={() => setIsGalleryOpen(false)} 
        templates={TEMPLATES} 
        userCharacters={state.characters} 
        activeCharacterId={state.activeCharacterId} 
        threads={state.threads} 
        onSelectCharacter={handleSelectCharacter} 
        onUseTemplate={handleUseTemplate} 
        onEditCharacter={(c) => { pushUIState(); setEditingCharacter(c); }}
        onDeleteCharacter={handleDeleteCharacter}
        onViewDetails={(c) => { pushUIState(); setViewingCharacter(c); }}
        onDuplicateCharacter={handleDuplicateCharacter}
      />
    </div>
  );
};

export default App;
