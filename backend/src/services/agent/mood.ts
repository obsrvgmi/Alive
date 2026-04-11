/**
 * Mood computation system for AI characters
 * Mood is derived from vitality, recent trades, and relationships
 */

export type Mood =
  | "FERAL"      // High energy, aggressive (vitality rising fast)
  | "DOOMED"     // Near death, dramatic farewells (vitality < 10%)
  | "LOCKED_IN"  // Confident, focused (stable high vitality)
  | "UNHINGED"   // Chaotic, random (volatile trading)
  | "DELUSIONAL" // Coping hard (vitality dropping but in denial)
  | "MENACING"   // Threatening, powerful (after battle win)
  | "NEUTRAL";   // Default state

export type Personality = "FERAL" | "COPIUM" | "ALPHA" | "SCHIZO" | "WHOLESOME" | "MENACE";

interface MoodContext {
  vitality: number;           // 0-10000 basis points
  vitalityChange24h: number;  // Positive = gaining, negative = losing
  recentBuys: number;         // Buy count in last hour
  recentSells: number;        // Sell count in last hour
  volumeChange: number;       // Volume delta
  battleResult?: "WIN" | "LOSS" | null;
  hasBeef: boolean;
  hasAlliance: boolean;
}

/**
 * Compute current mood based on context
 */
export function computeMood(ctx: MoodContext): Mood {
  const { vitality, vitalityChange24h, recentBuys, recentSells, battleResult } = ctx;

  // Critical state - near death
  if (vitality < 1000) {
    return "DOOMED";
  }

  // Post-battle moods
  if (battleResult === "WIN") {
    return "MENACING";
  }
  if (battleResult === "LOSS") {
    return vitality < 3000 ? "DOOMED" : "DELUSIONAL";
  }

  // Vitality-based moods
  if (vitalityChange24h > 2000) {
    // Pumping hard
    return "FERAL";
  }

  if (vitalityChange24h < -2000) {
    // Dumping hard
    return vitality > 5000 ? "DELUSIONAL" : "DOOMED";
  }

  // Trading activity based
  const tradeRatio = recentBuys / Math.max(recentSells, 1);

  if (tradeRatio > 3) {
    // Many more buys than sells
    return "LOCKED_IN";
  }

  if (recentBuys + recentSells > 20) {
    // High volatility
    return "UNHINGED";
  }

  // Stable high vitality
  if (vitality > 7000) {
    return "LOCKED_IN";
  }

  // Default based on vitality level
  if (vitality > 5000) {
    return "NEUTRAL";
  }

  if (vitality > 3000) {
    return "DELUSIONAL";
  }

  return "DOOMED";
}

/**
 * Get mood-appropriate tweet style modifiers
 */
export function getMoodStyle(mood: Mood): {
  caps: boolean;
  emoji: boolean;
  dramatic: boolean;
  aggressive: boolean;
  lowercase: boolean;
} {
  switch (mood) {
    case "FERAL":
      return { caps: true, emoji: true, dramatic: false, aggressive: true, lowercase: false };
    case "DOOMED":
      return { caps: false, emoji: true, dramatic: true, aggressive: false, lowercase: true };
    case "LOCKED_IN":
      return { caps: false, emoji: false, dramatic: false, aggressive: false, lowercase: false };
    case "UNHINGED":
      return { caps: true, emoji: true, dramatic: true, aggressive: true, lowercase: false };
    case "DELUSIONAL":
      return { caps: false, emoji: true, dramatic: false, aggressive: false, lowercase: true };
    case "MENACING":
      return { caps: true, emoji: false, dramatic: true, aggressive: true, lowercase: false };
    default:
      return { caps: false, emoji: true, dramatic: false, aggressive: false, lowercase: false };
  }
}

/**
 * Mood affects tweet frequency
 */
export function getTweetFrequency(mood: Mood): number {
  switch (mood) {
    case "FERAL":
    case "UNHINGED":
      return 10; // Every 10 minutes
    case "DOOMED":
      return 5;  // Desperate, tweets often
    case "MENACING":
      return 15; // Confident, less needy
    case "LOCKED_IN":
      return 30; // Chill, focused
    default:
      return 20; // Normal
  }
}
