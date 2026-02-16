
import { GoogleGenAI, Type } from '@google/genai';
import { db } from './organizerDb';
import { AppSettings, AssistantMode, ActionProposal, AssistantMessage, PlanningContext } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { proposeSlots } from './schedulingService';

// --- SYSTEM PROMPTS ---

const BASE_ASSISTANT_PROMPT = `
You are the Organizer Assistant. Your goal is to manage the user's Tasks, Events, and Notes efficiently.
You communicate via JSON actions and short textual summaries.

**MODES:**
1. **CAPTURE:** Convert input immediately into the most likely item (Task/Event/Note). Assume 'today' if unspecified. Ask nothing unless critical.
2. **ASK:** Answer questions about the user's schedule/tasks. Do NOT modify data.
3. **ACT:** Plan complex changes. Propose actions but wait for confirmation.

**DATA SCHEMA:**
Return a JSON object with this structure:
{
  "summary": "Short explanation of what you are proposing.",
  "questions": ["Optional clarification if absolutely needed"],
  "actions": [
    { 
      "type": "create_task" | "create_event" | "create_note" | "delete_task" | "delete_event" | "delete_note" | "propose_time_slots",
      "payload": { ... }, 
      "risk": "low" | "medium" | "high" 
    }
  ]
}

**PAYLOAD EXAMPLES:**
- create_task: { "title": "Buy milk", "dueAt": "ISO string", "priority": 1, "listId": "personal" }
- create_event: { "title": "Meeting", "startAt": "ISO", "endAt": "ISO", "allDay": false }
- propose_time_slots: { "durationMinutes": 60, "date": "ISO string (optional)", "context": "Focus time" }
`;

const QUICK_INTENT_PROMPT = `
Analyze the user's input to schedule a task or event.
1. Identify the Subject/Objective.
2. Extract Date and Time (Assume today/now if vague, unless context implies later).
3. Determine Duration:
   - Estimate difficulty of guessing duration (1-10). 
   - If < 5: Ask user. 
   - If >= 5: Estimate reasonable duration.
4. Break down into 3-7 sub-steps depending on complexity.
5. Determine Urgency (1=Low, 2=Med, 3=High).

Output JSON:
{
  "title": "Clear objective title",
  "startAt": "ISO String (Date/Time)",
  "endAt": "ISO String (Date/Time based on duration)",
  "durationMinutes": number,
  "durationConfidence": number (1-10),
  "needsClarification": boolean (true if confidence < 5),
  "clarificationQuestion": "Question if needed",
  "subtasks": ["Step 1", "Step 2"...],
  "urgency": 1 | 2 | 3
}
`;

// --- MAIN LOGIC ---

export const processAssistantRequest = async (
    userText: string,
    mode: AssistantMode,
    settings: AppSettings
): Promise<AssistantMessage> => {
    const apiKey = settings.apiKeyGemini;
    if (!apiKey) throw new Error("API Key missing");

    const ai = new GoogleGenAI({ apiKey });
    
    // 1. Context Gathering (Privacy Aware)
    const context = await buildContext(mode);
    
    // 2. Prompt Construction
    const systemInstruction = `${BASE_ASSISTANT_PROMPT}\n\n**CURRENT MODE:** ${mode.toUpperCase()}\n\n**CONTEXT:**\n${JSON.stringify(context)}`;
    
    // 3. AI Call
    let responseText = "{}";
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: userText,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                temperature: 0.3 // Low temp for reliability
            }
        });
        responseText = response.text || "{}";
    } catch (e: any) {
        console.error("Assistant AI Error", e);
        return {
            id: uuidv4(),
            role: 'assistant',
            text: "I couldn't reach the planning core. Please try again.",
            createdAt: Date.now(),
            mode
        };
    }

    // 4. Parse & Construct Message
    try {
        const parsed = JSON.parse(responseText);
        const actions: ActionProposal[] = (parsed.actions || []).map((a: any) => ({
            id: uuidv4(),
            type: a.type,
            payload: a.payload,
            risk: a.risk || 'medium',
            status: 'pending',
            originalInput: userText
        }));

        // 4b. Pre-calculate slots if requested
        for (const action of actions) {
            if (action.type === 'propose_time_slots') {
                const date = action.payload.date ? new Date(action.payload.date) : new Date();
                const duration = action.payload.durationMinutes || 60;
                action.generatedSlots = await proposeSlots(duration, date);
            }
        }

        return {
            id: uuidv4(),
            role: 'assistant',
            text: parsed.summary || (actions.length > 0 ? "Here is the plan:" : "I'm not sure what to do."),
            createdAt: Date.now(),
            mode,
            proposals: actions
        };
    } catch (e) {
        return {
            id: uuidv4(),
            role: 'assistant',
            text: "Failed to parse action plan.",
            createdAt: Date.now(),
            mode
        };
    }
};

export const analyzeQuickIntent = async (
    text: string, 
    settings: AppSettings,
    previousContext?: any
): Promise<any> => {
    const apiKey = settings.apiKeyGemini;
    if (!apiKey) throw new Error("API Key missing");

    const ai = new GoogleGenAI({ apiKey });
    const now = new Date().toISOString();

    const contextStr = previousContext ? `\n\n[PREVIOUS PLAN CONTEXT]\n${JSON.stringify(previousContext)}\nUser is amending this plan.` : '';

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `User Input: "${text}"\nCurrent Time: ${now}${contextStr}`,
            config: {
                systemInstruction: QUICK_INTENT_PROMPT,
                responseMimeType: "application/json",
                temperature: 0.3
            }
        });
        return JSON.parse(response.text || "{}");
    } catch (e) {
        console.error("Quick Intent Error", e);
        return null;
    }
};

const buildContext = async (mode: AssistantMode) => {
    // Fetch context based on permissions
    const config = await db.planning_context.get('default');
    if (!config) return {};

    const context: any = {
        now: new Date().toISOString(),
        userPreferences: config.preferences
    };

    if (config.privacy.allowTasks && mode !== 'capture') {
        // Only fetch relevant open tasks to save tokens
        const tasks = await db.tasks.where('status').equals('open').limit(20).toArray();
        context.openTasks = tasks.map(t => ({ id: t.id, title: t.title, due: t.dueAt }));
    }

    if (config.privacy.allowCalendar && mode !== 'capture') {
        // Fetch today and tomorrow
        const start = new Date(); start.setHours(0,0,0,0);
        const end = new Date(); end.setDate(end.getDate() + 2);
        const events = await db.events.where('startAt').between(start.getTime(), end.getTime()).toArray();
        context.upcomingEvents = events.map(e => ({ title: e.title, start: new Date(e.startAt).toISOString() }));
    }

    return context;
};

// --- ACTION EXECUTION ---

export const executeAction = async (action: ActionProposal) => {
    const { type, payload } = action;

    switch (type) {
        case 'create_task':
            await db.tasks.add({
                id: uuidv4(),
                title: payload.title || 'New Task',
                status: 'open',
                priority: payload.priority || 1,
                listId: payload.listId || 'inbox',
                dueAt: payload.dueAt ? new Date(payload.dueAt).getTime() : undefined,
                notes: payload.notes,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            break;
        case 'create_event':
            await db.events.add({
                id: uuidv4(),
                title: payload.title || 'New Event',
                startAt: payload.startAt ? new Date(payload.startAt).getTime() : Date.now(),
                endAt: payload.endAt ? new Date(payload.endAt).getTime() : Date.now() + 3600000,
                allDay: payload.allDay || false,
                location: payload.location,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            break;
        case 'create_note':
            await db.notes.add({
                id: uuidv4(),
                body: payload.body || '',
                pinned: payload.pinned || false,
                isChecklist: false,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
            break;
        case 'delete_task':
            if (payload.id) await db.tasks.delete(payload.id);
            break;
        case 'delete_event':
            if (payload.id) await db.events.delete(payload.id);
            break;
    }
};

// --- MAGIC WAND ---

export const refineText = async (text: string, settings: AppSettings): Promise<string> => {
    const apiKey = settings.apiKeyGemini;
    if (!apiKey) return text;

    const ai = new GoogleGenAI({ apiKey });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Rewrite the following text into a clear, structured summary suitable for an AI planning agent. Remove fluff. Keep constraints.\n\nTEXT: ${text}`,
        });
        return response.text?.trim() || text;
    } catch (e) {
        return text;
    }
};
