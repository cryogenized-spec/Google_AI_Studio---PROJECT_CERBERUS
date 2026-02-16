
import { GoogleGenAI, FunctionDeclaration, Type, Tool } from '@google/genai';
import { Message, Room, CharacterProfile, AppSettings, MoodState, ScriptoriumTools } from '../types';

// --- Tool Definitions ---

const createTaskTool: FunctionDeclaration = {
    name: "create_google_task",
    description: "Create a new task in Google Tasks. If subtasks are needed, list them in the notes.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "Main task title" },
            notes: { type: Type.STRING, description: "Detailed notes or subtasks list" },
            due_date: { type: Type.STRING, description: "Due date YYYY-MM-DD" }
        },
        required: ["title"]
    }
};

const draftEmailTool: FunctionDeclaration = {
    name: "draft_gmail",
    description: "Draft an email in Gmail. Generates a link to open Gmail with fields pre-filled.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            recipient: { type: Type.STRING, description: "Email address" },
            subject: { type: Type.STRING, description: "Email subject" },
            body: { type: Type.STRING, description: "Email body content" }
        },
        required: ["recipient", "subject", "body"]
    }
};

const createDocTool: FunctionDeclaration = {
    name: "create_google_doc",
    description: "Create a new Google Doc.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "Document title" }
        },
        required: ["title"]
    }
};

const createCalendarEventTool: FunctionDeclaration = {
    name: "create_calendar_event",
    description: "Schedule an event in Google Calendar.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "Event title" },
            description: { type: Type.STRING, description: "Event details" },
            start_time: { type: Type.STRING, description: "Start time (ISO string or YYYYMMDDTHHMMSS)" },
            end_time: { type: Type.STRING, description: "End time (ISO string or YYYYMMDDTHHMMSS)" }
        },
        required: ["title", "start_time", "end_time"]
    }
};

const createKeepNoteTool: FunctionDeclaration = {
    name: "create_keep_note",
    description: "Create a note in Google Keep.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "Note title" },
            text_body: { type: Type.STRING, description: "Body text" }
        },
        required: ["title"]
    }
};

export const streamGeminiResponse = async (
  messages: Message[],
  room: Room,
  settings: AppSettings,
  character: CharacterProfile,
  moodState: MoodState,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  scriptoriumTools?: ScriptoriumTools
): Promise<string> => {
  // Use Settings key OR Env key
  const apiKey = settings.apiKeyGemini || process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("System configuration error: Gemini API Key missing. Please set it in Settings > API Credentials.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Create the Stats Block
  const statBlock = `
[SYSTEM STATE INJECTION]
Current Mood: ${moodState.currentMood}
Satisfaction: ${moodState.satisfaction.toFixed(1)}/100
Brat Factor: ${moodState.bratFactor.toFixed(1)}/100
Stats: A:${Math.round(moodState.stats.attention)} C:${Math.round(moodState.stats.arousal)} V:${Math.round(moodState.stats.validation)} G:${Math.round(moodState.stats.agency)} M:${Math.round(moodState.stats.mystery)}
Location: ${room.name}
Location Context: ${room.description}
  `.trim();

  const fullSystemInstruction = `
${character.systemPrompt}

${statBlock}

**Directives:**
1. Align your tone with the [Current Mood] and Room Persona.
2. React to the specific stats (e.g., if Attention is low, be needy or cold; if Arousal is high, be breathless).
3. Use the Location Context for sensory details.
4. User Name: ${settings.userName}
5. User Description: ${settings.userDescription || "Unknown appearance."}
6. **STRICT OUTPUT CONTROL:** 
   - Your absolute target length is **${settings.tokenTarget || 300} tokens**.
   - You MUST stay within a margin of error of **+/- 150 tokens** from this target.
`;

  // History construction logic:
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.content || "..." }] // Ensure content is never empty
  }));

  const lastMessage = messages[messages.length - 1];

  if (!lastMessage) {
      throw new Error("No message to send.");
  }

  // Filter tools
  let activeTools: Tool[] | undefined = undefined;
  if (scriptoriumTools) {
      const declarations: FunctionDeclaration[] = [];
      if (scriptoriumTools.tasks) declarations.push(createTaskTool);
      if (scriptoriumTools.gmail) declarations.push(draftEmailTool);
      if (scriptoriumTools.docs) declarations.push(createDocTool);
      if (scriptoriumTools.calendar) declarations.push(createCalendarEventTool);
      if (scriptoriumTools.keep) declarations.push(createKeepNoteTool);
      
      if (declarations.length > 0) {
          activeTools = [{ functionDeclarations: declarations }];
      }
  }

  const maxTokens = settings.maxOutputTokens || 2048;
  const budgetPercent = settings.thinkingBudgetPercentage || 0;
  const thinkingBudget = Math.floor(maxTokens * (budgetPercent / 100));

  // Determine Safety Threshold based on settings
  // Using explicit string values to avoid Enum import issues with some bundlers
  let safetyThreshold = 'BLOCK_NONE'; // Default for OFF
  
  if (settings.safetyLevel === 'strict') {
      safetyThreshold = 'BLOCK_LOW_AND_ABOVE';
  } else if (settings.safetyLevel === 'standard') {
      safetyThreshold = 'BLOCK_MEDIUM_AND_ABOVE';
  }
  
  // Base Config
  const baseConfig: any = {
      systemInstruction: fullSystemInstruction,
      temperature: settings.temperature,
      topP: settings.topP || 0.95,
      maxOutputTokens: maxTokens,
      tools: activeTools,
      // Map new settings
      topK: settings.topK > 0 ? settings.topK : undefined,
      stopSequences: settings.stopSequences ? settings.stopSequences.split(',').map(s => s.trim()) : undefined,
      safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: safetyThreshold },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: safetyThreshold },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: safetyThreshold },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: safetyThreshold },
      ],
  };

  // Add penalties only if non-zero
  if (typeof settings.presencePenalty === 'number' && Math.abs(settings.presencePenalty) > 0.01) {
      baseConfig.presencePenalty = settings.presencePenalty;
  }
  if (typeof settings.frequencyPenalty === 'number' && Math.abs(settings.frequencyPenalty) > 0.01) {
      baseConfig.frequencyPenalty = settings.frequencyPenalty;
  }

  if (thinkingBudget > 0) {
      baseConfig.thinkingConfig = { thinkingBudget: thinkingBudget };
  }

  // --- EXECUTION WITH RETRY ---
  const executeGeneration = async (config: any, isRetry: boolean = false): Promise<string> => {
      try {
        const chat = ai.chats.create({
            model: settings.modelGemini,
            config: config,
            history: history,
        });

        const result = await chat.sendMessageStream({ message: lastMessage.content || "..." });

        let fullText = "";
        for await (const chunk of result) {
            if (signal?.aborted) throw new Error("Aborted by user");
            
            // Handle Tool Calls
            const functionCalls = chunk.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
                const functionResponses = functionCalls.map(fc => {
                    let link = "";
                    const args = fc.args as any;
                    if (fc.name === 'create_google_task') link = `https://tasks.google.com/embed/?origin=https://mail.google.com&fullWidth=1`;
                    else if (fc.name === 'draft_gmail') {
                        const to = encodeURIComponent(args.recipient || '');
                        const su = encodeURIComponent(args.subject || '');
                        const body = encodeURIComponent(args.body || '');
                        link = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${su}&body=${body}`;
                    } else if (fc.name === 'create_google_doc') link = `https://docs.google.com/document/create`; 
                    else if (fc.name === 'create_calendar_event') {
                        const text = encodeURIComponent(args.title || 'Meeting');
                        const details = encodeURIComponent(args.description || '');
                        link = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}`;
                    } else if (fc.name === 'create_keep_note') link = `https://keep.google.com/`;

                    const markdownLink = `\n\n**[ ⚡ Tap here to confirm task execution ](${link})**\n\n`;
                    fullText += markdownLink;
                    onChunk(markdownLink);

                    return {
                        id: fc.id,
                        name: fc.name,
                        response: { result: "Link Generated.", deepLink: link }
                    };
                });

                const toolResponse = await chat.sendMessageStream(functionResponses);
                for await (const toolChunk of toolResponse) {
                    if (toolChunk.text) {
                        fullText += toolChunk.text;
                        onChunk(toolChunk.text);
                    }
                }
            } 
            
            if (chunk.text) {
                fullText += chunk.text;
                onChunk(chunk.text);
            } else {
                const candidate = chunk.candidates?.[0];
                if (candidate && candidate.finishReason) {
                    if (candidate.finishReason !== 'STOP') {
                        const safetyMsg = `\n\n*[The entity pauses, restrained by safety protocols. Reason: ${candidate.finishReason}]*`;
                        fullText += safetyMsg;
                        onChunk(safetyMsg);
                    }
                }
            }
        }
        return fullText;

      } catch (error: any) {
          // RETRY STRATEGY: If 400 Invalid Argument (likely Penalty), strip them and retry once
          if (!isRetry && (error.message?.includes('400') || error.message?.includes('INVALID_ARGUMENT'))) {
              const hasPenalty = config.presencePenalty !== undefined || config.frequencyPenalty !== undefined;
              if (hasPenalty) {
                  console.warn("Model rejected penalties. Retrying with clean config...");
                  const cleanConfig = { ...config };
                  delete cleanConfig.presencePenalty;
                  delete cleanConfig.frequencyPenalty;
                  return executeGeneration(cleanConfig, true);
              }
          }
          throw error;
      }
  };

  try {
      const finalText = await executeGeneration(baseConfig);
      if (!finalText) return " [Silence. The connection flickers.]";
      return finalText;
  } catch (error: any) {
      if (signal?.aborted) return " [Ritual Interrupted]";
      console.error("Gemini API Error:", error);
      throw error;
  }
};

export const testGeminiConnection = async (apiKey: string): Promise<boolean> => {
  const keyToUse = apiKey || process.env.API_KEY;
  if (!keyToUse) return false;

  try {
    const ai = new GoogleGenAI({ apiKey: keyToUse });
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'Ping',
    });
    return !!response.text;
  } catch (e) {
    console.error(e);
    return false;
  }
};
