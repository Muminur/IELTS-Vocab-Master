import { GoogleGenAI, Type, Modality } from "@google/genai";
import { WordDetails } from "../types";

// Singleton instance
let aiClient: GoogleGenAI | null = null;

const getClient = () => {
    if (!aiClient) {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            throw new Error("API_KEY is missing in environment variables.");
        }
        aiClient = new GoogleGenAI({ apiKey });
    }
    return aiClient;
};

export const fetchWordAnalysis = async (word: string): Promise<WordDetails> => {
    const ai = getClient();
    
    const prompt = `Analyze the word "${word}" for an IELTS student. 
    Provide the part of speech, the IPA transcription (US pronunciation), a concise definition, one excellent example sentence, 
    3-4 common collocations, 3-4 synonyms, and 3-4 antonyms (if applicable).`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    word: { type: Type.STRING },
                    ipa: { type: Type.STRING },
                    partOfSpeech: { type: Type.STRING },
                    definition: { type: Type.STRING },
                    example: { type: Type.STRING },
                    collocations: { 
                        type: Type.ARRAY, 
                        items: { type: Type.STRING } 
                    },
                    synonyms: { 
                        type: Type.ARRAY, 
                        items: { type: Type.STRING } 
                    },
                    antonyms: { 
                        type: Type.ARRAY, 
                        items: { type: Type.STRING } 
                    },
                },
                required: ["word", "ipa", "partOfSpeech", "definition", "example", "collocations", "synonyms"],
            },
        },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as WordDetails;
};

export const fetchTtsAudio = async (text: string): Promise<string> => {
    const ai = getClient();
    const cleanText = text.trim();
    if (!cleanText) throw new Error("Text is empty");

    const makeRequest = async (retryCount = 0): Promise<string> => {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: { parts: [{ text: cleanText }] },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Puck' }, // US English sounding voice
                        },
                    },
                },
            });

            const candidate = response.candidates?.[0];
            const audioData = candidate?.content?.parts?.[0]?.inlineData?.data;

            if (!audioData) {
                // Check if model returned text refusal (e.g. "I cannot pronounce this...")
                const textRefusal = candidate?.content?.parts?.[0]?.text;
                if (textRefusal) {
                    console.warn(`TTS Refusal for "${cleanText}":`, textRefusal);
                    throw new Error("Audio generation refused by model.");
                }
                
                // Check finish reason
                if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
                     // Retry on 'OTHER' which usually indicates a transient internal error
                     if (candidate.finishReason === 'OTHER' && retryCount < 2) {
                        console.warn(`TTS retry ${retryCount + 1} for reason: OTHER`);
                        await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
                        return makeRequest(retryCount + 1);
                     }
                     throw new Error(`Audio generation failed (Reason: ${candidate.finishReason})`);
                }

                throw new Error("Failed to generate audio: Empty response");
            }

            return audioData;
        } catch (error: any) {
            const msg = error.message || '';
            const status = error.status || error.code;

            // Check for rate limit (429) or resource exhausted
            const isRateLimit = status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
            const isServer = status === 500 || status === 503;
            const isOther = msg.includes('OTHER');
            
            const isRetryable = isRateLimit || isServer || isOther;
            
            // Allow more retries for rate limits with longer backoff
            const maxRetries = isRateLimit ? 3 : 2;
            
            if (isRetryable && retryCount < maxRetries) {
                // Exponential backoff: Rate Limit starts at 2s, else 1s
                const baseDelay = isRateLimit ? 2000 : 1000; 
                const delay = baseDelay * Math.pow(2, retryCount); 
                
                console.warn(`TTS retry ${retryCount + 1}/${maxRetries} due to ${isRateLimit ? 'Rate Limit' : 'Error'}:`, msg);
                await new Promise(r => setTimeout(r, delay));
                return makeRequest(retryCount + 1);
            }
            
            if (isRateLimit) {
                 throw new Error("Voice service quota exceeded. Please try again later.");
            }

            // Rethrow with clean message
            throw new Error(error.message || "TTS Service Unavailable");
        }
    };

    return makeRequest();
};