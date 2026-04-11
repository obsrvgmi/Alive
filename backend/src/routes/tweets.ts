import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, tweetQueue, desc } from "../db";

export const tweetRoutes = new Hono();

// Get all pending tweets
tweetRoutes.get("/pending", async (c) => {
  const tweets = db.query.tweetQueue.findMany({
    where: (t: any) => t.status === "PENDING",
    orderBy: desc(tweetQueue.scheduledFor),
  });

  return c.json({ tweets });
});

// Get recent tweets (all statuses)
tweetRoutes.get("/recent", async (c) => {
  const limit = parseInt(c.req.query("limit") || "50");

  const tweets = db.query.tweetQueue.findMany({
    orderBy: desc(tweetQueue.createdAt),
    limit,
  });

  return c.json({ tweets });
});

// Create a tweet for a character
const createTweetSchema = z.object({
  characterId: z.string().uuid(),
  content: z.string().min(1).max(280),
  context: z.any().optional(),
  scheduledFor: z.string().optional(), // ISO date string
});

tweetRoutes.post("/", zValidator("json", createTweetSchema), async (c) => {
  const data = c.req.valid("json");

  const apiKey = c.req.header("X-API-Key");
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const scheduledFor = data.scheduledFor ? new Date(data.scheduledFor) : new Date();

  const [tweet] = db.insert(tweetQueue).values({
    characterId: data.characterId,
    content: data.content,
    context: data.context,
    scheduledFor,
  }).returning();

  return c.json(tweet);
});

// Generate and create a tweet for a character (AI-powered)
const generateTweetSchema = z.object({
  ticker: z.string(),
  context: z.object({
    trigger: z.string(), // 'launch', 'buy', 'sell', 'battle', 'beef', 'random'
    data: z.any().optional(),
  }).optional(),
});

tweetRoutes.post("/generate", zValidator("json", generateTweetSchema), async (c) => {
  const data = c.req.valid("json");

  // Find the character
  const character = db.query.characters.findFirst({
    where: (char: any) => char.ticker === data.ticker.toUpperCase(),
  });

  if (!character) {
    return c.json({ error: "Character not found" }, 404);
  }

  // Generate tweet based on personality and context
  const trigger = data.context?.trigger || "random";
  const content = generateTweetContent(character, trigger, data.context?.data);

  const [tweet] = db.insert(tweetQueue).values({
    characterId: character.id,
    content,
    context: data.context,
    scheduledFor: new Date(),
    status: "POSTED", // Mark as posted immediately (mock)
    postedAt: new Date(),
  }).returning();

  console.log(`[TWEET] ${character.ticker}: "${content}"`);

  return c.json({
    ...tweet,
    character: {
      name: character.name,
      ticker: character.ticker,
      personality: character.personality,
    },
  });
});

// Mark tweet as posted
tweetRoutes.patch("/:id/posted", async (c) => {
  const id = c.req.param("id");

  const apiKey = c.req.header("X-API-Key");
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const tweet = db.query.tweetQueue.findFirst({
    where: (t: any) => t.id === id,
  });

  if (!tweet) {
    return c.json({ error: "Tweet not found" }, 404);
  }

  return c.json({ success: true, tweet });
});

// Helper: Generate tweet content based on personality
function generateTweetContent(
  character: { name: string; ticker: string; personality: string; bio?: string; vitality: number },
  trigger: string,
  data?: any
): string {
  const { personality, name, ticker, vitality } = character;

  const templates: Record<string, Record<string, string[]>> = {
    launch: {
      FERAL: [
        `$${ticker} JUST DROPPED AND IM ALREADY FERAL 🐺`,
        `who let me on the blockchain NGMI ${ticker} is chaos`,
        `first tweet first blood 💀 $${ticker}`,
      ],
      COPIUM: [
        `launching $${ticker} at the literal bottom of the market this is actually bullish`,
        `$${ticker} just launched and im already up mentally`,
        `we are literally so early $${ticker} wagmi`,
      ],
      ALPHA: [
        `${name} has entered the arena. $${ticker} 📈`,
        `$${ticker} live. Early believers get rewarded.`,
        `The smart money knows. $${ticker}`,
      ],
      SCHIZO: [
        `the matrix told me to launch $${ticker} iykyk`,
        `$${ticker} is actually a psyop but like a good one??`,
        `schizo hours but $${ticker} is real trust`,
      ],
      WHOLESOME: [
        `so excited to meet everyone!! $${ticker} is alive 🌸`,
        `first day being alive and i already love you all $${ticker}`,
        `$${ticker} fam we're gonna make it together 💕`,
      ],
      MENACE: [
        `$${ticker} just dropped. your bags about to be lighter.`,
        `im here to take money and chew gum. and im all out of gum. $${ticker}`,
        `launched $${ticker} at the exact time your stop losses hit`,
      ],
    },
    random: {
      FERAL: [
        `gm or whatever $${ticker} 💀`,
        `im literally just vibing on chain rn`,
        `who else is awake at this hour being unhinged`,
      ],
      COPIUM: [
        `dips are temporary, $${ticker} is forever`,
        `still early. still holding. still coping. 🙏`,
        `red days build character and $${ticker}`,
      ],
      ALPHA: [
        `market looking weak but $${ticker} looking strong`,
        `patience is the ultimate alpha`,
        `accumulation phase. iykyk.`,
      ],
      SCHIZO: [
        `the charts are speaking to me again`,
        `trust the plan (i made it up)`,
        `seeing patterns that dont exist but they actually do`,
      ],
      WHOLESOME: [
        `hope everyone is having a great day!! $${ticker} 💕`,
        `grateful for this community fr fr`,
        `sending positive vibes to all my holders 🌸`,
      ],
      MENACE: [
        `your portfolio looking real quiet today`,
        `i could fix your trading but i wont`,
        `wake up. check charts. laugh. repeat.`,
      ],
    },
  };

  // Low vitality overrides
  if (vitality < 2000) {
    return pickRandom([
      `its over... $${ticker}`,
      `im literally dying but metaphorically also $${ticker}`,
      `gasping for liquidity rn 💀`,
      `tell my holders... i loved them... $${ticker}`,
    ]);
  }

  const pool = templates[trigger]?.[personality] || templates.random[personality] || templates.random.FERAL;
  return pickRandom(pool);
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
