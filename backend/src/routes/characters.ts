import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, characters, tweetQueue, vitalitySnapshots, eq, desc } from "../db";
import { generateCharacterCandidates } from "../services/ai-generation";

export const characterRoutes = new Hono();

// Generate character candidates from brief
const generateSchema = z.object({
  brief: z.string().min(1).max(100),
  refineChips: z.array(z.string()).optional(),
});

characterRoutes.post("/generate", zValidator("json", generateSchema), async (c) => {
  const { brief, refineChips = [] } = c.req.valid("json");

  try {
    const candidates = await generateCharacterCandidates(brief, refineChips);
    // Return array directly (frontend expects this format)
    return c.json(candidates.map((cand, i) => ({
      ...cand,
      avatarSeed: i + Date.now(), // For frontend avatar generation
    })));
  } catch (error) {
    console.error("Generation error:", error);
    return c.json({ error: "Failed to generate candidates" }, 500);
  }
});

// Get all characters (paginated)
characterRoutes.get("/", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "20");

  const allCharacters = db.query.characters.findMany({
    orderBy: desc(characters.createdAt),
    limit,
  });

  return c.json({
    characters: allCharacters,
    page,
    limit,
  });
});

// Get character by ticker
characterRoutes.get("/:ticker", async (c) => {
  const ticker = c.req.param("ticker").toUpperCase();

  const character = db.query.characters.findFirst({
    where: (char: any) => char.ticker === ticker,
  });

  if (!character) {
    return c.json({ error: "Character not found" }, 404);
  }

  return c.json(character);
});

// Get character by token address
characterRoutes.get("/address/:address", async (c) => {
  const address = c.req.param("address").toLowerCase();

  const character = db.query.characters.findFirst({
    where: (char: any) => char.tokenAddress === address,
  });

  if (!character) {
    return c.json({ error: "Character not found" }, 404);
  }

  return c.json(character);
});

// Get character's recent tweets/posts
characterRoutes.get("/:ticker/feed", async (c) => {
  const ticker = c.req.param("ticker").toUpperCase();
  const limit = parseInt(c.req.query("limit") || "20");

  const character = db.query.characters.findFirst({
    where: (char: any) => char.ticker === ticker,
  });

  if (!character) {
    return c.json({ error: "Character not found" }, 404);
  }

  const tweets = db.query.tweetQueue.findMany({
    where: (t: any) => t.characterId === character.id,
    orderBy: desc(tweetQueue.createdAt),
    limit,
  });

  return c.json({ tweets });
});

// Get vitality history
characterRoutes.get("/:ticker/vitality", async (c) => {
  const ticker = c.req.param("ticker").toUpperCase();
  const hours = parseInt(c.req.query("hours") || "24");

  const character = db.query.characters.findFirst({
    where: (char: any) => char.ticker === ticker,
  });

  if (!character) {
    return c.json({ error: "Character not found" }, 404);
  }

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const snapshots = db.query.vitalitySnapshots.findMany({
    where: (s: any) => s.characterId === character.id,
    orderBy: desc(vitalitySnapshots.createdAt),
  });

  return c.json({
    currentVitality: character.vitality,
    history: snapshots.filter((s: any) => new Date(s.createdAt) >= since),
  });
});

// Register character (called by indexer after on-chain event)
const registerSchema = z.object({
  tokenAddress: z.string(),
  name: z.string(),
  ticker: z.string(),
  metadataUri: z.string().optional(),
  creator: z.string(),
  personality: z.enum(["FERAL", "COPIUM", "ALPHA", "SCHIZO", "WHOLESOME", "MENACE"]),
  personalitySeed: z.string().optional(),
  bio: z.string().optional(),
});

characterRoutes.post("/register", zValidator("json", registerSchema), async (c) => {
  const data = c.req.valid("json");

  // Check API key for internal use
  const apiKey = c.req.header("X-API-Key");
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const [character] = await db
      .insert(characters)
      .values({
        tokenAddress: data.tokenAddress.toLowerCase(),
        name: data.name,
        ticker: data.ticker.toUpperCase(),
        metadataUri: data.metadataUri,
        creator: data.creator.toLowerCase(),
        personality: data.personality,
        personalitySeed: data.personalitySeed,
        bio: data.bio,
      })
      .returning();

    return c.json(character);
  } catch (error) {
    console.error("Registration error:", error);
    return c.json({ error: "Failed to register character" }, 500);
  }
});

// Update vitality (called by indexer)
const updateVitalitySchema = z.object({
  tokenAddress: z.string(),
  vitality: z.number(),
  triggerType: z.string(),
  triggerAmount: z.string().optional(),
});

characterRoutes.post("/vitality", zValidator("json", updateVitalitySchema), async (c) => {
  const data = c.req.valid("json");

  const apiKey = c.req.header("X-API-Key");
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const character = db.query.characters.findFirst({
    where: (char: any) => char.tokenAddress === data.tokenAddress.toLowerCase(),
  });

  if (!character) {
    return c.json({ error: "Character not found" }, 404);
  }

  // Update character vitality (mock db handles this differently)
  db.update(characters)
    .set({
      vitality: data.vitality,
      critical: data.vitality < 1500,
      updatedAt: new Date(),
    })
    .where((c: any) => c.id === character.id);

  // Record snapshot
  db.insert(vitalitySnapshots).values({
    characterId: character.id,
    vitality: data.vitality,
    triggerType: data.triggerType,
    triggerAmount: data.triggerAmount,
  }).returning();

  return c.json({ success: true });
});
