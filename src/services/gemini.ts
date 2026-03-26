import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AIResponse } from "../types";

const apiKey = process.env.GEMINI_API_KEY;

export async function fetchWordDetails(word: string): Promise<AIResponse> {
  if (!apiKey) {
    throw new Error("Gemini API Key is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the TOEFL vocabulary word: "${word}". Provide its phonetic transcription (IPA), a simple phonics guide (e.g., "e-PHE-me-ral"), part of speech (e.g., noun, verb, adj), precise Chinese meaning, precise Japanese translation, a clear English definition, 2 TOEFL-style example sentences, 3 common academic collocations, 3 related academic words or synonyms, and a deep morphological analysis (etymology). 
    
    For the etymology, include:
    1. Prefix: meaning and origin.
    2. Root: core meaning and Latin/Greek origin.
    3. Suffix: part of speech indicator and meaning.
    4. Mnemonic: a one-sentence memory aid linking the parts.
    
    If the word has no clear roots (simple word), provide its etymological evolution.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          phonetic: { type: Type.STRING },
          phonics: { type: Type.STRING },
          partOfSpeech: { type: Type.STRING },
          meaning: { type: Type.STRING },
          japaneseMeaning: { type: Type.STRING },
          englishDefinition: { type: Type.STRING },
          examples: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            minItems: 2,
            maxItems: 2
          },
          collocations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            minItems: 3,
            maxItems: 3
          },
          relatedWords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            minItems: 3,
            maxItems: 3
          },
          etymology: { type: Type.STRING }
        },
        required: ["phonetic", "phonics", "partOfSpeech", "meaning", "japaneseMeaning", "englishDefinition", "examples", "collocations", "relatedWords", "etymology"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as AIResponse;
}

export async function fetchAudio(word: string, accent: 'uk' | 'us'): Promise<string | undefined> {
  if (!apiKey) return undefined;

  const ai = new GoogleGenAI({ apiKey });
  
  const voiceName = accent === 'uk' ? 'Puck' : 'Kore';
  const prompt = accent === 'uk' ? `Pronounce the word: "${word}" in a British accent.` : `Pronounce the word: "${word}" in an American accent.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio;
  } catch (error) {
    console.error(`Failed to fetch ${accent} audio:`, error);
    return undefined;
  }
}
