export interface WordEntry {
  id: string;
  word: string;
  phonetic: string;
  phonics: string;
  partOfSpeech: string;
  meaning: string;
  japaneseMeaning: string;
  englishDefinition: string;
  examples: string[];
  collocations: string[];
  relatedWords: string[];
  etymology: string;
  audioUKBase64?: string;
  audioUSBase64?: string;
  audioBase64?: string;
  createdAt: number;
}

export interface AIResponse {
  phonetic: string;
  phonics: string;
  partOfSpeech: string;
  meaning: string;
  japaneseMeaning: string;
  englishDefinition: string;
  examples: string[];
  collocations: string[];
  relatedWords: string[];
  etymology: string;
}
