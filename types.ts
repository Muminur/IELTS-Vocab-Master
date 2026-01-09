import { Timestamp } from "firebase/firestore";

export interface WordDetails {
  word: string;
  ipa?: string; // IPA Transcription
  partOfSpeech: string;
  definition: string;
  example: string;
  collocations: string[];
  synonyms: string[];
  antonyms: string[];
}

export interface StoredWord extends WordDetails {
  id: string;
  userId: string;
  createdAt: any; // Firestore Timestamp
  nextReviewAt: any; // Firestore Timestamp
  srsStage: number; // 0 to 5 for spaced repetition
  lastReviewedAt?: any;
  isInFFL?: boolean; // Frequently Forgot List flag
}