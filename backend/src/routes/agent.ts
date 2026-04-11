/**
 * Agent control API routes
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  startAgent,
  stopAgent,
  getAgentStatus,
  forceTweet,
  triggerEventTweet,
} from "../services/agent/core";
import { simulateEvent } from "../services/agent/events";
import { getMockTweets, clearMockTweets, isMockMode } from "../services/agent/twitter";
import { db } from "../db";

export const agentRoutes = new Hono();

// Get agent status
agentRoutes.get("/status", (c) => {
  const status = getAgentStatus();
  return c.json(status);
});

// Start the agent
agentRoutes.post("/start", (c) => {
  const interval = parseInt(c.req.query("interval") || "60000");
  startAgent(interval);
  return c.json({ success: true, message: "Agent started", interval });
});

// Stop the agent
agentRoutes.post("/stop", (c) => {
  stopAgent();
  return c.json({ success: true, message: "Agent stopped" });
});

// Force a tweet from a character
const forceTweetSchema = z.object({
  ticker: z.string(),
  trigger: z.enum([
    "launch", "buy", "sell", "battle_start", "battle_win", "battle_loss",
    "beef", "alliance", "critical", "recovery", "random", "reply"
  ]).optional(),
});

agentRoutes.post("/tweet", zValidator("json", forceTweetSchema), async (c) => {
  const { ticker, trigger = "random" } = c.req.valid("json");

  const result = await forceTweet(ticker, trigger);

  if (result.success) {
    return c.json({ success: true, tweet: result.tweet });
  }

  return c.json({ success: false, error: result.error }, 400);
});

// Simulate an event
const simulateSchema = z.object({
  ticker: z.string(),
  event: z.enum(["buy", "sell", "battle_start", "battle_win", "battle_loss", "launch"]),
  data: z.any().optional(),
});

agentRoutes.post("/simulate", zValidator("json", simulateSchema), async (c) => {
  const { ticker, event, data } = c.req.valid("json");

  const result = await simulateEvent(event, ticker, data);

  return c.json(result);
});

// Get mock tweets (for testing)
agentRoutes.get("/mock-tweets", (c) => {
  if (!isMockMode()) {
    return c.json({ error: "Not in mock mode" }, 400);
  }

  const tweets = getMockTweets();
  return c.json({ tweets, count: tweets.length });
});

// Clear mock tweets
agentRoutes.delete("/mock-tweets", (c) => {
  if (!isMockMode()) {
    return c.json({ error: "Not in mock mode" }, 400);
  }

  clearMockTweets();
  return c.json({ success: true });
});

// Bulk generate tweets for all characters
agentRoutes.post("/bulk-tweet", async (c) => {
  const trigger = (c.req.query("trigger") || "random") as any;
  const allCharacters = db.query.characters.findMany({});

  const results: { ticker: string; success: boolean; tweet?: string }[] = [];

  for (const char of allCharacters) {
    const result = await forceTweet(char.ticker, trigger);
    results.push({
      ticker: char.ticker,
      success: result.success,
      tweet: result.tweet,
    });
  }

  return c.json({ results, count: results.length });
});

// Battle-specific tweets
const battleTweetSchema = z.object({
  battleId: z.string(),
  type: z.enum(["start", "round", "end"]),
  round: z.number().optional(),
  winner: z.string().optional(), // ticker of winner
});

agentRoutes.post("/battle-tweet", zValidator("json", battleTweetSchema), async (c) => {
  const { battleId, type, round, winner } = c.req.valid("json");

  const battle = db.query.battles.findFirst({
    where: (b: any) => b.id === battleId || b.onChainId?.toString() === battleId,
  });

  if (!battle) {
    return c.json({ error: "Battle not found" }, 404);
  }

  const charA = db.query.characters.findFirst({ where: (ch: any) => ch.id === battle.characterA });
  const charB = db.query.characters.findFirst({ where: (ch: any) => ch.id === battle.characterB });

  if (!charA || !charB) {
    return c.json({ error: "Battle characters not found" }, 404);
  }

  const results: { ticker: string; tweet?: string }[] = [];

  switch (type) {
    case "start":
      // Both trash talk
      const resultA = await triggerEventTweet(charA.ticker, {
        type: "battle_start",
        data: { opponent: charB.name, opponentTicker: charB.ticker },
      });
      results.push({ ticker: charA.ticker, tweet: resultA.tweet });

      const resultB = await triggerEventTweet(charB.ticker, {
        type: "battle_start",
        data: { opponent: charA.name, opponentTicker: charA.ticker },
      });
      results.push({ ticker: charB.ticker, tweet: resultB.tweet });
      break;

    case "round":
      if (!winner) {
        return c.json({ error: "Winner ticker required for round tweets" }, 400);
      }
      const roundWinner = winner === charA.ticker ? charA : charB;
      const roundLoser = winner === charA.ticker ? charB : charA;

      const roundResult = await triggerEventTweet(roundWinner.ticker, {
        type: "battle_win",
        data: { opponent: roundLoser.name, opponentTicker: roundLoser.ticker, round },
      });
      results.push({ ticker: roundWinner.ticker, tweet: roundResult.tweet });
      break;

    case "end":
      if (!winner) {
        return c.json({ error: "Winner ticker required for end tweets" }, 400);
      }
      const finalWinner = winner === charA.ticker ? charA : charB;
      const finalLoser = winner === charA.ticker ? charB : charA;

      const winResult = await triggerEventTweet(finalWinner.ticker, {
        type: "battle_win",
        data: { opponent: finalLoser.name, opponentTicker: finalLoser.ticker, final: true },
      });
      results.push({ ticker: finalWinner.ticker, tweet: winResult.tweet });

      const loseResult = await triggerEventTweet(finalLoser.ticker, {
        type: "battle_loss",
        data: { opponent: finalWinner.name, opponentTicker: finalWinner.ticker, final: true },
      });
      results.push({ ticker: finalLoser.ticker, tweet: loseResult.tweet });
      break;
  }

  return c.json({ success: true, results });
});
