/**
 * Core AI Agent Loop
 * Manages autonomous behavior for all characters
 */

import { db, characters, tweetQueue } from "../../db";
import { computeMood, getTweetFrequency, type Mood } from "./mood";
import { generateTweet, type TweetContext, type Character } from "./personality";
import { postTweet, isMockMode } from "./twitter";

interface AgentState {
  running: boolean;
  intervalId: NodeJS.Timeout | null;
  lastRun: Date | null;
  tweetsGenerated: number;
  errors: number;
}

const state: AgentState = {
  running: false,
  intervalId: null,
  lastRun: null,
  tweetsGenerated: 0,
  errors: 0,
};

// Track last tweet time per character to respect frequency
const lastTweetTime: Map<string, Date> = new Map();

// Track vitality for change detection
const vitalityHistory: Map<string, number[]> = new Map();

/**
 * Start the agent loop
 */
export function startAgent(intervalMs: number = 60000): void {
  if (state.running) {
    console.log("[Agent] Already running");
    return;
  }

  console.log(`[Agent] Starting (interval: ${intervalMs}ms, mock: ${isMockMode()})`);

  state.running = true;
  state.intervalId = setInterval(() => runAgentCycle(), intervalMs);

  // Run immediately on start
  runAgentCycle();
}

/**
 * Stop the agent loop
 */
export function stopAgent(): void {
  if (!state.running) {
    console.log("[Agent] Not running");
    return;
  }

  console.log("[Agent] Stopping");

  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  state.running = false;
}

/**
 * Get agent status
 */
export function getAgentStatus(): {
  running: boolean;
  mockMode: boolean;
  lastRun: Date | null;
  tweetsGenerated: number;
  errors: number;
  characterCount: number;
} {
  const allCharacters = db.query.characters.findMany({});

  return {
    running: state.running,
    mockMode: isMockMode(),
    lastRun: state.lastRun,
    tweetsGenerated: state.tweetsGenerated,
    errors: state.errors,
    characterCount: allCharacters.length,
  };
}

/**
 * Main agent cycle - runs for all characters
 */
async function runAgentCycle(): Promise<void> {
  const startTime = Date.now();
  console.log(`[Agent] Running cycle at ${new Date().toISOString()}`);

  try {
    // Get all characters
    const allCharacters = db.query.characters.findMany({});

    if (allCharacters.length === 0) {
      console.log("[Agent] No characters to process");
      state.lastRun = new Date();
      return;
    }

    // Process each character
    for (const char of allCharacters) {
      await processCharacter(char);
    }

    state.lastRun = new Date();
    console.log(`[Agent] Cycle complete in ${Date.now() - startTime}ms`);
  } catch (error) {
    console.error("[Agent] Cycle error:", error);
    state.errors++;
  }
}

/**
 * Process a single character
 */
async function processCharacter(char: any): Promise<void> {
  try {
    // Compute current mood
    const moodContext = buildMoodContext(char);
    const mood = computeMood(moodContext);

    // Check if mood changed significantly
    const moodChanged = char.mood !== mood;
    if (moodChanged) {
      console.log(`[Agent] ${char.ticker} mood: ${char.mood} → ${mood}`);
      // Update mood in DB (mock db handles this)
      db.update(characters).set({ mood }).where((c: any) => c.id === char.id);
    }

    // Check tweet frequency
    const frequency = getTweetFrequency(mood);
    const lastTweet = lastTweetTime.get(char.id);
    const timeSinceLastTweet = lastTweet
      ? (Date.now() - lastTweet.getTime()) / 1000 / 60
      : Infinity;

    if (timeSinceLastTweet < frequency) {
      // Too soon to tweet
      return;
    }

    // Determine tweet trigger
    const trigger = determineTrigger(char, moodContext, moodChanged);

    if (!trigger) {
      return; // Nothing interesting to tweet about
    }

    // Generate tweet
    const character: Character = {
      name: char.name,
      ticker: char.ticker,
      personality: char.personality,
      mood,
      bio: char.bio,
      vitality: char.vitality,
    };

    const content = await generateTweet(character, { trigger });

    // Post tweet
    const result = await postTweet(content, char.xHandle);

    if (result.success) {
      // Record in database
      db.insert(tweetQueue).values({
        characterId: char.id,
        content,
        context: { trigger, mood },
        scheduledFor: new Date(),
        status: "POSTED",
        tweetId: result.tweetId,
        postedAt: new Date(),
      }).returning();

      lastTweetTime.set(char.id, new Date());
      state.tweetsGenerated++;

      console.log(`[Agent] ${char.ticker} tweeted: "${content.slice(0, 50)}..."`);
    } else {
      console.error(`[Agent] ${char.ticker} tweet failed: ${result.error}`);
      state.errors++;
    }
  } catch (error) {
    console.error(`[Agent] Error processing ${char.ticker}:`, error);
    state.errors++;
  }
}

/**
 * Build mood context from character state
 */
function buildMoodContext(char: any): {
  vitality: number;
  vitalityChange24h: number;
  recentBuys: number;
  recentSells: number;
  volumeChange: number;
  battleResult: "WIN" | "LOSS" | null;
  hasBeef: boolean;
  hasAlliance: boolean;
} {
  // Track vitality history
  const history = vitalityHistory.get(char.id) || [];
  history.push(char.vitality);
  if (history.length > 100) history.shift();
  vitalityHistory.set(char.id, history);

  // Calculate change
  const vitalityChange24h = history.length > 1
    ? char.vitality - history[0]
    : 0;

  // TODO: Get real trade data from indexer
  // For now, estimate based on vitality change
  const recentBuys = vitalityChange24h > 0 ? Math.floor(vitalityChange24h / 100) : 0;
  const recentSells = vitalityChange24h < 0 ? Math.floor(Math.abs(vitalityChange24h) / 100) : 0;

  return {
    vitality: char.vitality,
    vitalityChange24h,
    recentBuys,
    recentSells,
    volumeChange: 0,
    battleResult: null, // TODO: Check recent battles
    hasBeef: false,     // TODO: Check relationships
    hasAlliance: false, // TODO: Check relationships
  };
}

/**
 * Determine what to tweet about
 */
function determineTrigger(
  char: any,
  moodContext: ReturnType<typeof buildMoodContext>,
  moodChanged: boolean
): TweetContext["trigger"] | null {
  const { vitality, vitalityChange24h } = moodContext;

  // Critical vitality - urgent tweets
  if (vitality < 1000) {
    return "critical";
  }

  // Recovery from critical
  if (vitality > 2000 && vitalityHistory.get(char.id)?.[0] || 0 < 1500) {
    return "recovery";
  }

  // Significant buy pressure
  if (vitalityChange24h > 1000) {
    return "buy";
  }

  // Significant sell pressure
  if (vitalityChange24h < -1000) {
    return "sell";
  }

  // Mood changed - react to it
  if (moodChanged) {
    return "random";
  }

  // Random chance to tweet
  if (Math.random() < 0.3) {
    return "random";
  }

  return null;
}

/**
 * Force a character to tweet (for testing)
 */
export async function forceTweet(
  ticker: string,
  trigger: TweetContext["trigger"] = "random"
): Promise<{ success: boolean; tweet?: string; error?: string }> {
  const char = db.query.characters.findFirst({
    where: (c: any) => c.ticker === ticker.toUpperCase(),
  });

  if (!char) {
    return { success: false, error: "Character not found" };
  }

  const moodContext = buildMoodContext(char);
  const mood = computeMood(moodContext);

  const character: Character = {
    name: char.name,
    ticker: char.ticker,
    personality: char.personality,
    mood,
    bio: char.bio,
    vitality: char.vitality,
  };

  try {
    const content = await generateTweet(character, { trigger });
    const result = await postTweet(content, char.xHandle);

    if (result.success) {
      db.insert(tweetQueue).values({
        characterId: char.id,
        content,
        context: { trigger, mood, forced: true },
        scheduledFor: new Date(),
        status: "POSTED",
        tweetId: result.tweetId,
        postedAt: new Date(),
      }).returning();

      state.tweetsGenerated++;
      return { success: true, tweet: content };
    }

    return { success: false, error: result.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Trigger event-based tweet
 */
export async function triggerEventTweet(
  ticker: string,
  event: {
    type: "buy" | "sell" | "battle_start" | "battle_win" | "battle_loss";
    data?: any;
  }
): Promise<{ success: boolean; tweet?: string }> {
  const char = db.query.characters.findFirst({
    where: (c: any) => c.ticker === ticker.toUpperCase(),
  });

  if (!char) {
    return { success: false };
  }

  const moodContext = buildMoodContext(char);
  const mood = computeMood(moodContext);

  const character: Character = {
    name: char.name,
    ticker: char.ticker,
    personality: char.personality,
    mood,
    bio: char.bio,
    vitality: char.vitality,
  };

  const context: TweetContext = {
    trigger: event.type,
    data: event.data,
  };

  try {
    const content = await generateTweet(character, context);
    const result = await postTweet(content, char.xHandle);

    if (result.success) {
      db.insert(tweetQueue).values({
        characterId: char.id,
        content,
        context: { ...context, mood },
        scheduledFor: new Date(),
        status: "POSTED",
        tweetId: result.tweetId,
        postedAt: new Date(),
      }).returning();

      return { success: true, tweet: content };
    }

    return { success: false };
  } catch (error) {
    console.error(`[Agent] Event tweet failed for ${ticker}:`, error);
    return { success: false };
  }
}
