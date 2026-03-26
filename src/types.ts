export interface VerbConjugations {
  past: string;
  pastParticiple: string;
  presentParticiple: string;
  thirdPersonSingular: string;
}

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
  verbConjugations?: VerbConjugations;
  audioUKBase64?: string;
  audioUSBase64?: string;
  audioBase64?: string;
  createdAt: number;
  // SM-2 SRS Fields
  interval?: number;
  repetition?: number;
  efactor?: number;
  nextReview?: number;
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
  verbConjugations?: VerbConjugations;
}
