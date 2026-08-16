/**
 * stateMigration.ts
 * Pass 1 Stabilisation – pure migration & sanitisation helpers for Project Cerberus.
 *
 * Goals:
 * - Explicit schema versioning inside the persisted object
 * - Defensive character & thread sanitisation
 * - Guaranteed existence of system threads
 * - Clear, logged fallbacks instead of silent data loss
 */

import { v4 as uuidv4 } from 'uuid';
import {
  CharacterProfile,
  Thread,
  Room,
  ChatState,
  AppSettings,
  MoodState,
  DeepLogicConfig,
  ScriptoriumConfig,
  DungeonConfig,
  Outfit,
  ScheduleSettings,
  Message
} from '../types';
import {
  DEFAULT_PROFILE,
  DEFAULT_ROOMS,
  DEFAULT_SETTINGS,
  DEFAULT_MOOD_STATE,
  DEFAULT_DEEP_LOGIC,
  DEFAULT_OUTFITS,
  DEFAULT_SCHEDULE_SETTINGS,
  DEFAULT_SCRIPTORIUM_CONFIG,
  DEFAULT_DUNGEON_CONFIG,
  STATIC_THREAD_ID,
  SCRIPTORIUM_THREAD_ID,
  DUNGEON_THREAD_ID
} from '../constants';

/** Current schema version written into every saved state object. */
export const CURRENT_SCHEMA_VERSION = 7;

export interface PersistedState extends Partial<ChatState> {
  schemaVersion?: number;
  lastSavedAt?: number;
}

/**
 * Deep-sanitise a single character so nested objects cannot be undefined/null.
 */
export function sanitizeCharacter(c: any, fallbackId?: string): CharacterProfile {
  const base = { ...DEFAULT_PROFILE };

  return {
    ...base,
    ...c,
    id: c?.id || fallbackId || uuidv4(),
    name: (c?.name && String(c.name).trim()) || 'Unknown Entity',
    portraitUrl: c?.portraitUrl || base.portraitUrl,
    isTemplate: Boolean(c?.isTemplate),
    versionNumber: typeof c?.versionNumber === 'number' ? c.versionNumber : 1,
    createdAt: typeof c?.createdAt === 'number' ? c.createdAt : Date.now(),
    lastUsedAt: typeof c?.lastUsedAt === 'number' ? c.lastUsedAt : Date.now(),
    theme: {
      ...base.theme,
      ...(c?.theme || {})
    },
    constraints: {
      ...base.constraints,
      ...(c?.constraints || {}),
      romance: {
        ...base.constraints.romance,
        ...(c?.constraints?.romance || {})
      }
    },
    capabilities: {
      ...base.capabilities,
      ...(c?.capabilities || {})
    },
    roles: {
      taskAgent: Boolean(c?.roles?.taskAgent),
      narrativeTrustMode: Boolean(c?.roles?.narrativeTrustMode)
    },
    progression: {
      ...base.progression,
      ...(c?.progression || {}),
      badges: Array.isArray(c?.progression?.badges) ? c.progression.badges : [],
      arcProgress: c?.progression?.arcProgress && typeof c.progression.arcProgress === 'object'
        ? c.progression.arcProgress
        : {}
    },
    systemPrompt: c?.systemPrompt || base.systemPrompt,
    mappingLogic: c?.mappingLogic || base.mappingLogic,
    gallery: c?.gallery && typeof c.gallery === 'object' ? c.gallery : undefined,
    portraitScale: typeof c?.portraitScale === 'number' ? c.portraitScale : undefined,
    portraitDock: c?.portraitDock === 'left' || c?.portraitDock === 'right' ? c.portraitDock : undefined,
    greeting: c?.greeting,
    tagline: c?.tagline,
    archetype: c?.archetype,
    baseTemplateId: c?.baseTemplateId,
    templateId: c?.templateId
  };
}

/**
 * Ensure every message has versions + activeVersionIndex.
 */
export function sanitizeMessage(m: any): Message {
  const content = typeof m?.content === 'string' ? m.content : '';
  const versions = Array.isArray(m?.versions) && m.versions.length > 0
    ? m.versions
    : [content];
  const activeVersionIndex =
    typeof m?.activeVersionIndex === 'number' &&
    m.activeVersionIndex >= 0 &&
    m.activeVersionIndex < versions.length
      ? m.activeVersionIndex
      : 0;

  return {
    id: m?.id || uuidv4(),
    role: m?.role === 'model' || m?.role === 'system' || m?.role === 'assistant' ? m.role : 'user',
    content: versions[activeVersionIndex] ?? content,
    timestamp: typeof m?.timestamp === 'number' ? m.timestamp : Date.now(),
    versions,
    activeVersionIndex,
    speaker: m?.speaker
  };
}

/**
 * Migrate and sanitise a thread.
 */
export function sanitizeThread(t: any, fallbackCharacterId: string): Thread {
  const id = t?.id || uuidv4();
  let type: Thread['type'] = t?.type;

  if (!type) {
    if (id === STATIC_THREAD_ID) type = 'static';
    else if (id === SCRIPTORIUM_THREAD_ID) type = 'scriptorium';
    else if (id === DUNGEON_THREAD_ID) type = 'dungeon';
    else type = 'ritual';
  }

  return {
    id,
    title: (t?.title && String(t.title).trim()) || 'Untitled',
    type,
    characterId: t?.characterId || fallbackCharacterId,
    messages: Array.isArray(t?.messages) ? t.messages.map(sanitizeMessage) : [],
    oocMessages: Array.isArray(t?.oocMessages) ? t.oocMessages.map(sanitizeMessage) : [],
    createdAt: typeof t?.createdAt === 'number' ? t.createdAt : undefined,
    updatedAt: typeof t?.updatedAt === 'number' ? t.updatedAt : undefined,
    lastUpdated: typeof t?.lastUpdated === 'number' ? t.lastUpdated : Date.now()
  };
}

/**
 * Guarantee the three system threads exist for a given character.
 */
export function ensureSystemThreads(
  threads: Thread[],
  characterId: string
): Thread[] {
  const result = [...threads];

  const ensure = (id: string, type: Thread['type'], title: string) => {
    if (!result.find(t => t.id === id)) {
      result.push({
        id,
        characterId,
        type,
        title,
        messages: [],
        oocMessages: [],
        lastUpdated: Date.now()
      });
    }
  };

  ensure(STATIC_THREAD_ID, 'static', 'Static Connection');
  ensure(SCRIPTORIUM_THREAD_ID, 'scriptorium', 'Ebon Scriptorium');
  ensure(DUNGEON_THREAD_ID, 'dungeon', 'The Gauntlet');

  return result;
}

/**
 * Clean rooms list – remove legacy scriptorium room id and ensure defaults.
 */
export function sanitizeRooms(rooms: any[]): Room[] {
  const cleaned = (Array.isArray(rooms) ? rooms : [])
    .filter((r: any) => r && r.id && r.id !== 'scriptorium')
    .map((r: any) => ({
      id: r.id,
      name: r.name || 'Unnamed Room',
      description: r.description || '',
      backgroundImage: r.backgroundImage || '',
      systemPromptOverride: r.systemPromptOverride
    }));

  DEFAULT_ROOMS.forEach(def => {
    if (def.id !== 'scriptorium' && !cleaned.find(r => r.id === def.id)) {
      cleaned.push({ ...def });
    }
  });

  return cleaned.length > 0 ? cleaned : [...DEFAULT_ROOMS];
}

/**
 * Build a completely fresh install state.
 */
export function createFreshInstallState(): ChatState {
  const initialCharId = 'legacy_ysaraith_v1';
  const now = Date.now();

  const staticThread: Thread = {
    id: STATIC_THREAD_ID,
    characterId: initialCharId,
    type: 'static',
    title: 'Static Connection',
    messages: [],
    oocMessages: [],
    lastUpdated: now
  };
  const scriptoriumThread: Thread = {
    id: SCRIPTORIUM_THREAD_ID,
    characterId: initialCharId,
    type: 'scriptorium',
    title: 'Ebon Scriptorium',
    messages: [],
    oocMessages: [],
    lastUpdated: now
  };
  const dungeonThread: Thread = {
    id: DUNGEON_THREAD_ID,
    characterId: initialCharId,
    type: 'dungeon',
    title: 'The Gauntlet',
    messages: [],
    oocMessages: [],
    lastUpdated: now
  };
  const initialThread: Thread = {
    id: uuidv4(),
    characterId: initialCharId,
    type: 'ritual',
    title: 'First Ritual',
    messages: [],
    oocMessages: [],
    lastUpdated: now
  };

  const profile = sanitizeCharacter(
    { ...DEFAULT_PROFILE, id: initialCharId, isTemplate: false },
    initialCharId
  );

  return {
    threads: [staticThread, scriptoriumThread, dungeonThread, initialThread],
    characters: [profile],
    activeCharacterId: initialCharId,
    activeThreadId: initialThread.id,
    rooms: sanitizeRooms(DEFAULT_ROOMS),
    activeRoomId: DEFAULT_ROOMS[0]?.id || 'void',
    settings: { ...DEFAULT_SETTINGS },
    character: profile,
    agentMode: 'active',
    lastInteractionTimestamp: now,
    moodState: { ...DEFAULT_MOOD_STATE, lastShiftTimestamp: now },
    deepLogic: { ...DEFAULT_DEEP_LOGIC },
    outfits: [...DEFAULT_OUTFITS],
    currentOutfitId: DEFAULT_OUTFITS[0]?.id,
    scheduledEvents: { ...DEFAULT_SCHEDULE_SETTINGS },
    isScriptoriumOpen: false,
    scriptoriumConfig: { ...DEFAULT_SCRIPTORIUM_CONFIG },
    isDungeonOpen: false,
    dungeonConfig: { ...DEFAULT_DUNGEON_CONFIG },
    hasUnreadOOC: false,
    isTowerOpen: false,
    traceLogs: []
  };
}

/**
 * Main entry: take raw localStorage JSON and produce a safe ChatState.
 * Never throws – always returns a usable state.
 */
export function migratePersistedState(raw: string | null): ChatState {
  if (!raw) {
    console.info('[Cerberus Migration] No persisted state – fresh install.');
    return createFreshInstallState();
  }

  let parsed: PersistedState;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error('[Cerberus Migration] JSON parse failed – falling back to fresh state.', err);
    return createFreshInstallState();
  }

  try {
    const incomingVersion = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 6;

    // --- Characters ---
    let characters: CharacterProfile[] = Array.isArray(parsed.characters)
      ? parsed.characters.map((c: any) => sanitizeCharacter(c))
      : [];

    let activeCharacterId = parsed.activeCharacterId;

    if (characters.length === 0) {
      if (parsed.character) {
        const legacy = sanitizeCharacter(
          { ...parsed.character, id: 'legacy_ysaraith_v1', isTemplate: false },
          'legacy_ysaraith_v1'
        );
        characters = [legacy];
        activeCharacterId = legacy.id;
      } else {
        const fresh = sanitizeCharacter(
          { ...DEFAULT_PROFILE, id: 'legacy_ysaraith_v1', isTemplate: false },
          'legacy_ysaraith_v1'
        );
        characters = [fresh];
        activeCharacterId = fresh.id;
      }
    }

    // Ensure activeCharacterId points to a real character
    const activeCharProfile =
      characters.find(c => c.id === activeCharacterId) || characters[0];
    activeCharacterId = activeCharProfile.id;

    // --- Threads ---
    let threads: Thread[] = Array.isArray(parsed.threads)
      ? parsed.threads.map((t: any) => sanitizeThread(t, activeCharacterId))
      : [];

    threads = ensureSystemThreads(threads, activeCharacterId);

    // --- Rooms ---
    const rooms = sanitizeRooms(parsed.rooms || []);

    // --- Config objects ---
    const scriptoriumConfig: ScriptoriumConfig = {
      ...DEFAULT_SCRIPTORIUM_CONFIG,
      ...(parsed.scriptoriumConfig || {}),
      tools: {
        ...DEFAULT_SCRIPTORIUM_CONFIG.tools,
        ...(parsed.scriptoriumConfig?.tools || {})
      }
    };

    const dungeonConfig: DungeonConfig = {
      ...DEFAULT_DUNGEON_CONFIG,
      ...(parsed.dungeonConfig || {})
    };

    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...(parsed.settings || {})
    };
    // Never restore API keys from the main state blob
    settings.apiKeyGemini = '';
    settings.apiKeyGrok = '';
    settings.apiKeyOpenAI = '';

    const moodState: MoodState = parsed.moodState
      ? {
          ...DEFAULT_MOOD_STATE,
          ...parsed.moodState,
          stats: {
            ...DEFAULT_MOOD_STATE.stats,
            ...(parsed.moodState.stats || {})
          }
        }
      : { ...DEFAULT_MOOD_STATE };

    const deepLogic: DeepLogicConfig = {
      ...DEFAULT_DEEP_LOGIC,
      ...(parsed.deepLogic || {}),
      channels: {
        ...DEFAULT_DEEP_LOGIC.channels,
        ...(parsed.deepLogic?.channels || {})
      },
      secrets: {
        ...DEFAULT_DEEP_LOGIC.secrets,
        ...(parsed.deepLogic?.secrets || {})
      }
    };

    const result: ChatState = {
      threads,
      characters,
      activeCharacterId,
      activeThreadId:
        parsed.activeThreadId && threads.some(t => t.id === parsed.activeThreadId)
          ? parsed.activeThreadId
          : threads.find(t => t.type === 'ritual')?.id || threads[0]?.id || STATIC_THREAD_ID,
      rooms,
      activeRoomId:
        parsed.activeRoomId && rooms.some(r => r.id === parsed.activeRoomId)
          ? parsed.activeRoomId
          : rooms[0]?.id || 'void',
      settings,
      character: activeCharProfile,
      agentMode: parsed.agentMode || 'active',
      lastInteractionTimestamp: parsed.lastInteractionTimestamp || Date.now(),
      moodState,
      deepLogic,
      outfits: Array.isArray(parsed.outfits) && parsed.outfits.length > 0
        ? parsed.outfits
        : [...DEFAULT_OUTFITS],
      currentOutfitId:
        parsed.currentOutfitId ||
        (Array.isArray(parsed.outfits) && parsed.outfits[0]?.id) ||
        DEFAULT_OUTFITS[0]?.id,
      scheduledEvents: parsed.scheduledEvents
        ? { ...DEFAULT_SCHEDULE_SETTINGS, ...parsed.scheduledEvents }
        : { ...DEFAULT_SCHEDULE_SETTINGS },
      isScriptoriumOpen: false,
      scriptoriumConfig,
      isDungeonOpen: false,
      dungeonConfig,
      hasUnreadOOC: Boolean(parsed.hasUnreadOOC),
      isTowerOpen: false,
      traceLogs: Array.isArray(parsed.traceLogs) ? parsed.traceLogs : []
    };

    console.info(
      `[Cerberus Migration] Loaded schema v${incomingVersion} → v${CURRENT_SCHEMA_VERSION}. Characters: ${characters.length}, Threads: ${threads.length}`
    );

    return result;
  } catch (err) {
    console.error('[Cerberus Migration] Migration failed – falling back to fresh state.', err);
    return createFreshInstallState();
  }
}

/**
 * Prepare state for writing to localStorage.
 * Strips secrets and stamps schema version + timestamp.
 */
export function prepareStateForPersistence(state: ChatState): PersistedState {
  return {
    ...state,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    lastSavedAt: Date.now(),
    settings: {
      ...state.settings,
      apiKeyGemini: '',
      apiKeyGrok: '',
      apiKeyOpenAI: ''
    },
    // UI flags should not be durable across sessions in the main blob
    isScriptoriumOpen: false,
    isDungeonOpen: false,
    isTowerOpen: false
  };
}
