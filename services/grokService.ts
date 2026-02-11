import { Message, Room, CharacterProfile, AppSettings } from '../types';

export const streamGrokResponse = async (
  messages: Message[],
  room: Room,
  settings: AppSettings,
  character: CharacterProfile,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> => {
    if (!settings.apiKeyGrok) {
        throw new Error("Grok API Key is missing.");
    }

    const fullSystemInstruction = `
${character.systemPrompt}

**Current Location:** ${room.name}
**Location Description:** ${room.description}
**User Name:** ${settings.userName}
**User Description:** ${settings.userDescription || "Unknown appearance."}
**Output Goal:** Aim for approx ${settings.tokenTarget || 300} tokens.
`;

    const apiMessages = [
        { role: 'system', content: fullSystemInstruction },
        ...messages.map(m => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.content
        }))
    ];

    let fullText = "";

    try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKeyGrok}`
            },
            body: JSON.stringify({
                messages: apiMessages,
                model: settings.modelGrok,
                stream: true,
                temperature: settings.temperature,
                max_tokens: settings.maxOutputTokens || 2048
            }),
            signal // Pass the signal to fetch
        });

        if (!response.ok) {
            throw new Error(`Grok API Error: ${response.statusText}`);
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line === 'data: [DONE]') return fullText;
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '');
                    try {
                        const data = JSON.parse(dataStr);
                        const content = data.choices[0]?.delta?.content || '';
                        if (content) {
                            fullText += content;
                            onChunk(content);
                        }
                    } catch (e) {
                        console.warn("Error parsing stream chunk", e);
                    }
                }
            }
        }
        return fullText;

    } catch (error) {
        if ((error as Error).name === 'AbortError') {
             return fullText + " [Ritual Interrupted]";
        }
        console.error("Grok API Error:", error);
        throw error;
    }
};

export const testGrokConnection = async (apiKey: string): Promise<boolean> => {
    try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'ping' }],
                model: 'grok-beta',
                stream: false
            })
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}