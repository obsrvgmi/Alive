import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, battles, battleStakes, characters, desc } from "../db";

export const battleRoutes = new Hono();

// Get all battles (with optional status filter)
battleRoutes.get("/", async (c) => {
  const status = c.req.query("status");

  let allBattles = db.query.battles.findMany({
    orderBy: desc(battles.createdAt),
  });

  // Filter by status if provided (map frontend status to backend status)
  if (status) {
    const statusMap: Record<string, string> = {
      active: "LIVE",
      pending: "OPEN",
      completed: "RESOLVED",
    };
    const backendStatus = statusMap[status] || status;
    allBattles = allBattles.filter((b: any) => b.status === backendStatus);
  }

  // Enrich with character data
  const enrichedBattles = allBattles.map((battle: any) => {
    const charA = db.query.characters.findFirst({ where: (c: any) => c.id === battle.characterA });
    const charB = db.query.characters.findFirst({ where: (c: any) => c.id === battle.characterB });

    return {
      id: battle.onChainId || battle.id,
      characterA: charA ? { name: charA.name, ticker: charA.ticker, tokenAddress: charA.tokenAddress } : null,
      characterB: charB ? { name: charB.name, ticker: charB.ticker, tokenAddress: charB.tokenAddress } : null,
      poolA: battle.poolA,
      poolB: battle.poolB,
      currentRound: battle.roundsCompleted,
      roundsWonA: ((battle.roundResults || []) as string[]).filter((w: string) => w === battle.characterA).length,
      roundsWonB: ((battle.roundResults || []) as string[]).filter((w: string) => w === battle.characterB).length,
      winner: battle.winner,
      status: battle.status === "LIVE" ? "active" : battle.status === "OPEN" ? "pending" : "completed",
      startTime: battle.startTime,
    };
  });

  return c.json(enrichedBattles);
});

// Get battle by ID
battleRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const battle = db.query.battles.findFirst({
    where: (b: any) => b.id === id || b.onChainId?.toString() === id,
  });

  if (!battle) {
    return c.json({ error: "Battle not found" }, 404);
  }

  const charA = db.query.characters.findFirst({ where: (c: any) => c.id === battle.characterA });
  const charB = db.query.characters.findFirst({ where: (c: any) => c.id === battle.characterB });

  return c.json({
    ...battle,
    charA,
    charB,
  });
});

// Get battles for a specific character
battleRoutes.get("/character/:ticker", async (c) => {
  const ticker = c.req.param("ticker").toUpperCase();

  const character = db.query.characters.findFirst({
    where: (char: any) => char.ticker === ticker,
  });

  if (!character) {
    return c.json({ error: "Character not found" }, 404);
  }

  const characterBattles = db.query.battles.findMany({
    orderBy: desc(battles.createdAt),
  }).filter((b: any) => b.characterA === character.id || b.characterB === character.id);

  return c.json({ battles: characterBattles });
});

// Get user's stakes
battleRoutes.get("/stakes/:address", async (c) => {
  const address = c.req.param("address").toLowerCase();

  const stakes = db.query.battleStakes.findMany({
    where: (s: any) => s.staker === address,
  });

  return c.json({ stakes });
});

// Record stake (called by indexer)
const stakeSchema = z.object({
  battleId: z.string(),
  staker: z.string(),
  backedCharacter: z.string(),
  amount: z.string(),
  txHash: z.string(),
});

battleRoutes.post("/stakes", zValidator("json", stakeSchema), async (c) => {
  const data = c.req.valid("json");

  const apiKey = c.req.header("X-API-Key");
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const battle = db.query.battles.findFirst({
    where: (b: any) => b.id === data.battleId,
  });

  if (!battle) {
    return c.json({ error: "Battle not found" }, 404);
  }

  // Record stake
  const [stake] = db.insert(battleStakes).values({
    battleId: data.battleId,
    staker: data.staker.toLowerCase(),
    backedCharacter: data.backedCharacter,
    amount: data.amount,
    txHash: data.txHash,
  }).returning();

  return c.json(stake);
});

// Resolve round (called by AI resolver)
const resolveRoundSchema = z.object({
  battleId: z.string(),
  round: z.number(),
  winner: z.string(),
  commentary: z.string().optional(),
});

battleRoutes.post("/resolve-round", zValidator("json", resolveRoundSchema), async (c) => {
  const data = c.req.valid("json");

  const apiKey = c.req.header("X-API-Key");
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const battle = db.query.battles.findFirst({
    where: (b: any) => b.id === data.battleId,
  });

  if (!battle) {
    return c.json({ error: "Battle not found" }, 404);
  }

  return c.json({ success: true, roundsCompleted: data.round });
});

// Create battle (called by indexer)
const createBattleSchema = z.object({
  onChainId: z.number(),
  characterA: z.string(),
  characterB: z.string(),
});

battleRoutes.post("/", zValidator("json", createBattleSchema), async (c) => {
  const data = c.req.valid("json");

  const apiKey = c.req.header("X-API-Key");
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const [battle] = db.insert(battles).values({
    onChainId: data.onChainId,
    characterA: data.characterA,
    characterB: data.characterB,
    startTime: new Date(),
  }).returning();

  return c.json(battle);
});

// Battle history
battleRoutes.get("/history", async (c) => {
  const limit = parseInt(c.req.query("limit") || "20");

  const resolvedBattles = db.query.battles.findMany({
    orderBy: desc(battles.endTime),
    limit,
  }).filter((b: any) => b.status === "RESOLVED");

  return c.json({ battles: resolvedBattles });
});
