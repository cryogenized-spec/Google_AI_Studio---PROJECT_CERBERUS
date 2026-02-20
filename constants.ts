
import { Room, CharacterProfile, AppSettings, MoodState, DeepLogicConfig, Outfit, ScheduledEvents, ScriptoriumConfig, RuntimeSettings, ScheduleSettings, MemoryPolicy, ToolSettings, DungeonConfig, ImageGenConfig, MagicInputSettings } from './types';

export const STATIC_THREAD_ID = 'static_connection_main';
export const SCRIPTORIUM_THREAD_ID = 'scriptorium_thread_v1';
export const DUNGEON_THREAD_ID = 'dungeon_thread_gauntlet';

export const DEFAULT_MAGIC_INPUT_SETTINGS: MagicInputSettings = {
    enabled: true,
    outputMode: 'roleplay',
    enableDndRules: false,
    enableTacticalAdvisor: false,
    advisorLevel: 5,
    targetTokenCount: 150,
    tokenMargin: 50
};

export const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = {
    allowAutomation: true,
    inactiveAfterMinutes: 30,
    skipScheduledWhenActive: true,
    cooldownMinutes: 60,
    toleranceMinutes: 15,
    doNotDisturb: { startHHMM: '00:00', endHHMM: '06:00' }
};

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
    timezone: 'America/New_York',
    perTargetOncePerDay: true,
    targets: [
        { id: 'morning', name: 'Morning Brief', timeHHMM: '08:00', enabled: true, channel: 'inapp' },
        { id: 'evening', name: 'Evening Check-in', timeHHMM: '20:00', enabled: true, channel: 'inapp' }
    ]
};

export const DEFAULT_MEMORY_POLICY: MemoryPolicy = {
    retentionDays: 30
};

export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
    ntfy: {
        topic: 'cerberus_alerts',
        baseUrl: 'https://ntfy.sh',
        enabledOutbound: false
    }
};

export const DEFAULT_SETTINGS: AppSettings = {
    apiKeyGemini: '',
    apiKeyGrok: '',
    apiKeyOpenAI: '',
    activeProvider: 'gemini',
    modelGemini: 'gemini-3-flash-preview',
    modelGrok: 'grok-beta',
    
    userName: 'User',
    userDescription: '',
    
    temperature: 0.9,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 2048,
    tokenTarget: 200,
    stopSequences: '',
    presencePenalty: 0,
    frequencyPenalty: 0,
    safetyLevel: 'standard',
    
    bgBrightness: 50,
    fastBoot: false,
    
    portraitScale: 1.0,
    portraitAspectRatio: '4/5',
    
    aiTextFontUrl: '',
    aiTextColor: '#e5e7eb',
    aiTextStyle: 'none',
    aiTextSize: 14,
    userTextFontUrl: '',
    userTextColor: '#9ca3af',
    userTextSize: 14,
    
    vttMode: 'browser',
    vttAutoSend: false,
    transcriptionModel: 'gpt-4o-mini-transcribe',
    
    enterToSend: true,
    roleplayIntensity: 80,
    writingStyle: 'cinematic',
    formattingStyle: 'standard',
    
    oocAssistEnabled: true,
    oocProactivity: 5,
    oocStyle: 5,
    oocVerboseMode: 2,
    oocPersona: 'character',
    
    magicInput: DEFAULT_MAGIC_INPUT_SETTINGS,
    
    imageModelGoogle: 'gemini-2.5-flash-image',
    imageModelOpenAI: 'dall-e-3',
    
    githubToken: '',
    githubOwner: '',
    githubRepo: ''
};

export const DEFAULT_PROFILE: CharacterProfile = {
    id: 'default',
    isTemplate: true,
    name: 'Ysaraith',
    portraitUrl: 'https://picsum.photos/400/500',
    theme: {
        primaryColor: '#9b2c2c',
        accentColor: '#d4af37',
        backgroundColor: '#0d1117',
        fontFamily: 'serif'
    },
    progression: {
        affinity: 0,
        trust: 0,
        bondLevel: 0,
        badges: [],
        arcProgress: {}
    },
    constraints: {
        shortBio: 'Default entity.',
        fullBio: 'A powerful entity bound to the user.',
        appearanceDescription: 'Unknown.',
        likes: [],
        dislikes: [],
        triggers: [],
        boundaries: [],
        consentStyle: 'normal',
        romance: { enabled: true, pace: 'medium' },
        writingStyle: 'cinematic',
        verbosity: 'medium',
        knowledgeScope: 'in_world_only'
    },
    capabilities: {
        planning: 5,
        empathy: 5,
        puzzleSolving: 5,
        lore: 5,
        tactics: 5,
        toolDiscipline: 5,
        flaws: []
    },
    roles: {
        taskAgent: true,
        narrativeTrustMode: false
    },
    systemPrompt: 'You are Ysaraith.',
    mappingLogic: 'Standard Euclidean Space.',
    createdAt: Date.now(),
    lastUsedAt: Date.now()
};

export const DEFAULT_ROOMS: Room[] = [
    { id: 'void', name: 'The Void', description: 'Empty space.', backgroundImage: '' }
];

export const DEFAULT_MOOD_STATE: MoodState = {
    currentMood: 'Cool',
    satisfaction: 50,
    bratFactor: 50,
    stats: { attention: 50, arousal: 0, validation: 50, agency: 50, mystery: 50, scarcity: 50, consent: 100, resonance: 50 },
    lastShiftTimestamp: Date.now()
};

export const DEFAULT_DEEP_LOGIC: DeepLogicConfig = {
    killSwitch: false,
    passwordEnabled: false,
    activeTimeout: 30,
    simulationMode: false,
    channels: { ntfy: false },
    secrets: { ntfyTopic: '', sheetId: '' }
};

export const DEFAULT_OUTFITS: Outfit[] = [
    { id: 'default_outfit', name: 'Standard Form', description: 'Base appearance.', imageUrl: '', origin: 'System' }
];

export const DEFAULT_SCHEDULE = { events: [] };

export const DEFAULT_SCRIPTORIUM_CONFIG: ScriptoriumConfig = {
    backgroundImage: '',
    systemPrompt: 'You are a helpful secretary.',
    tools: { gmail: true, calendar: true, tasks: true, docs: true, keep: true }
};

export const DEFAULT_DUNGEON_CONFIG: DungeonConfig = {
    dmSystemPrompt: 'You are a DM.',
    dmColor: '#ff0000',
    dmFont: 'serif',
    dmTextSize: 16,
    backgroundImage: '',
    ysaraithDemeanorLabel: 'Neutral',
    ysaraithDemeanorInfo: 'She is watching.'
};

export const DEFAULT_CHARACTER_PROMPT = "You are a character.";
export const DEFAULT_MAPPING_LOGIC = "Basic spatial awareness.";
export const MAPPING_LOGIC_ADVANCED = "Advanced 5D spatial awareness.";
export const MAPPING_LOGIC_BASIC = "Basic spatial awareness.";

export const EVENT_DELTAS = {
    USER_MESSAGE_SHORT: { attention: 1 },
    USER_MESSAGE_LONG: { attention: 2, validation: 1 },
    USER_FLIRT: { arousal: 5, validation: 2 },
    USER_PRAISES: { validation: 5, resonance: 2 }
};

export const OOC_ADVISORY_SYSTEM_PROMPT = "You are an OOC advisor.";
export const OOC_SYSTEM_PROMPT = "You are speaking Out of Character.";
export const YSARAITH_PLAYER_PROMPT_ADDENDUM = "Ysaraith is playing a TTRPG.";

export const DEMEANOR_PRESETS = {
    "Neutral": "Observant and quiet.",
    "Aggressive": "Eager for combat.",
    "Curious": "Investigates everything."
};

export const WIZARD_SYSTEM_PROMPT = "You are an image generation wizard.";
export const IMAGE_STYLES = [
    { id: 'realistic', label: 'Realistic', desc: 'Photo-realism' },
    { id: 'anime', label: 'Anime', desc: 'Japanese animation style' },
    { id: 'oil', label: 'Oil Painting', desc: 'Classic canvas texture' }
];

export const DEFAULT_IMAGE_GEN_CONFIG: ImageGenConfig = {
    provider: 'google',
    model: 'gemini-2.5-flash-image',
    stylePreset: 'realistic',
    aspectRatio: '1:1',
    count: 1
};

export const STORAGE_KEY = 'project_cerberus_state_v6';
export const UI_STATE_KEY = 'project_cerberus_ui_v2';
