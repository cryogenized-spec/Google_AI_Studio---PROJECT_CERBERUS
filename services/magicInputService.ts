
import { GoogleGenAI, Type } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { 
    AppSettings, CharacterProfile, MagicInputSettings, 
    TraceLog, TraceLogEntry, Thread 
} from '../types';

// --- RNG Utilities ---

const rollDie = (sides: number): number => {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return (array[0] % sides) + 1;
};

// --- Trace Logging Helpers ---

const createTraceLog = (input: string): TraceLog => ({
    id: uuidv4(),
    timestamp: Date.now(),
    entries: [],
    inputSnippet: input.substring(0, 50) + (input.length > 50 ? '...' : ''),
    outputSnippet: ''
});

const logStep = (log: TraceLog, step: string, details: string, status: TraceLogEntry['status'] = 'info') => {
    log.entries.push({ step, details, status });
};

// --- Pipeline ---

interface PipelineResult {
    finalText: string;
    traceLog: TraceLog;
    advisorNote?: string;
}

export const runMagicPipeline = async (
    rawInput: string,
    settings: AppSettings,
    character: CharacterProfile,
    activeThread?: Thread,
    modeOverride?: string,
    refereeCheck?: boolean // New flag for Audit mode
): Promise<PipelineResult> => {
    const magicSettings = settings.magicInput;
    const log = createTraceLog(rawInput);
    const mode = modeOverride || magicSettings.outputMode;
    
    // 1. Initial Logging
    logStep(log, 'Initialization', `Mode: ${mode} | Target: ${magicSettings.targetTokenCount} (±${magicSettings.tokenMargin})`);

    if (!settings.apiKeyGemini) {
        logStep(log, 'Error', 'API Key Missing', 'error');
        return { finalText: rawInput, traceLog: log };
    }

    const ai = new GoogleGenAI({ apiKey: settings.apiKeyGemini });

    // 2. Mode: Verbatim (Bypass)
    if (mode === 'verbatim') {
        logStep(log, 'Bypass', 'Verbatim mode active. No processing.');
        log.outputSnippet = rawInput;
        return { finalText: rawInput, traceLog: log };
    }

    try {
        // 3. D&D Rules Layer (If Active)
        let diceContext = "";
        
        if (magicSettings.enableDndRules) {
            logStep(log, 'D&D Logic', 'Analyzing input for mechanics...');
            const intentPrompt = `
                Analyze D&D 5e mechanics for: "${rawInput}"
                Return JSON: { "actionType": string, "needsRoll": boolean, "diceToRoll": string[] }
            `;
            const intentResp = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: intentPrompt,
                config: { responseMimeType: 'application/json' }
            });
            const intent = JSON.parse(intentResp.text || "{}");
            
            if (intent.needsRoll && intent.diceToRoll) {
                const results: string[] = [];
                for (const dieStr of intent.diceToRoll) {
                    const sides = parseInt(dieStr.replace('d', '')) || 20;
                    results.push(`${dieStr}=${rollDie(sides)}`);
                }
                diceContext = `[SYSTEM RNG: ${results.join(', ')}]`;
                logStep(log, 'Dice Engine', `Rolled: ${results.join(', ')}`, 'success');
            }
        }

        // 4. Construct Enhancement Prompt
        let systemPrompt = `
            You are a Text Enhancement Engine.
            **User:** ${settings.userName}
            **Context:** ${character.name}.
            **Goal:** ${refereeCheck ? 'AUDIT AND CORRECTION' : 'ENHANCEMENT'}
            
            **Directives:**
            1. **Output Length:** TARGET EXACTLY ${magicSettings.targetTokenCount} TOKENS.
            2. **Format:** ${settings.formattingStyle}.
            3. **Style:** ${settings.writingStyle}.
        `;

        if (refereeCheck) {
            systemPrompt += `
            **REFEREE MODE ACTIVE:**
            - Check for "Godmoding" (controlling the other character's actions/feelings).
            - Check for "Metagaming" (using knowledge the character shouldn't have).
            - Check for "Physics/Logic violations".
            - **ACTION:** If found, rewrite the input to remove these violations while keeping the intent. If clean, simply enhance the prose.
            `;
        } else if (mode === 'roleplay') {
            systemPrompt += `\nConvert simple statements into immersive actions/dialogue. Maintain character voice.`;
        } else if (mode === 'cleaned') {
            systemPrompt += `\nFix grammar, remove fillers. Do not embellish.`;
        }

        if (diceContext) {
            systemPrompt += `\n**Mechanics:** Incorporate this roll result: ${diceContext}.`;
        }

        const contextWindow = activeThread?.messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n') || "";
        
        // 5. Execution
        logStep(log, 'Enhancement', 'Generating draft...');
        
        // Calculate hard limit: Target + Margin
        const maxTokens = magicSettings.targetTokenCount + magicSettings.tokenMargin;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `
                ${systemPrompt}
                
                [RECENT CONTEXT]
                ${contextWindow}

                [RAW INPUT]
                ${rawInput}
            `,
            config: {
                temperature: refereeCheck ? 0.4 : 0.8, // Lower temp for auditing
                maxOutputTokens: maxTokens
            }
        });

        const enhancedText = response.text?.trim() || rawInput;
        log.outputSnippet = enhancedText.substring(0, 50) + "...";
        logStep(log, 'Completion', `Draft generated (~${enhancedText.split(' ').length} words).`, 'success');

        return { finalText: enhancedText, traceLog: log };

    } catch (e: any) {
        console.error("Magic Input Failed", e);
        logStep(log, 'Error', e.message || 'Unknown Failure', 'error');
        return { finalText: rawInput, traceLog: log };
    }
};
