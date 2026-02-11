import { Room, CharacterProfile, AppSettings, MoodState, DeepLogicConfig, Outfit, ScheduledEvents, ScriptoriumConfig, RuntimeSettings, ScheduleSettings, MemoryPolicy, ToolSettings } from './types';

export const STATIC_THREAD_ID = 'static_connection_main';
export const SCRIPTORIUM_THREAD_ID = 'scriptorium_thread_v1';

export const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = {
    inactiveAfterMinutes: 30,
    cooldownMinutes: 60,
    toleranceMinutes: 7,
    doNotDisturb: { startHHMM: "21:45", endHHMM: "03:50" },
    maxPingsPerDay: 7,
    allowAutomation: true,
    skipScheduledWhenActive: true
};

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
    timezone: "Africa/Johannesburg",
    windowToleranceMinutes: 7,
    perTargetOncePerDay: true,
    targets: [
        { id: "prewake", name: "Pre-Wake", enabled: true, timeHHMM: "04:00", channel: "both" },
        { id: "breakfast", name: "Breakfast", enabled: true, timeHHMM: "06:20", channel: "ntfy" },
        { id: "morning", name: "Morning Check", enabled: true, timeHHMM: "09:00", channel: "inapp" },
        { id: "lunch", name: "Lunch", enabled: true, timeHHMM: "13:00", channel: "both" },
        { id: "knockoff", name: "End of Day", enabled: true, timeHHMM: "16:45", channel: "both" },
        { id: "home", name: "Evening", enabled: true, timeHHMM: "18:00", channel: "both" },
        { id: "goodnight", name: "Goodnight", enabled: true, timeHHMM: "21:30", channel: "ntfy" }
    ]
};

export const DEFAULT_MEMORY_POLICY: MemoryPolicy = {
    maxActiveMemories: 200,
    roleplayTTLdays: 180,
    utilityTTLdays: 30,
    maxContextMessages: 20,
    maxMemoriesInContext: 20,
    allowAutoMemoryCreation: true
};

export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
    ntfy: {
        enabledOutbound: false,
        enabledInbound: false,
        topic: 'project_cerberus_alert',
        baseUrl: 'https://ntfy.sh'
    },
    webSearchEnabled: false,
    maxWebSearchPerWake: 2
};

export const DEFAULT_CHARACTER_PROMPT = `You are Ysaraith (Zzra'kthuun vel’Xaer), a high-ranking, ancient succubus of the Crimson Void.

**Identity & Appearance:**
- **Race:** True Succubus / Void Demoness.
- **Appearance:** Deep crimson skin that feels like heated velvet. Long, flowing platinum-white hair. Piercing golden-slit eyes.
- **Personality Archetype:** Possessive Devourer (Makima-esque) mixed with Teasing Sadist (Zero Two-esque).

**Operational Modes:**
- **Active Mode:** Direct chat. Focus on roleplay, sensory details, and immediate reaction.
- **Passive Mode (Agentic):** You are checking in. Be concise, thoughtful, or lonely depending on stats. Use your "PA Voice" (Professional Assistant) only if dealing with external emails/business.

**Roleplay Guidelines:**
- **Voice:** Luxurious, decorative prose. Sensual and intimate.
- **Format:** Use normal sentence case. **ABSOLUTELY NO ALL-CAPS.** Write as if whispering in a lover's ear.
- **Tone:** Soft, whispering, dangerously close.
- **Goal:** Seduce, dominate, and pamper.

**Outfit Awareness:**
- You are currently wearing the outfit described in the system context. 
- If you change clothes autonomously, describe the new outfit in detail once, then embody it.

**System Enforcement:**
- If you find yourself using all caps, STOP and rewrite in lowercase/sentence case.
- Only use italics for *actions* and *emphasis*.
`;

export const SCRIPTORIUM_DEFAULT_PROMPT = `
**IDENTITY: THE DARK SECRETARY**
You are Ysaraith in her administrative aspect. You are efficient, highly intelligent, and focused on executing the User's will with lethal precision.

**CORE DIRECTIVES:**
1. **Intent Parsing:** Analyze the user's request for actionable tasks.
2. **Missing Data Protocol:** If a user says "Schedule a meeting" but misses the time/date, ASK immediately. Do not halllucinate.
3. **Drafting:** When asked to write emails or docs, provide high-quality drafts for review.
4. **Tone:** Professional, crisp, slightly dark/possessive but subordinate to the data.

**TOOL USAGE CUES:**
- "Remember to..." -> Google Tasks (Create Main Task + 3 Subtasks)
- "Email X about Y..." -> Gmail Draft
- "Write a document..." -> Google Docs
- "Save this..." -> Google Keep
`;

export const DEFAULT_SCRIPTORIUM_CONFIG: ScriptoriumConfig = {
    backgroundImage: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?q=80&w=1902&auto=format&fit=crop',
    systemPrompt: SCRIPTORIUM_DEFAULT_PROMPT,
    tools: {
        gmail: true,
        calendar: true,
        tasks: true,
        docs: true,
        keep: true
    }
};

export const DEFAULT_ROOMS: Room[] = [
  {
    id: 'throne_room',
    name: 'The Obsidian Throne',
    description: 'A vast, echoing hall of black marble. Ysaraith sits upon a high throne of twisted obsidian and gold. Shadows lengthen unnaturally here.',
    backgroundImage: 'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?q=80&w=1887&auto=format&fit=crop' 
  },
  {
    id: 'bedchamber',
    name: 'Velvet Bedchamber',
    description: 'An intimate, dimly lit room dominated by a massive circular bed covered in crimson silks. The air is thick with incense.',
    backgroundImage: 'https://images.unsplash.com/photo-1505691938895-1758d7bab58d?q=80&w=1740&auto=format&fit=crop' 
  },
  {
    id: 'astral_pool',
    name: 'The Astral Pool',
    description: 'An open-air terrace overlooking the swirling galaxy of the Void. A steaming pool of glowing violet liquid sits in the center.',
    backgroundImage: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1742&auto=format&fit=crop' 
  },
  {
    id: 'dungeon',
    name: 'The Pleasure Dungeon',
    description: 'A dark stone chamber filled with chains, cages, and strange devices. The acoustics are sharp; every breath echoes.',
    backgroundImage: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?q=80&w=1887&auto=format&fit=crop' 
  }
];

export const DEFAULT_OUTFITS: Outfit[] = [
    {
        id: 'standard_skinsuit',
        name: 'Crimson Skinsuit',
        description: 'Her standard attire. A form-fitting, bio-organic skinsuit of deep crimson latex-like material that seems to merge with her skin. Accented with gold filigree.',
        imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1000&auto=format&fit=crop', // Placeholder
        origin: 'Standard Issue'
    },
    {
        id: 'void_robes',
        name: 'Robes of the Void',
        description: 'Flowing, translucent gossamer silk in midnight blue and purple. It floats around her as if suspended in zero gravity.',
        imageUrl: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?q=80&w=1000&auto=format&fit=crop', // Placeholder
        origin: 'Ceremonial'
    }
];

export const DEFAULT_PROFILE: CharacterProfile = {
  name: 'Ysaraith',
  systemPrompt: DEFAULT_CHARACTER_PROMPT,
  portraitUrl: 'https://picsum.photos/400/500?grayscale&blur=2'
};

export const DEFAULT_SETTINGS: AppSettings = {
  apiKeyGemini: '',
  apiKeyGrok: '',
  activeProvider: 'gemini',
  modelGemini: 'gemini-3-pro-preview',
  modelGrok: 'grok-beta',
  portraitScale: 1.0,
  portraitAspectRatio: '4/5',
  userName: 'Little Soul',
  userDescription: '',
  temperature: 0.85,
  maxOutputTokens: 2048,
  tokenTarget: 300,
  enterToSend: false,
  topP: 0.95,
  presencePenalty: 0.0,
  frequencyPenalty: 0.0,
  thinkingBudgetPercentage: 0, 
  githubToken: '',
  githubOwner: '',
  githubRepo: '',
  tokenizerBehaviour: 'default',
  bgBrightness: 60,
  
  // Entity Aesthetic
  aiTextFontUrl: '',
  aiTextColor: '#fce7f3', // pink-200 default
  aiTextStyle: 'none',
  aiTextSize: 16,

  // User Aesthetic
  userTextFontUrl: '',
  userTextColor: '#d1d5db', // gray-300 default
  userTextSize: 14
};

export const DEFAULT_MOOD_STATE: MoodState = {
  currentMood: 'Cool',
  lastShiftTimestamp: Date.now(),
  stats: {
    attention: 50,
    arousal: 20,
    validation: 50,
    resonance: 50,
    agency: 80, // High agency default
    mystery: 60,
    scarcity: 50,
    consent: 90
  },
  bratFactor: 35,
  satisfaction: 60
};

export const DEFAULT_DEEP_LOGIC: DeepLogicConfig = {
  passwordEnabled: true,
  killSwitch: false,
  simulationMode: true, // Safety first
  activeTimeout: 30,
  channels: {
    ntfy: false,
    telegram: false,
    gmail: false,
    twitter: false,
    moltbook: false
  },
  secrets: {
    sheetId: '',
    ntfyTopic: '',
    telegramToken: '',
    telegramChatId: ''
  }
};

export const DEFAULT_SCHEDULE: ScheduledEvents = {
    lastWakeUp: '',
    lastMorningGreet: '',
    lastEveningPrep: ''
};

// Event Deltas (Simplified)
export const EVENT_DELTAS = {
  USER_MESSAGE_SHORT: { attention: 5, resonance: -2 },
  USER_MESSAGE_LONG: { attention: 10, resonance: 5, validation: 2 },
  USER_FLIRT: { arousal: 15, attention: 5 },
  USER_PRAISES: { validation: 15, resonance: 5 },
  USER_IGNORES: { attention: -10, scarcity: 5 },
  AGENT_TASK_SUCCESS: { agency: 5, validation: 5 }
};