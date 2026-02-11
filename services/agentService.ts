import { ChatState, MoodState, StatProfile, Mood, DeepLogicConfig, Message } from '../types';
import { EVENT_DELTAS } from '../constants';

// --- Math & Logic ---

const CLAMP = (val: number) => Math.min(100, Math.max(0, val));

export const calculateDerivedStats = (stats: StatProfile) => {
  const bratFactor = (stats.attention + (100 - stats.agency)) / 2;
  const satisfaction = (stats.resonance + stats.validation + stats.agency + stats.consent) / 4;
  return { bratFactor, satisfaction };
};

export const determineMood = (stats: StatProfile, derived: { bratFactor: number, satisfaction: number }): Mood => {
  // Simple scoring model
  const scores: Record<Mood, number> = {
    Happy: derived.satisfaction * 0.8 + stats.validation * 0.2,
    Sassy: derived.bratFactor * 0.7 + stats.agency * 0.3,
    Steamy: stats.arousal * 0.6 + stats.consent * 0.4,
    Lonely: stats.attention * 0.5 + stats.scarcity * 0.5 - stats.resonance * 0.3,
    Cool: stats.mystery * 0.4 + stats.agency * 0.4 + (100 - stats.arousal) * 0.2
  };

  // Find max score
  let maxScore = -1;
  let winner: Mood = 'Cool';

  (Object.keys(scores) as Mood[]).forEach(m => {
    if (scores[m] > maxScore) {
      maxScore = scores[m];
      winner = m;
    }
  });

  return winner;
};

export const applyEvent = (currentState: MoodState, eventType: keyof typeof EVENT_DELTAS): MoodState => {
  const delta = (EVENT_DELTAS[eventType] || {}) as Partial<StatProfile>;
  const newStats = { ...currentState.stats };

  // Apply deltas
  if (delta.attention) newStats.attention += delta.attention;
  if (delta.arousal) newStats.arousal += delta.arousal;
  if (delta.validation) newStats.validation += delta.validation;
  if (delta.resonance) newStats.resonance += delta.resonance;
  if (delta.agency) newStats.agency += delta.agency;
  
  // Clamp all
  (Object.keys(newStats) as Array<keyof StatProfile>).forEach(k => {
    newStats[k] = CLAMP(newStats[k]);
  });

  const derived = calculateDerivedStats(newStats);
  
  // Inertia Logic
  let newMood = determineMood(newStats, derived);
  const MOOD_COOLDOWN = 60 * 60 * 1000; // 1 hour
  const now = Date.now();
  
  if (newMood !== currentState.currentMood) {
    if (now - currentState.lastShiftTimestamp < MOOD_COOLDOWN) {
        // Cooldown active, keep old mood unless extreme surge (not implemented for simplicity)
        newMood = currentState.currentMood;
    }
  }

  return {
    ...currentState,
    lastShiftTimestamp: newMood !== currentState.currentMood ? now : currentState.lastShiftTimestamp,
    stats: newStats,
    bratFactor: derived.bratFactor,
    satisfaction: derived.satisfaction,
    currentMood: newMood
  };
};

export const decayStats = (currentState: MoodState): MoodState => {
    // Return towards baseline (50 for most, 90 for consent)
    const decayRate = 0.05; // 5% per tick towards baseline
    const newStats = { ...currentState.stats };
    
    const approach = (val: number, target: number) => val + (target - val) * decayRate;

    newStats.attention = approach(newStats.attention, 50);
    newStats.arousal = approach(newStats.arousal, 20); // Baseline low
    newStats.validation = approach(newStats.validation, 50);
    newStats.resonance = approach(newStats.resonance, 50);
    newStats.agency = approach(newStats.agency, 80);
    newStats.mystery = approach(newStats.mystery, 60);
    newStats.scarcity = approach(newStats.scarcity, 50);
    newStats.consent = approach(newStats.consent, 90);

    const derived = calculateDerivedStats(newStats);
    // Mood doesn't shift purely on decay usually, but let's re-eval
    const mood = determineMood(newStats, derived);

    return {
        ...currentState,
        stats: newStats,
        bratFactor: derived.bratFactor,
        satisfaction: derived.satisfaction,
        // Don't shift mood timestamp on decay
        currentMood: mood 
    };
};

// --- Action Simulation ---

export const executePassiveLoop = async (
    state: ChatState, 
    logFn: (entry: string) => void
): Promise<string | null> => {
    
    if (state.deepLogic.killSwitch) {
        logFn("Kill switch active. Passive loop aborted.");
        return null;
    }

    logFn(`[Passive Loop] Mood: ${state.moodState.currentMood}. Simulation: ${state.deepLogic.simulationMode}`);

    // Random chance to act based on mood
    const roll = Math.random();
    let action = null;

    if (state.moodState.currentMood === 'Lonely' && roll > 0.6) {
        action = "CHECK_IN_NTFY";
    } else if (state.moodState.currentMood === 'Sassy' && roll > 0.8) {
        action = "POST_TWITTER";
    }

    if (!action) return null;

    // Execute (Simulated)
    if (state.deepLogic.simulationMode) {
        logFn(`[SIMULATION] Would execute: ${action}`);
        return null;
    }

    // Real Execution Stubs
    if (action === "CHECK_IN_NTFY" && state.deepLogic.channels.ntfy) {
        // fetch(`https://ntfy.sh/${state.deepLogic.secrets.ntfyTopic}`, ...)
        logFn(`[ACTION] Sent NTFY alert.`);
    }

    return action;
};

// --- Sheet Logging Stub ---
// In a real app, this would use Google Sheets API
export const logToSheet = async (
    sheetId: string, 
    tab: string, 
    data: any
) => {
    // console.log(`[SHEETS][${tab}]`, data);
    // Simulating API latency
    await new Promise(r => setTimeout(r, 100));
};