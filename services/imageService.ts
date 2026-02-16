import { GoogleGenAI, Type } from '@google/genai';
import { AppSettings, ImageGenConfig, GeneratedImage, ImageIntentSpec, WizardStep } from '../types';
import { IMAGE_STYLES, WIZARD_SYSTEM_PROMPT } from '../constants';
import { v4 as uuidv4 } from 'uuid';

// --- PROMPT EXPANSION ---

export const expandImagePrompt = async (
    userPrompt: string,
    styleId: string,
    settings: AppSettings
): Promise<string> => {
    // We use the text model to enhance the prompt
    // Use Gemini for this as it's efficient
    const apiKey = settings.apiKeyGemini;
    if (!apiKey) return userPrompt; // Fallback

    try {
        const ai = new GoogleGenAI({ apiKey });
        const styleDef = IMAGE_STYLES.find(s => s.id === styleId);
        
        const systemPrompt = `
        You are an expert AI Art Prompt Engineer.
        Your task is to take a simple user description and expand it into a high-quality, detailed image generation prompt.
        
        **Target Style:** ${styleDef?.label} (${styleDef?.desc})
        **User Idea:** "${userPrompt}"
        
        **Guidelines:**
        1. Keep the subject clear.
        2. Enhance lighting, texture, and composition descriptors relevant to the style.
        3. Do NOT use markdown or conversational filler. Output ONLY the raw prompt text.
        4. Keep it under 75 words.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: systemPrompt,
            config: {
                temperature: 0.7,
                maxOutputTokens: 100,
            }
        });

        return response.text?.trim() || userPrompt;
    } catch (e) {
        console.error("Prompt expansion failed", e);
        return userPrompt;
    }
};

// --- WIZARD LOGIC ---

export const interactWithWizard = async (
    history: { role: 'ai' | 'user'; content: string }[],
    userInput: string,
    currentSpec: ImageIntentSpec,
    settings: AppSettings
): Promise<{
    question: string;
    options: string[];
    updatedSpec: ImageIntentSpec;
    isComplete: boolean;
}> => {
    const apiKey = settings.apiKeyGemini;
    if (!apiKey) throw new Error("Google API Key missing for Wizard logic.");

    const ai = new GoogleGenAI({ apiKey });

    // Construct history for context
    const chatHistory = history.map(msg => ({
        role: msg.role === 'ai' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));

    // Add user's latest input
    if (userInput) {
        chatHistory.push({
            role: 'user',
            parts: [{ text: userInput }]
        });
    }

    // Inject Spec Context if not empty
    const specContext = `\n[Current Spec: ${JSON.stringify(currentSpec)}]`;
    
    // We append the spec context to the system instruction or the last message
    // Ideally system instruction is static, so we append state to history as a system injection
    if (Object.keys(currentSpec).length > 0) {
        chatHistory.push({
            role: 'user',
            parts: [{ text: `[SYSTEM: Current Image Intent Spec is ${JSON.stringify(currentSpec)}. Update it based on my last input.]` }]
        });
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: chatHistory,
            config: {
                systemInstruction: WIZARD_SYSTEM_PROMPT,
                temperature: 0.7,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        thought: { type: Type.STRING },
                        question: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        updatedSpec: { 
                            type: Type.OBJECT,
                            properties: {
                                subject: { type: Type.STRING },
                                appearance: { type: Type.STRING },
                                pose: { type: Type.STRING },
                                setting: { type: Type.STRING },
                                mood: { type: Type.STRING },
                                style: { type: Type.STRING },
                                framing: { type: Type.STRING },
                                constraints: { type: Type.STRING }
                            }
                        },
                        isComplete: { type: Type.BOOLEAN }
                    }
                }
            }
        });

        const json = JSON.parse(response.text || "{}");
        
        return {
            question: json.question || "What would you like to create?",
            options: json.options || ["Character Portrait", "Fantasy Landscape", "Sci-Fi Scene", "Abstract Art"],
            updatedSpec: { ...currentSpec, ...(json.updatedSpec || {}) },
            isComplete: json.isComplete || false
        };

    } catch (e) {
        console.error("Wizard Error", e);
        return {
            question: "I'm having trouble connecting to the aether. Describe your image manually?",
            options: [],
            updatedSpec: currentSpec,
            isComplete: true
        };
    }
};

// --- IMAGE GENERATION ---

interface GenerateParams {
    prompt: string;
    config: ImageGenConfig;
    settings: AppSettings;
    negativePrompt?: string;
}

export const generateImages = async ({ prompt, config, settings, negativePrompt }: GenerateParams): Promise<GeneratedImage[]> => {
    const activeNegative = negativePrompt || config.negativePrompt;

    // GOOGLE PROVIDER
    if (config.provider === 'google') {
        const apiKey = settings.apiKeyGemini;
        if (!apiKey) throw new Error("Google API Key missing");

        const ai = new GoogleGenAI({ apiKey });
        // Use gemini-2.5-flash-image (Nano Banana) or gemini-3-pro-image-preview (Nano Banana Pro)
        const model = config.model || settings.imageModelGoogle || 'gemini-2.5-flash-image';
        
        // Parallel requests for quantity
        const promises = Array(config.count).fill(0).map(async () => {
            try {
                // Determine aspect ratio keywords if model doesn't support structured config
                const ratioPrompt = config.aspectRatio === '1:1' ? "Square aspect ratio." : 
                                    config.aspectRatio.includes('9:16') ? "Portrait 9:16 aspect ratio." : "Landscape 16:9 aspect ratio.";
                
                const finalPrompt = `${prompt}. ${ratioPrompt} ${activeNegative ? `Exclude: ${activeNegative}` : ''}`;

                // Image config block for models that support it (Pro)
                // Note: Flash image sometimes prefers prompts, but we can pass config optionally
                const generateConfig: any = {};
                if (model.includes('gemini-3-pro')) {
                    generateConfig.imageConfig = { 
                        aspectRatio: config.aspectRatio.replace(':',''), // "11" "34" etc per SDK? No, string like "1:1" usually works or is specific enum.
                        // SDK might require strict Enum or String format. Safest is prompt for now unless using strictly types.
                    };
                }

                const response = await ai.models.generateContent({
                    model: model,
                    contents: { parts: [{ text: finalPrompt }] },
                    // config: generateConfig 
                });

                // Extract Image
                let base64Data = '';
                
                // First, check specifically for inlineData in parts
                if (response.candidates?.[0]?.content?.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData) {
                            base64Data = part.inlineData.data;
                            break;
                        }
                    }
                }

                // Fallback: Check if image is returned in a different structure or if there is text refusal
                if (!base64Data) {
                    // Check for text refusal first
                    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        // Some models return text explanation for refusal
                        throw new Error(`Model Refusal: ${text}`);
                    }
                    
                    // Check Safety Ratings
                    const safety = response.candidates?.[0]?.safetyRatings;
                    if (safety) {
                        const blocked = safety.find(s => s.probability === 'HIGH' || s.probability === 'MEDIUM');
                        if (blocked) throw new Error(`Safety Block: ${blocked.category} (${blocked.probability})`);
                    }

                    throw new Error("No image data returned from model. Verify prompt safety.");
                }

                if (base64Data) {
                    return {
                        id: uuidv4(),
                        url: `data:image/png;base64,${base64Data}`,
                        prompt: prompt,
                        provider: 'google',
                        timestamp: Date.now(),
                        params: { aspectRatio: config.aspectRatio, style: config.stylePreset }
                    } as GeneratedImage;
                }
                return null;
            } catch (e: any) {
                console.error("Google Image Gen Error", e);
                // Propagate error up
                throw new Error(e.message || "Image Generation Failed");
            }
        });

        const outcome = await Promise.all(promises);
        return outcome.filter(Boolean) as GeneratedImage[];
    }

    // OPENAI PROVIDER
    if (config.provider === 'openai') {
        const apiKey = settings.apiKeyOpenAI;
        if (!apiKey) throw new Error("OpenAI API Key missing");

        // DALL-E 3 only supports 1 image per request
        const promises = Array(config.count).fill(0).map(async () => {
            try {
                const size = config.aspectRatio === '1:1' ? "1024x1024" : 
                             config.aspectRatio === '9:16' ? "1024x1792" : "1792x1024";

                const model = config.model || settings.imageModelOpenAI || 'dall-e-3';
                const quality = config.resolution === 'hd' ? 'hd' : 'standard';

                const res = await fetch('https://api.openai.com/v1/images/generations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: model,
                        prompt: prompt + (activeNegative ? ` --no ${activeNegative}` : ''),
                        n: 1,
                        size: size,
                        quality: quality, 
                        style: "vivid" 
                    })
                });

                const data = await res.json();
                if (data.error) throw new Error(data.error.message);

                return {
                    id: uuidv4(),
                    url: data.data[0].url, 
                    prompt: prompt,
                    provider: 'openai',
                    timestamp: Date.now(),
                    params: { aspectRatio: config.aspectRatio, style: config.stylePreset }
                } as GeneratedImage;

            } catch (e) {
                console.error("OpenAI Image Gen Error", e);
                throw e;
            }
        });

        const outcome = await Promise.all(promises);
        return outcome.filter(Boolean) as GeneratedImage[];
    }

    // XAI (Placeholder / Fallback)
    if (config.provider === 'xai') {
        throw new Error("xAI Image Generation is currently unavailable in this region.");
    }

    return [];
};

// --- COST ESTIMATION ---

export const estimateCost = (config: ImageGenConfig): string => {
    if (config.provider === 'google') {
        // Gemini Flash Image is free in preview or very cheap
        return "~$0.00 (Preview)";
    }

    if (config.provider === 'openai') {
        // DALL-E 3 Pricing:
        // Standard: $0.04 (1024x1024), $0.08 (Wide/Tall) - Not quite, check latest
        // HD: $0.08 (1024x1024), $0.12 (Wide/Tall)
        
        let basePrice = 0.04;
        if (config.model === 'dall-e-3') {
            if (config.resolution === 'hd') {
                basePrice = 0.08;
                if (config.aspectRatio !== '1:1') basePrice = 0.12;
            } else {
                basePrice = 0.04;
                if (config.aspectRatio !== '1:1') basePrice = 0.08;
            }
        } else if (config.model === 'dall-e-2') {
            basePrice = 0.02; // Approx for 1024
        }

        const total = basePrice * config.count;
        return `$${total.toFixed(2)}`;
    }

    if (config.provider === 'xai') {
        return "Unknown";
    }

    return "$0.00";
};