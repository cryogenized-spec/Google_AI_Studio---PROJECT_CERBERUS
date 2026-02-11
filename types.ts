export type Role = 'user' | 'model';

export interface Message {
  id: string;
  role: Role;
  content: string;
  versions: string[];
  activeVersionIndex: number;
  timestamp: number;
}

export type ThreadType = 'ritual' | 'static' | 'scriptorium';

export interface Thread {
  id: string;
  type: ThreadType;
  title: string;
  messages: Message[];
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

export interface CharacterProfile {
  name: string;
  systemPrompt: string;
  portraitUrl: string;
}

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

// --- V1 OPS CONSOLE DATA MODEL ---

export interface RuntimeSettings {
    inactiveAfterMinutes: number;
    cooldownMinutes: number;
    toleranceMinutes: number;
    doNotDisturb: {
        startHHMM: string;
        endHHMM: string;
    };
    maxPingsPerDay: number;
    allowAutomation: boolean;
    skipScheduledWhenActive: boolean;
}

export interface ScheduleTarget {
    id: string;
    name: string; // Display name
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
        baseUrl: string; // default 'https://ntfy.sh'
    };
    webSearchEnabled: boolean;
    maxWebSearchPerWake: number;
}

export interface DeepLogicConfig {
    passwordEnabled: boolean;
    killSwitch: boolean; // Mapped to RuntimeSettings.allowAutomation (inverse)
    simulationMode: boolean; // Not persisted in Firestore runtime settings, local override usually
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

// Legacy wrapper for AppSettings to maintain compatibility
export interface AppSettings {
  apiKeyGemini: string;
  apiKeyGrok: string;
  activeProvider: 'gemini' | 'grok';
  modelGemini: string;
  modelGrok: string;
  portraitScale: number;
  portraitAspectRatio: '4/5' | '9/16' | '1/1';
  userName: string;
  userDescription: string;
  temperature: number;
  maxOutputTokens: number;
  tokenTarget: number;
  enterToSend: boolean;
  topP: number;
  presencePenalty: number;
  frequencyPenalty: number;
  thinkingBudgetPercentage: number;
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  firebaseConfig?: FirebaseConfig;
  tokenizerBehaviour?: 'default';
  
  // New Appearance - Entity
  bgBrightness: number; // 0-100
  aiTextFontUrl: string; // Google Fonts URL
  aiTextColor: string; // Hex
  aiTextStyle: 'none' | 'shadow' | 'outline' | 'neon';
  aiTextSize: number; // px

  // New Appearance - User
  userTextFontUrl: string;
  userTextColor: string;
  userTextSize: number;
}

export interface ScheduledEvents {
  lastWakeUp: string;
  lastMorningGreet: string;
  lastEveningPrep: string;
}

export interface ChatState {
  threads: Thread[];
  activeThreadId: string | null;
  rooms: Room[];
  activeRoomId: string;
  settings: AppSettings;
  character: CharacterProfile;
  outfits: Outfit[];
  currentOutfitId: string;
  agentMode: AgentMode;
  lastInteractionTimestamp: number;
  moodState: MoodState;
  deepLogic: DeepLogicConfig; // Legacy holder, real config in Firestore
  scheduledEvents: ScheduledEvents; // Legacy
  isScriptoriumOpen: boolean;
  scriptoriumConfig: ScriptoriumConfig;
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
    } | null;
}