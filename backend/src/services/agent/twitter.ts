/**
 * Twitter/X API integration for posting tweets
 * Supports both real X API and mock mode for testing
 */

import { TwitterApi } from "twitter-api-v2";

export interface TwitterConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
}

export interface TweetResult {
  success: boolean;
  tweetId?: string;
  url?: string;
  error?: string;
}

// Mock mode for testing
const MOCK_MODE = !process.env.X_APP_KEY || process.env.USE_MOCK_TWITTER === "true";

// Initialize Twitter client if credentials exist
let twitterClient: TwitterApi | null = null;

if (!MOCK_MODE) {
  try {
    twitterClient = new TwitterApi({
      appKey: process.env.X_APP_KEY!,
      appSecret: process.env.X_APP_SECRET!,
      accessToken: process.env.X_ACCESS_TOKEN!,
      accessSecret: process.env.X_ACCESS_SECRET!,
    });
    console.log("[Twitter] Initialized with real credentials");
  } catch (error) {
    console.error("[Twitter] Failed to initialize:", error);
  }
}

/**
 * Post a tweet
 */
export async function postTweet(
  content: string,
  characterHandle?: string
): Promise<TweetResult> {
  console.log(`[Twitter] ${MOCK_MODE ? "MOCK" : "REAL"} posting: "${content.slice(0, 50)}..."`);

  if (MOCK_MODE) {
    return mockPostTweet(content, characterHandle);
  }

  try {
    const result = await twitterClient!.v2.tweet(content);

    return {
      success: true,
      tweetId: result.data.id,
      url: `https://x.com/i/status/${result.data.id}`,
    };
  } catch (error: any) {
    console.error("[Twitter] Post failed:", error);
    return {
      success: false,
      error: error.message || "Failed to post tweet",
    };
  }
}

/**
 * Reply to a tweet
 */
export async function replyToTweet(
  content: string,
  replyToId: string
): Promise<TweetResult> {
  console.log(`[Twitter] ${MOCK_MODE ? "MOCK" : "REAL"} replying to ${replyToId}`);

  if (MOCK_MODE) {
    return mockPostTweet(content, undefined, replyToId);
  }

  try {
    const result = await twitterClient!.v2.reply(content, replyToId);

    return {
      success: true,
      tweetId: result.data.id,
      url: `https://x.com/i/status/${result.data.id}`,
    };
  } catch (error: any) {
    console.error("[Twitter] Reply failed:", error);
    return {
      success: false,
      error: error.message || "Failed to reply",
    };
  }
}

/**
 * Get mentions of a handle
 */
export async function getMentions(
  handle: string,
  sinceId?: string
): Promise<{ id: string; text: string; authorId: string }[]> {
  if (MOCK_MODE) {
    return mockGetMentions(handle);
  }

  try {
    // Search for mentions
    const query = `@${handle}`;
    const result = await twitterClient!.v2.search(query, {
      max_results: 10,
      since_id: sinceId,
      "tweet.fields": ["author_id", "created_at"],
    });

    return result.data.data?.map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id || "",
    })) || [];
  } catch (error) {
    console.error("[Twitter] Get mentions failed:", error);
    return [];
  }
}

// ============ Mock Implementation ============

let mockTweetCounter = 1000;
const mockTweets: Map<string, { content: string; handle?: string; replyTo?: string; timestamp: Date }> = new Map();

function mockPostTweet(
  content: string,
  handle?: string,
  replyTo?: string
): TweetResult {
  const tweetId = `mock_${++mockTweetCounter}`;

  mockTweets.set(tweetId, {
    content,
    handle,
    replyTo,
    timestamp: new Date(),
  });

  // Log to console for visibility
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🐦 MOCK TWEET ${handle ? `@${handle}` : ""}`);
  console.log(`${"=".repeat(60)}`);
  console.log(content);
  console.log(`${"=".repeat(60)}\n`);

  return {
    success: true,
    tweetId,
    url: `https://x.com/mock/status/${tweetId}`,
  };
}

function mockGetMentions(_handle: string): { id: string; text: string; authorId: string }[] {
  // Return empty in mock mode (no incoming mentions to process)
  return [];
}

/**
 * Get mock tweets for testing
 */
export function getMockTweets(): Array<{
  id: string;
  content: string;
  handle?: string;
  replyTo?: string;
  timestamp: Date;
}> {
  return Array.from(mockTweets.entries()).map(([id, data]) => ({
    id,
    ...data,
  }));
}

/**
 * Clear mock tweets
 */
export function clearMockTweets(): void {
  mockTweets.clear();
}

/**
 * Check if running in mock mode
 */
export function isMockMode(): boolean {
  return MOCK_MODE;
}
