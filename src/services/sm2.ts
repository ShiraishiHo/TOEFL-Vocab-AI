import { WordEntry } from "../types";

/**
 * Simplified SM-2 (SuperMemo-2) algorithm for 0-3 scale
 * 0: Forgot
 * 1: Hard
 * 2: Good
 * 3: Easy
 */
export function updateSM2(word: WordEntry, quality: number): WordEntry {
  let { interval, repetition, efactor } = word;

  // Default values if not present
  if (interval === undefined) interval = 0;
  if (repetition === undefined) repetition = 0;
  if (efactor === undefined) efactor = 2.5;

  if (quality < 2) {
    // Forgot or Hard: reset repetition and set interval to 1 day
    repetition = 0;
    interval = 1;
  } else {
    // Good or Easy
    if (repetition === 0) {
      interval = 1;
    } else if (repetition === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * efactor);
    }
    repetition += 1;
  }

  // Update E-Factor: efactor = efactor + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02))
  // Adjusted for 0-3 scale where 3 is "Easy"
  efactor = efactor + (0.1 - (3 - quality) * (0.1 + (3 - quality) * 0.05));
  if (efactor < 1.3) efactor = 1.3;

  const nextReview = Date.now() + interval * 24 * 60 * 60 * 1000;

  return {
    ...word,
    interval,
    repetition,
    efactor,
    nextReview
  };
}

export function getDueCount(words: WordEntry[]): number {
  const now = Date.now();
  return words.filter(word => {
    // If never reviewed, it's due if it was created more than a few hours ago? 
    // Or just say if nextReview is missing it's not "due" in the SRS sense but "new".
    // Let's assume nextReview missing means it's a new word to be reviewed.
    if (!word.nextReview) return true;
    return word.nextReview <= now;
  }).length;
}
