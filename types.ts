
export type Role = 'user' | 'model';

export interface Message {
  id: string;
  role: Role;
  content: string;
  versions: string[];
  activeVersionIndex: number;
  timestamp: number;
  speaker?: 'Ysaraith' | 'DM' | 'User'; 
}

export type ThreadType = 'ritual' | 'static' | 'scriptorium' | 'dungeon';

export interface Thread {
  id: string;
  characterId?: string; // New: Links thread to a specific character
  type: ThreadType;
  title: string;
  messages: Message[];
  oocMessages?: Message[];
  lastUpdated: number;
}

export interface Outfit {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  wornImageUrl?: string;
  origin: string;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  backgroundImage: string;
  systemPromptOverride?: string;
}

// --- NEW CHARACTER SYSTEM TYPES ---

export interface CharacterTheme {
    primaryColor: string; // e.g. #9b2c2c (Cerberus Red)
    accentColor: string;  // e.g. #d4af37 (Gold)
    backgroundColor: string; // e.g. #0d1117 (Void)
    fontFamily: string;   // e.g. 'Cinzel', serif
    backgroundImageUrl?: string; // Optional global background for this char
}

export interface CharacterSheet {
    overview: string;
    personality: string[];
    speakingStyle: string[];
    boundaries: string[];
    preferences?: string[];
}

export interface CharacterProfile {
  id: string;           // UUID for user chars, string ID for templates
  baseTemplateId?: string; // If copied from template
  versionNumber: number; // v1, v2...
  isTemplate: boolean;
  name: string;
  tagline: string;
  systemPrompt: string; // Core Prompt
  mappingLogic: string;
  portraitUrl: string;
  sheet: CharacterSheet;
  theme: CharacterTheme;
  createdAt: number;
  lastUsedAt: number;
}

// ----------------------------------

export type AgentMode = 'active' | 'passive';
export type Mood = 'Happy' | 'Sassy' | 'Steamy' | 'Lonely' | 'Cool';

export interface StatProfile {
  attention: number;
  arousal: number;
  validation: number;
  resonance: number;
  agency: number;
  mystery: number;
  scarcity: number;
  consent: number;
}

export interface MoodState {
  currentMood: Mood;
  lastShiftTimestamp: number;
  stats: StatProfile;
  bratFactor: number;
  satisfaction: number;
}

// --- ORGANIZER CORE TYPES ---

export type OrgPriority = 0 | 1 | 2 | 3; // 0=None, 1=Low, 2=Med, 3=High
export type OrgStatus = 'open' | 'done' | 'snoozed';

export interface OrgTask {
    id: string; // uuid
    title: string;
    notes?: string;
    status: OrgStatus;
    dueAt?: number; // timestamp
    priority: OrgPriority;
    listId?: string; // e.g. "personal", "work"
    parentTaskId?: string;
    sortOrder?: number;
    tags?: string[];
    createdAt: number;
    updatedAt: number;
    completedAt?: number;
}

export interface OrgEvent {
    id: string;
    title: string;
    description?: string;
    startAt: number;
    endAt: number;
    allDay: boolean;
    location?: string;
    tags?: string[];
    createdAt: number;
    updatedAt: number;
}

export interface OrgNote {
    id: string;
    title?: string;
    body: string;
    pinned: boolean;
    isChecklist: boolean;
    tags?: string[];
    createdAt: number;
    updatedAt: number;
}

export interface OrgList {
    id: string;
    name: string;
    sortOrder: number;
    createdAt: number;
}

export interface OrgTag {
    id: string;
    name: string;
    color?: string;
    createdAt: number;
}

// --- QUICK PANEL TYPES ---

export type QuickElementType = 'mic' | 'today_list' | 'next_event' | 'calendar_jump';

export interface QuickElement {
    id: string;
    type: QuickElementType;
    size: 'small' | 'medium' | 'large'; // Unused in v1, prepared for future grid
    config?: any;
}

export interface QuickPreset {
    id: string;
    name: string;
    layout: QuickElement[];
    createdAt: number;
    updatedAt: number;
}

// --- SYNC & ARCHIVE TYPES ---

export interface OutboxEvent {
    id: string;
    table: string;
    action: 'create' | 'update' | 'delete';
    data: any;
    timestamp: number;
    synced: boolean;
}

export interface ArchivedItem {
    id: string;
    originalTable: string;
    data: any;
    archivedAt: number;
}

// --- SECURE STORAGE TYPES ---

export interface EncryptedData {
    salt: string; // Base64
    iv: string;   // Base64
    ciphertext: string; // Base64
    kdf: 'PBKDF2';
    iterations: number;
    alg: 'AES-GCM';
}

export interface StoredSecret {
    id: string; // e.g. 'gemini', 'openai'
    provider: string; // 'google', 'openai', 'xai'
    mode: 'session' | 'encrypted';
    enc?: EncryptedData; // Only present if mode is encrypted
    createdAt: number;
    updatedAt: number;
}

// --- ASSISTANT & ACTION TYPES ---

export type AssistantMode = 'capture' | 'ask' | 'act';

export interface ActionProposal {
    id: string;
    type: 'create_task' | 'update_task' | 'delete_task' | 'create_event' | 'update_event' | 'delete_event' | 'create_note' | 'update_note' | 'delete_note' | 'propose_time_slots';
    payload: any; // Dynamic based on type
    risk: 'low' | 'medium' | 'high';
    status: 'pending' | 'approved' | 'executed' | 'canceled';
    originalInput?: string;
    generatedSlots?: { start: number; end: number; confidence: number }[]; // For slot proposals
}

export interface AssistantMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    text: string;
    createdAt: number;
    mode: AssistantMode;
    proposals?: ActionProposal[];
    rawTranscript?: string; // For STT debugging
    metadata?: any;
}

export interface PlanningContext {
    id: string; // Singleton 'default'
    workHours: string; // "09:00-17:00"
    sleepWindow: string; // "23:00-07:00"
    preferences: string; // Freeform text
    privacy: {
        allowCalendar: boolean;
        allowTasks: boolean;
        allowNotes: boolean;
    };
    updatedAt: number;
}

// --- LEGACY SCRIPTORIUM TYPES (Kept for compatibility during migration) ---

export interface ScriptoriumTools {
    gmail: boolean;
    calendar: boolean;
    tasks: boolean;
    docs: boolean;
    keep: boolean;
}

export interface ScriptoriumConfig {
    backgroundImage: string;
    systemPrompt: string;
    tools: ScriptoriumTools;
}

export interface ScriptoriumItem {
  id: string;
  type: 'calendar_draft' | 'note' | 'wishlist' | 'research' | 'followup';
  title: string;
  details: string;
  priority: number;
  status: 'open' | 'done' | 'snoozed';
  dueAt?: number;
  createdAt: number;
  links?: string[];
}

// --- DUNGEON & IMAGE TYPES (UNCHANGED) ---

export interface DungeonConfig {
    backgroundImage: string;
    dmSystemPrompt: string;
    dmFont: string;
    dmColor: string;
    dmTextSize: number;
    ysaraithDemeanorLabel: string; 
    ysaraithDemeanorInfo: string; 
}

export interface GeneratedImage {
    id: string;
    url: string; 
    prompt: string;
    provider: 'google' | 'openai' | 'xai';
    timestamp: number;
    params: { aspectRatio: string; style: string; }
}

export interface ImageGenConfig {
    provider: 'google' | 'openai' | 'xai';
    model: string;
    aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
    count: number; 
    stylePreset: string; 
    negativePrompt?: string;
    resolution?: 'standard' | 'hd';
    seed?: number; 
    steps?: number;
    guidanceScale?: number; 
}

export interface WizardStep {
    question: string;
    options: string[];
    isFinal?: boolean;
}

export interface ImageIntentSpec {
    subject?: string;
    appearance?: string;
    pose?: string;
    setting?: string;
    mood?: string;
    style?: string;
    framing?: string;
    constraints?: string;
}

export interface RuntimeSettings {
    inactiveAfterMinutes: number;
    cooldownMinutes: number;
    toleranceMinutes: number;
    doNotDisturb: { startHHMM: string; endHHMM: string; };
    maxPingsPerDay: number;
    allowAutomation: boolean;
    skipScheduledWhenActive: boolean;
}

export interface ScheduleTarget {
    id: string;
    name: string; 
    enabled: boolean;
    timeHHMM: string;
    channel: 'inapp' | 'ntfy' | 'both';
    allowNews?: boolean;
}

export interface ScheduleSettings {
    targets: ScheduleTarget[];
    windowToleranceMinutes: number;
    perTargetOncePerDay: boolean;
    timezone: string;
}

export interface MemoryPolicy {
    maxActiveMemories: number;
    roleplayTTLdays: number;
    utilityTTLdays: number;
    maxContextMessages: number;
    maxMemoriesInContext: number;
    allowAutoMemoryCreation: boolean;
}

export interface ToolSettings {
    ntfy: {
        enabledOutbound: boolean;
        enabledInbound: boolean;
        topic: string;
        baseUrl: string; 
    };
    webSearchEnabled: boolean;
    maxWebSearchPerWake: number;
}

export interface DeepLogicConfig {
    passwordEnabled: boolean;
    killSwitch: boolean; 
    simulationMode: boolean; 
    activeTimeout: number;
    channels: {
        ntfy: boolean;
        telegram: boolean;
        gmail: boolean;
        twitter: boolean;
        moltbook: boolean;
    };
    secrets: {
        sheetId: string;
        ntfyTopic: string;
        telegramToken: string;
        telegramChatId: string;
    };
}

export interface WakeLog {
    id: string;
    ts: number;
    triggeredBy: 'scheduler' | 'ntfy_inbound' | 'manual';
    nowLocalHHMM: string;
    matchedTargetId: string | null;
    didPing: boolean;
    skipReason: string | null;
    channelUsed: 'inapp' | 'ntfy' | 'both' | null;
}

export interface DailyPingState {
    date: string; // YYYY-MM-DD
    executedTargetIds: string[];
    count: number;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface ArchiveSettings {
    retentionMonths: number; // 0 = Forever
    autoArchive: boolean;
}

export interface AppSettings {
  // KEYS - RUNTIME ONLY (Do not persist to localStorage)
  apiKeyGemini: string;
  apiKeyGrok: string;
  apiKeyOpenAI: string; 
  
  activeProvider: 'gemini' | 'grok';
  modelGemini: string;
  modelGrok: string;
  imageModelGoogle: string;
  imageModelOpenAI: string;
  
  transcriptionModel: 'gpt-4o-mini-transcribe' | 'gpt-4o-transcribe';
  vttMode: 'browser' | 'openai' | 'gemini'; 
  vttAutoSend: boolean;
  oocAssistEnabled: boolean;
  oocProactivity: number; 
  oocStyle: number; 
  oocVerboseMode: number; 
  oocPersona: 'character' | 'system'; 
  portraitScale: number;
  portraitAspectRatio: '4/5' | '9/16' | '1/1';
  userName: string;
  userDescription: string;
  temperature: number;
  maxOutputTokens: number;
  tokenTarget: number;
  topP: number;
  topK: number; 
  presencePenalty: number;
  frequencyPenalty: number;
  stopSequences: string; 
  roleplayIntensity: number; 
  writingStyle: 'plain' | 'balanced' | 'ornate';
  formattingStyle: 'paragraphs' | 'bubbles' | 'screenplay' | 'markdown';
  safetyLevel: 'strict' | 'standard' | 'off';
  thinkingBudgetPercentage: number; 
  enterToSend: boolean;
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  tokenizerBehaviour: 'default';
  bgBrightness: number; 
  aiTextFontUrl: string; 
  aiTextColor: string; 
  aiTextStyle: 'none' | 'shadow' | 'outline' | 'neon';
  aiTextSize: number; 
  userTextFontUrl: string;
  userTextColor: string;
  userTextSize: number;
  fastBoot: boolean;
  firebaseConfig?: FirebaseConfig;
  
  // New Project 3 settings
  notificationEnabled: boolean;
  archiveSettings: ArchiveSettings;
}

export interface ScheduledEvents {
  lastWakeUp: string;
  lastMorningGreet: string;
  lastEveningPrep: string;
}

export interface ChatState {
  threads: Thread[];
  activeThreadId: string | null;
  
  // Character System
  characters: CharacterProfile[]; // List of user's customized characters
  activeCharacterId: string; // The ID of the currently selected character
  
  // Legacy / Active Refs
  rooms: Room[];
  activeRoomId: string;
  settings: AppSettings;
  
  // Note: 'character' field below is deprecated in favor of finding the char in `characters` via `activeCharacterId`
  // but kept for transition safety if needed, though we will try to rely on characters array.
  character: CharacterProfile; 
  
  outfits: Outfit[];
  currentOutfitId: string;
  agentMode: AgentMode;
  lastInteractionTimestamp: number;
  moodState: MoodState;
  deepLogic: DeepLogicConfig; 
  scheduledEvents: ScheduledEvents; 
  isScriptoriumOpen: boolean;
  scriptoriumConfig: ScriptoriumConfig;
  isDungeonOpen: boolean;
  dungeonConfig: DungeonConfig;
  hasUnreadOOC: boolean;
  isTowerOpen: boolean;
  imageGenConfig?: ImageGenConfig;
  generatedImages?: GeneratedImage[];
}

export interface MemoryCard {
  id: string;
  domain: 'roleplay' | 'utility' | 'preference';
  text: string;
  importance: number;
  confidence: number;
  ttlDays: number | null;
  status: 'active' | 'superseded' | 'retracted';
  createdAt: number;
  lastUsedAt: number;
  lastConfirmedAt?: number;
}

export interface ProfileSlot {
    id: number;
    name: string;
    timestamp: number;
    data: {
        settings: AppSettings;
        character: CharacterProfile;
        rooms: Room[];
        deepLogic: DeepLogicConfig;
        scriptoriumConfig: ScriptoriumConfig;
        dungeonConfig?: DungeonConfig;
    } | null;
}
