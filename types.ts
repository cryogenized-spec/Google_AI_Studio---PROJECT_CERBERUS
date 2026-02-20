
export type Role = 'user' | 'model' | 'system' | 'assistant';

export interface Message {
    id: string;
    role: Role;
    content: string;
    timestamp: number;
    versions?: string[];
    activeVersionIndex?: number;
    speaker?: string; // For dungeon/multi-character
}

export interface Room {
    id: string;
    name: string;
    description: string;
    backgroundImage: string;
    systemPromptOverride?: string;
}

export interface Theme {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    fontFamily: string;
}

export interface CharacterProgression {
    affinity: number;
    trust: number;
    bondLevel: number;
    badges: string[];
    arcProgress: Record<string, any>;
}

export interface RoleplayConstraints {
    shortBio: string;
    fullBio: string;
    appearanceDescription: string;
    likes: string[];
    dislikes: string[];
    triggers: string[];
    boundaries: string[];
    consentStyle: 'strict' | 'normal' | 'casual';
    romance: { enabled: boolean; pace: 'slow' | 'medium' | 'fast'; preferenceNote?: string };
    writingStyle: 'cinematic' | 'conversational' | 'noir' | 'poetic' | 'direct';
    verbosity: 'low' | 'medium' | 'high';
    knowledgeScope: 'in_world_only' | 'masked_real_world' | 'real_world_allowed';
    
    // New Fields
    realms?: string;
    sentimentalItems?: string;
    relationships?: string; // Multiline string for AI parsing
    dndSheet?: string;
    nsfwInstructions?: string;
}

export interface CapabilityProfile {
    planning: number;
    empathy: number;
    puzzleSolving: number;
    lore: number;
    tactics: number;
    toolDiscipline: number;
    flaws: string[];
}

export interface CharacterRoles {
    taskAgent: boolean;
    narrativeTrustMode: boolean;
}

export interface CharacterProfile {
    id: string;
    isTemplate: boolean;
    templateId?: string;
    baseTemplateId?: string;
    name: string;
    portraitUrl: string;
    tagline?: string;
    theme: Theme;
    progression: CharacterProgression;
    constraints: RoleplayConstraints;
    capabilities: CapabilityProfile;
    roles: CharacterRoles;
    systemPrompt: string; // Legacy/Compiled
    mappingLogic: string;
    createdAt: number;
    lastUsedAt: number;
    archetype?: string; // For templates
    gallery?: {
        defaultPortrait: string;
        backgroundImage: string;
        lifestyleImages: string[];
        clothingImages: string[];
    };
    portraitScale?: number;
    portraitDock?: 'left' | 'right';
    greeting?: string;
    versionNumber?: number;
}

// Intersection type for character sheets/templates
// Omit runtime fields so templates don't need dummy values
export type CharacterSheet = Omit<CharacterProfile, 'isTemplate' | 'progression' | 'createdAt' | 'lastUsedAt'> & {
    isTemplate?: boolean; // Can be implied true for templates
    progression?: CharacterProgression;
    createdAt?: number;
    lastUsedAt?: number;
    connections?: { targetTemplateId: string; stance: RelationStance; note: string }[];
    secrets?: EasterEggArc[];
};

export type RelationStance = 'rival' | 'wary' | 'respect' | 'ally' | 'distrust' | 'protective';

export interface EasterEggArc {
    id: string;
    title: string;
    clues: string[];
    triggers: string[];
    requiredBondLevel: number;
    revealText: string;
    rewardBadge: string;
}

export interface MoodState {
    currentMood: Mood;
    satisfaction: number;
    bratFactor: number;
    stats: StatProfile;
    lastShiftTimestamp: number;
}

export type Mood = 'Happy' | 'Sassy' | 'Steamy' | 'Lonely' | 'Cool';

export interface StatProfile {
    attention: number;
    arousal: number;
    validation: number;
    agency: number;
    mystery: number;
    scarcity: number;
    consent: number;
    resonance: number;
}

export interface MagicInputSettings {
    enabled: boolean;
    outputMode: 'roleplay' | 'verbatim' | 'cleaned';
    enableDndRules: boolean;
    enableTacticalAdvisor: boolean;
    advisorLevel: number;
    targetTokenCount: number;
    tokenMargin: number;
}

export interface ImageGenConfig {
    provider: 'google' | 'openai' | 'xai';
    model: string;
    stylePreset: string;
    aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
    count: number;
    resolution?: 'standard' | 'hd';
    negativePrompt?: string;
    seed?: number;
    guidanceScale?: number;
}

export interface GeneratedImage {
    id: string;
    url: string;
    prompt: string;
    provider: string;
    timestamp: number;
    params: any;
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

export interface WizardStep {
    // Placeholder for wizard step logic if needed
}

export interface AppSettings {
    apiKeyGemini: string;
    apiKeyGrok: string;
    apiKeyOpenAI: string;
    activeProvider: 'gemini' | 'grok';
    modelGemini: string;
    modelGrok: string;
    
    userName: string;
    userDescription: string;
    
    temperature: number;
    topP: number;
    topK: number;
    maxOutputTokens: number;
    tokenTarget: number;
    stopSequences: string;
    presencePenalty: number;
    frequencyPenalty: number;
    safetyLevel: 'strict' | 'standard' | 'off'; // Updated based on usage
    
    bgBrightness: number;
    fastBoot: boolean;
    
    portraitScale: number;
    portraitAspectRatio: '4/5' | '9/16' | '1/1';
    
    aiTextFontUrl: string;
    aiTextColor: string;
    aiTextStyle: 'none' | 'shadow' | 'outline' | 'neon';
    aiTextSize: number;
    userTextFontUrl: string;
    userTextColor: string;
    userTextSize: number;
    
    vttMode: 'browser' | 'openai' | 'gemini';
    vttAutoSend: boolean;
    transcriptionModel: string;
    
    enterToSend: boolean;
    roleplayIntensity: number;
    writingStyle: string;
    formattingStyle: string;
    
    oocAssistEnabled: boolean;
    oocProactivity: number;
    oocStyle: number;
    oocVerboseMode: number;
    oocPersona: 'character' | 'system';
    
    magicInput: MagicInputSettings;
    
    imageModelGoogle: string;
    imageModelOpenAI: string;
    
    githubToken: string;
    githubOwner: string;
    githubRepo: string;
    
    thinkingBudgetPercentage?: number;
    firebaseConfig?: any;
}

export interface Thread {
    id: string;
    title: string;
    type: ThreadType;
    characterId?: string; // For multi-char
    messages: Message[];
    oocMessages?: Message[];
    createdAt?: number;
    updatedAt?: number;
    lastUpdated?: number;
}

export type ThreadType = 'static' | 'ritual' | 'scriptorium' | 'dungeon' | 'report';

export interface ScriptoriumConfig {
    backgroundImage: string;
    systemPrompt: string;
    tools: ScriptoriumTools;
}

export interface ScriptoriumTools {
    gmail: boolean;
    calendar: boolean;
    tasks: boolean;
    docs: boolean;
    keep: boolean;
}

export interface DungeonConfig {
    dmSystemPrompt: string;
    dmColor: string;
    dmFont: string;
    dmTextSize: number;
    backgroundImage: string;
    ysaraithDemeanorLabel: string;
    ysaraithDemeanorInfo: string;
}

export interface RuntimeSettings {
    allowAutomation: boolean;
    inactiveAfterMinutes: number;
    skipScheduledWhenActive: boolean;
    cooldownMinutes: number;
    toleranceMinutes: number;
    doNotDisturb: { startHHMM: string; endHHMM: string };
}

export interface ScheduleSettings {
    timezone: string;
    perTargetOncePerDay: boolean;
    targets: ScheduledEvents[];
}

export interface ScheduledEvents {
    id: string;
    name: string;
    timeHHMM: string;
    enabled: boolean;
    channel: 'inapp' | 'ntfy' | 'both';
}

export interface MemoryPolicy {
    retentionDays: number;
}

export interface ToolSettings {
    ntfy: { topic: string; baseUrl: string; enabledOutbound: boolean };
}

export interface DeepLogicConfig {
    killSwitch: boolean;
    passwordEnabled: boolean;
    activeTimeout: number;
    simulationMode: boolean;
    channels: { ntfy: boolean };
    secrets: { ntfyTopic: string; sheetId: string };
}

export interface Outfit {
    id: string;
    name: string;
    description: string;
    imageUrl: string;
    wornImageUrl?: string;
    origin: string;
}

export interface ChatState {
    moodState: MoodState;
    deepLogic: DeepLogicConfig;
    activeThreadId: string;
    threads: Thread[];
    characters: CharacterProfile[];
    activeCharacterId: string;
    character: CharacterProfile; // Active character object
    lastInteractionTimestamp: number;
    outfits: Outfit[];
    currentOutfitId?: string;
    rooms: Room[];
    activeRoomId?: string;
    settings: AppSettings;
    scheduledEvents: ScheduleSettings;
    
    // UI State flags often persisted
    isScriptoriumOpen: boolean;
    scriptoriumConfig: ScriptoriumConfig;
    isDungeonOpen: boolean;
    dungeonConfig: DungeonConfig;
    isTowerOpen: boolean;
    hasUnreadOOC: boolean;
    
    agentMode: AgentMode;
    traceLogs: TraceLog[];
}

export interface TraceLog {
    id: string;
    timestamp: number;
    entries: TraceLogEntry[];
    inputSnippet: string;
    outputSnippet: string;
}

export interface TraceLogEntry {
    step: string;
    details: string;
    status: 'info' | 'success' | 'warning' | 'error';
}

export type AgentMode = 'chat' | 'task' | 'dungeon' | 'active';

// Organizer Types
export interface OrgTask {
    id: string;
    title: string;
    status: 'open' | 'done';
    priority: number;
    dueAt?: number;
    listId?: string;
    notes?: string;
    parentTaskId?: string;
    createdAt: number;
    updatedAt: number;
}

export interface OrgEvent {
    id: string;
    title: string;
    startAt: number;
    endAt: number;
    allDay: boolean;
    location?: string;
    createdAt: number;
    updatedAt: number;
}

export interface OrgNote {
    id: string;
    type: 'text' | 'checklist';
    title: string;
    body: string;
    pinned: boolean;
    archived: boolean;
    tags: string[];
    checklistItems?: { text: string; done: boolean }[];
    createdAt: number;
    updatedAt: number;
    isChecklist?: boolean;
}

export interface OrgNotebook {
    id: string;
    name: string;
    updatedAt: number;
}

export interface MemoryCard {
    id: string;
    domain: string;
    text: string;
    importance: number;
    confidence: number;
    ttlDays: number;
    status: 'active' | 'archived';
    createdAt: number;
    lastUsedAt: number;
    lastConfirmedAt?: number;
}

export interface ScriptoriumItem {
    id: string;
    type: 'note' | 'task';
    title: string;
    details: string;
    priority: number;
    status: 'open' | 'closed';
    createdAt: number;
    dueAt?: number;
    links?: string[];
}

export type AssistantMode = 'capture' | 'ask' | 'act';

export interface AssistantMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    createdAt: number;
    mode: AssistantMode;
    proposals?: ActionProposal[];
}

export interface ActionProposal {
    id: string;
    type: 'create_task' | 'create_event' | 'create_note' | 'delete_task' | 'delete_event' | 'delete_note' | 'propose_time_slots';
    payload: any;
    risk: 'low' | 'medium' | 'high';
    status: 'pending' | 'approved' | 'rejected' | 'executed' | 'canceled';
    originalInput?: string;
    generatedSlots?: { start: number; end: number; confidence: number }[];
}

export interface PlanningContext {
    workHours: string;
    sleepWindow: string;
    preferences: string;
    privacy: { allowTasks: boolean; allowCalendar: boolean; };
}

export interface DailyPingState {
    date: string;
    executedTargetIds: string[];
    count: number;
}

export interface WakeLog {
    id: string;
    ts: number;
    triggeredBy: string;
    nowLocalHHMM: string;
    matchedTargetId: string | null;
    didPing: boolean;
    skipReason: string | null;
    channelUsed: string | null;
}

export interface QuickElement {
    id: string;
    type: 'mic' | 'today_list' | 'next_event';
}

export interface QuickPreset {
    id: string;
    name: string;
    layout: QuickElement[];
    createdAt: number;
    updatedAt: number;
}

export interface StoredSecret {
    id: string;
    provider: string;
    mode: 'encrypted' | 'plaintext';
    enc?: EncryptedData;
    value?: string; // For plaintext
    createdAt: number;
    updatedAt: number;
}

export interface EncryptedData {
    salt: string;
    iv: string;
    ciphertext: string;
    kdf: string;
    iterations: number;
    alg: string;
}
