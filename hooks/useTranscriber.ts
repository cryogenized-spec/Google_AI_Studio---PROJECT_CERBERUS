import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

interface UseTranscriberProps {
    mode: 'browser' | 'openai' | 'gemini';
    model?: string;
    apiKey?: string; // OpenAI or Gemini Key depending on mode
    onInputUpdate: (text: string) => void;
    onSend: (text: string) => void;
    autoSend: boolean;
}

// Helper
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
            // Remove data url prefix
            resolve(base64data.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const useTranscriber = ({ mode, model, apiKey, onInputUpdate, onSend, autoSend }: UseTranscriberProps) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Server Mode Refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Native Mode Refs
    const recognitionRef = useRef<any>(null); // webkitSpeechRecognition

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
            if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
        };
    }, []);

    const startRecording = async () => {
        setError(null);
        
        if (mode === 'browser') {
            startNativeRecording();
        } else {
            // OpenAI or Gemini (both require MediaRecorder)
            startServerRecording();
        }
    };

    const stopRecording = () => {
        if (mode === 'browser') {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                setIsRecording(false);
            }
        } else {
            if (mediaRecorderRef.current && isRecording) {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
            }
        }
    };

    // --- NATIVE BROWSER IMPLEMENTATION (Forced Non-Streaming UI) ---
    const startNativeRecording = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setError("Browser does not support Native Speech API.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true; // We need interim to keep connection alive but we won't display it
        recognition.lang = 'en-US';

        let bufferedTranscript = '';

        recognition.onstart = () => {
            setIsRecording(true);
        };

        recognition.onresult = (event: any) => {
            // Accumulate final results
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    bufferedTranscript += event.results[i][0].transcript + ' ';
                }
            }
            // Note: We deliberately do NOT call onInputUpdate here to simulate "non-streaming" feel.
            // Only finalize at end.
        };

        recognition.onerror = (event: any) => {
            console.error("Speech Recognition Error", event.error);
            setError(`Speech Error: ${event.error}`);
            setIsRecording(false);
        };

        recognition.onend = () => {
            setIsRecording(false);
            const final = bufferedTranscript.trim();
            if (final) {
                onInputUpdate(final);
                if (autoSend) {
                    onSend(final);
                    onInputUpdate('');
                }
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    // --- SERVER IMPLEMENTATION (MediaRecorder) ---
    const startServerRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Prefer webm, fallback to mp4
            let mimeType = 'audio/webm';
            if (!MediaRecorder.isTypeSupported('audio/webm')) {
                if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    mimeType = 'audio/mp4';
                } else {
                    mimeType = ''; 
                }
            }

            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            chunksRef.current = []; // Reset chunks
            
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
                chunksRef.current = [];
                if (mode === 'gemini') {
                    transcribeGemini(blob);
                } else {
                    transcribeOpenAI(blob);
                }
                stream.getTracks().forEach(t => t.stop());
            };
            
            mediaRecorderRef.current = recorder;
            recorder.start();
            setIsRecording(true);
        } catch (e: any) {
            console.error(e);
            setError("Microphone access denied or not supported.");
        }
    };

    const transcribeGemini = async (blob: Blob) => {
        setIsTranscribing(true);
        setError(null);
        try {
            if (!apiKey) throw new Error("Gemini API Key missing.");
            
            const base64Audio = await blobToBase64(blob);
            const ai = new GoogleGenAI({ apiKey });
            
            // Use gemini-2.5-flash-latest for best audio performance
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-latest',
                contents: {
                    parts: [
                        {
                            inlineData: {
                                mimeType: blob.type.includes('mp4') ? 'audio/mp4' : 'audio/webm',
                                data: base64Audio
                            }
                        },
                        { text: "Transcribe the audio exactly. Do not add any commentary." }
                    ]
                }
            });

            const text = response.text;
            if (text) {
                const cleanText = text.trim();
                onInputUpdate(cleanText);
                if (autoSend && cleanText) {
                    onSend(cleanText);
                    onInputUpdate('');
                }
            }
        } catch (e: any) {
            console.error("Gemini Transcription Failed:", e);
            setError(e.message || "Transcription failed.");
        } finally {
            setIsTranscribing(false);
        }
    };

    const transcribeOpenAI = async (blob: Blob) => {
        setIsTranscribing(true);
        setError(null);
        try {
            const formData = new FormData();
            const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
            formData.append('file', blob, `recording.${ext}`);
            formData.append('model', model || 'gpt-4o-mini-transcribe');

            let res;

            if (apiKey) {
                // Direct Client Call (Frontend Key)
                res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: formData
                });
            } else {
                // Backend Proxy Call (Secure Key)
                res = await fetch('/api/transcribe', {
                    method: 'POST',
                    body: formData
                });
            }

            if (!res.ok) {
                if (res.status === 404) throw new Error("Backend endpoint not found (404) and no API key provided.");
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `Server Error: ${res.status}`);
            }
            
            const data = await res.json();
            if (data.text) {
                onInputUpdate(data.text);
                if (autoSend) {
                    onSend(data.text);
                    onInputUpdate('');
                }
            } else {
                throw new Error("Empty response from server");
            }
        } catch (e: any) {
            console.error("Transcription Failed:", e);
            setError(e.message || "Transcription failed.");
        } finally {
            setIsTranscribing(false);
        }
    };

    const retry = () => {
        setError(null);
    };

    return {
        isRecording,
        isTranscribing,
        error,
        startRecording,
        stopRecording,
        retry
    };
};