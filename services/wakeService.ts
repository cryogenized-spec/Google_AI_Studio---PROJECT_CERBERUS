import { Message, AppSettings, ChatState, RuntimeSettings, ScheduleSettings, ToolSettings } from '../types';
import { 
    fetchSettings, 
    fetchUserTimestamps, 
    recordWakeLog, 
    updateWakeTimestamps, 
    initializeFirebase, 
    getDailyPingState,
    updateDailyPingState,
    fetchActiveMemories,
    fetchOpenScriptoriumItems
} from './firebaseService';
import { streamGeminiResponse } from './geminiService';
import { v4 as uuidv4 } from 'uuid';

// Helper: Convert time string HH:MM to minutes from midnight
const getMinutesFromHHMM = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

// Helper: Get current time in target timezone
const getNowInTimezone = (timezone: string): Date => {
    return new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
};

export const runWakeCycleLogic = async (
    settings: AppSettings, 
    chatState: ChatState, 
    addSystemMessage: (msg: Message) => void
) => {
    const now = Date.now();

    // 0. Ensure Firebase
    const uid = await initializeFirebase(settings);
    if (!uid) return;

    // 1. Load All Configurations (The Truth Source)
    const runtime: RuntimeSettings = await fetchSettings('runtime');
    const schedule: ScheduleSettings = await fetchSettings('schedule');
    const tools: ToolSettings = await fetchSettings('tools');
    const userTimestamps = await fetchUserTimestamps();

    // Current Time Calculation
    const nowLocal = getNowInTimezone(schedule.timezone);
    const nowMinutes = nowLocal.getHours() * 60 + nowLocal.getMinutes();
    const nowHHMM = `${String(nowLocal.getHours()).padStart(2, '0')}:${String(nowLocal.getMinutes()).padStart(2, '0')}`;
    const todayStr = nowLocal.toISOString().split('T')[0]; // YYYY-MM-DD

    // --- GATEKEEPERS ---

    // Gate 1: Master Switch
    if (!runtime.allowAutomation) {
        await recordWakeLog({ 
            ts: now, triggeredBy: 'scheduler', nowLocalHHMM: nowHHMM, 
            matchedTargetId: null, didPing: false, skipReason: "Master Switch Off", channelUsed: null 
        });
        return;
    }

    // Gate 2: DND
    const dndStart = getMinutesFromHHMM(runtime.doNotDisturb.startHHMM);
    const dndEnd = getMinutesFromHHMM(runtime.doNotDisturb.endHHMM);
    let isDND = false;
    if (dndStart > dndEnd) { 
        isDND = nowMinutes >= dndStart || nowMinutes <= dndEnd;
    } else {
        isDND = nowMinutes >= dndStart && nowMinutes <= dndEnd;
    }

    if (isDND) {
        await recordWakeLog({ 
            ts: now, triggeredBy: 'scheduler', nowLocalHHMM: nowHHMM, 
            matchedTargetId: null, didPing: false, skipReason: "DND Active", channelUsed: null 
        });
        return;
    }

    // Gate 3: Active Presence
    if (userTimestamps) {
        const minsSinceInteraction = (now - userTimestamps.lastInteractionAt) / 60000;
        if (minsSinceInteraction < runtime.inactiveAfterMinutes && runtime.skipScheduledWhenActive) {
            await recordWakeLog({ 
                ts: now, triggeredBy: 'scheduler', nowLocalHHMM: nowHHMM, 
                matchedTargetId: null, didPing: false, skipReason: "User Active", channelUsed: null 
            });
            return;
        }
    }

    // Gate 4: Cooldown
    if (userTimestamps) {
        const minsSincePing = (now - userTimestamps.lastPingAt) / 60000;
        if (minsSincePing < runtime.cooldownMinutes) {
            await recordWakeLog({ 
                ts: now, triggeredBy: 'scheduler', nowLocalHHMM: nowHHMM, 
                matchedTargetId: null, didPing: false, skipReason: "Cooldown Active", channelUsed: null 
            });
            return;
        }
    }

    // --- SLOT ROUTING ---

    let matchedTarget = null;
    let minDiff = Infinity;

    schedule.targets.forEach(target => {
        if (!target.enabled) return;
        const targetMins = getMinutesFromHHMM(target.timeHHMM);
        
        // Handle midnight crossing logic for difference if needed, but simple abs diff usually sufficient for +/- 7 mins
        const diff = Math.abs(nowMinutes - targetMins);
        
        if (diff <= runtime.toleranceMinutes) {
            if (diff < minDiff) {
                minDiff = diff;
                matchedTarget = target;
            }
        }
    });

    if (!matchedTarget) {
        await updateWakeTimestamps({ lastWakeAt: now }); // Still mark wake to avoid rapid checks if we implement dynamic intervals later
        return; // Silent exit if no slot matches
    }

    // --- DAILY GUARD CHECK ---
    if (schedule.perTargetOncePerDay) {
        const dailyState = await getDailyPingState(todayStr);
        if (dailyState.executedTargetIds.includes(matchedTarget.id)) {
            await recordWakeLog({ 
                ts: now, triggeredBy: 'scheduler', nowLocalHHMM: nowHHMM, 
                matchedTargetId: matchedTarget.id, didPing: false, skipReason: "Already Executed Today", channelUsed: null 
            });
            return;
        }
    }

    // --- EXECUTION ---

    // 1. Gather Context
    const recentMessages = chatState.threads.find((t: any) => t.id === chatState.activeThreadId)?.messages.slice(-10) || [];
    const openItems = await fetchOpenScriptoriumItems();
    const activeMemories = await fetchActiveMemories();
    const highPriorityItems = openItems.filter(i => i.priority >= 4);

    // 2. Generate Content
    const promptContext = `
[SYSTEM WAKE EVENT]
Window: ${matchedTarget.name.toUpperCase()} (${nowHHMM})
Day: ${nowLocal.toLocaleDateString('en-US', { weekday: 'long' })}

Urgent Tasks:
${highPriorityItems.map(i => `- [URGENT] ${i.title}`).join('\n')}

Memories:
${activeMemories.slice(0, 3).map(m => `- ${m.text}`).join('\n')}

Recent Chat Context:
${recentMessages.slice(-3).map((m: Message) => `${m.role}: ${m.content.substring(0, 50)}...`).join('\n')}

**DIRECTIVE:**
Write a concise, single notification message.
- If ${matchedTarget.id} == 'goodnight', be calming, summarize briefly, no questions.
- If ${matchedTarget.id} == 'breakfast', offer a brief headline or thought.
- If urgent tasks exist, prioritize them.
- Format: 1-3 short bullet points max + 1 closing sentence. 
- Tone: ${chatState.moodState.currentMood} / ${chatState.character.name}.
`;

    const dummyMsgs: Message[] = [
        { id: 'sys', role: 'user', content: promptContext, versions: [], activeVersionIndex: 0, timestamp: Date.now() }
    ];

    let generatedContent = "";
    try {
        await streamGeminiResponse(
            dummyMsgs,
            { id: 'void', name: 'Void', description: 'System Context', backgroundImage: '' }, 
            settings,
            chatState.character,
            chatState.moodState,
            (chunk) => { generatedContent += chunk; }
        );
    } catch (e) {
        console.error("Wake Generation Failed", e);
        return;
    }

    // 3. Persist & Notify
    const newMsgId = uuidv4();
    const systemMsg: Message = {
        id: newMsgId,
        role: 'model',
        content: generatedContent,
        versions: [generatedContent],
        activeVersionIndex: 0,
        timestamp: Date.now()
    };

    // Add to chat if configured
    if (matchedTarget.channel === 'inapp' || matchedTarget.channel === 'both') {
        addSystemMessage(systemMsg);
    }

    // Send NTFY if configured
    if ((matchedTarget.channel === 'ntfy' || matchedTarget.channel === 'both') && tools.ntfy.enabledOutbound) {
        try {
            await fetch(`${tools.ntfy.baseUrl}/${tools.ntfy.topic}`, {
                method: 'POST',
                body: generatedContent,
                headers: { 'Title': `Ysaraith: ${matchedTarget.name}` }
            });
        } catch (e) {
            console.error("NTFY Push Failed", e);
        }
    }

    // 4. Update State
    await updateWakeTimestamps({ lastPingAt: now, lastWakeAt: now });
    await updateDailyPingState(todayStr, matchedTarget.id);
    
    // 5. Log Success
    await recordWakeLog({ 
        ts: now, 
        triggeredBy: 'scheduler', 
        nowLocalHHMM: nowHHMM, 
        matchedTargetId: matchedTarget.id, 
        didPing: true, 
        skipReason: null, 
        channelUsed: matchedTarget.channel 
    });
};