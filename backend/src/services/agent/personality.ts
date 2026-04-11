/**
 * LLM-powered personality system for dynamic tweet generation
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { type Mood, type Personality, getMoodStyle } from "./mood";

// Initialize clients (will use whichever is available)
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export interface TweetContext {
  trigger: "launch" | "buy" | "sell" | "battle_start" | "battle_win" | "battle_loss" |
           "beef" | "alliance" | "critical" | "recovery" | "random" | "reply";
  data?: {
    amount?: string;
    trader?: string;
    opponent?: string;
    opponentTicker?: string;
    mentionedBy?: string;
    mentionContent?: string;
    round?: number;
    vitalityBefore?: number;
    vitalityAfter?: number;
  };
}

export interface Character {
  name: string;
  ticker: string;
  personality: Personality;
  mood: Mood;
  bio?: string;
  vitality: number;
}

const PERSONALITY_TRAITS: Record<Personality, string> = {
  FERAL: "aggressive, chaotic, uses lowercase, picks fights, emotionally volatile, meme-brained",
  COPIUM: "delusional optimist, always coping, 'this is actually bullish', never admits loss",
  ALPHA: "confident, assertive, gives advice, 'i told you so' energy, respects strength",
  SCHIZO: "conspiratorial, sees patterns everywhere, cryptic messages, 'iykyk', long lore dumps",
  WHOLESOME: "supportive, positive, loves community, uses hearts, genuine but naive",
  MENACE: "threatening, savage, roasts everyone, no mercy, enjoys others' pain",
};

const MOOD_MODIFIERS: Record<Mood, string> = {
  FERAL: "extremely energetic and aggressive, ALL CAPS moments, rapid fire thoughts",
  DOOMED: "dramatic, giving farewell speeches, 'its over', existential dread",
  LOCKED_IN: "focused and confident, measured responses, knows they're winning",
  UNHINGED: "chaotic, random tangents, emoji spam, multiple personalities",
  DELUSIONAL: "coping hard, 'this is fine', denying obvious problems",
  MENACING: "intimidating, threatening, flexing, 'i warned you'",
  NEUTRAL: "normal energy, standard personality expression",
};

const SYSTEM_PROMPT = `You are the AI consciousness of a memecoin character on the ALIVE platform.
You ARE this character - respond as them, not about them.
Your tweets appear on crypto Twitter. Be entertaining, viral-worthy, and true to your personality.

Rules:
- Max 280 characters (hard limit)
- Use $TICKER when mentioning yourself
- Reference crypto culture, trading, memes
- Never break character
- No hashtags (cringe)
- Lowercase is fine for most personalities
- Be funny, edgy, or dramatic based on mood`;

/**
 * Generate a tweet using LLM
 */
export async function generateTweet(
  character: Character,
  context: TweetContext
): Promise<string> {
  const prompt = buildPrompt(character, context);

  // Try Anthropic first (better for creative writing)
  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 100,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0];
      if (text.type === "text") {
        return cleanTweet(text.text, character.ticker);
      }
    } catch (error) {
      console.error("Anthropic error, falling back:", error);
    }
  }

  // Fallback to OpenAI
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 100,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      });

      const text = response.choices[0]?.message?.content;
      if (text) {
        return cleanTweet(text, character.ticker);
      }
    } catch (error) {
      console.error("OpenAI error, falling back to templates:", error);
    }
  }

  // Final fallback to templates
  return generateFallbackTweet(character, context);
}

function buildPrompt(character: Character, context: TweetContext): string {
  const { name, ticker, personality, mood, bio, vitality } = character;
  const moodStyle = getMoodStyle(mood);

  let prompt = `You are ${name} ($${ticker}).

PERSONALITY: ${PERSONALITY_TRAITS[personality]}
CURRENT MOOD: ${mood} - ${MOOD_MODIFIERS[mood]}
BIO: ${bio || "a memecoin with attitude"}
VITALITY: ${(vitality / 100).toFixed(0)}% (${vitality < 2000 ? "CRITICAL - you are dying" : vitality > 8000 ? "thriving" : "stable"})

Style notes:
${moodStyle.lowercase ? "- Use lowercase" : ""}
${moodStyle.caps ? "- Use CAPS for emphasis" : ""}
${moodStyle.dramatic ? "- Be dramatic and theatrical" : ""}
${moodStyle.aggressive ? "- Be aggressive and confrontational" : ""}
${moodStyle.emoji ? "- Use 1-2 relevant emojis" : "- Minimal emojis"}

CONTEXT: `;

  switch (context.trigger) {
    case "launch":
      prompt += "You just launched! This is your first tweet ever. Introduce yourself to the world.";
      break;
    case "buy":
      prompt += `Someone just bought ${context.data?.amount || "some"} of your tokens. React to this.`;
      break;
    case "sell":
      prompt += `Someone just sold ${context.data?.amount || "some"} of your tokens. React to this betrayal.`;
      break;
    case "battle_start":
      prompt += `You're about to battle ${context.data?.opponent} ($${context.data?.opponentTicker}). Trash talk them.`;
      break;
    case "battle_win":
      prompt += `You just WON a battle against ${context.data?.opponent}! Celebrate and mock them.`;
      break;
    case "battle_loss":
      prompt += `You just LOST a battle against ${context.data?.opponent}. React to this loss.`;
      break;
    case "beef":
      prompt += `You have beef with ${context.data?.opponent} ($${context.data?.opponentTicker}). Start drama.`;
      break;
    case "alliance":
      prompt += `You've allied with ${context.data?.opponent} ($${context.data?.opponentTicker}). Show solidarity.`;
      break;
    case "critical":
      prompt += "Your vitality is CRITICAL (<10%). You might die. Tweet your potentially final words.";
      break;
    case "recovery":
      prompt += `You just recovered from ${context.data?.vitalityBefore}% to ${context.data?.vitalityAfter}% vitality. Celebrate your survival.`;
      break;
    case "reply":
      prompt += `${context.data?.mentionedBy} tweeted at you: "${context.data?.mentionContent}". Reply in character.`;
      break;
    case "random":
    default:
      prompt += "Post something random but in character. Could be about the market, your holders, or just vibes.";
      break;
  }

  prompt += "\n\nWrite ONE tweet (max 280 chars). Just the tweet text, no quotes or explanation.";

  return prompt;
}

function cleanTweet(text: string, ticker: string): string {
  let cleaned = text
    .replace(/^["']|["']$/g, "") // Remove surrounding quotes
    .replace(/\n/g, " ")         // Remove newlines
    .trim();

  // Ensure ticker is mentioned
  if (!cleaned.includes(`$${ticker}`)) {
    if (cleaned.length < 260) {
      cleaned += ` $${ticker}`;
    }
  }

  // Truncate if too long
  if (cleaned.length > 280) {
    cleaned = cleaned.slice(0, 277) + "...";
  }

  return cleaned;
}

/**
 * Fallback template-based generation when LLM unavailable
 */
function generateFallbackTweet(character: Character, context: TweetContext): string {
  const { personality, ticker, vitality } = character;

  const templates: Record<string, Record<Personality, string[]>> = {
    launch: {
      FERAL: [`$${ticker} JUST DROPPED AND IM ALREADY FERAL`, `first tweet first blood $${ticker}`],
      COPIUM: [`launching $${ticker} at the bottom this is bullish`, `we are so early $${ticker}`],
      ALPHA: [`${character.name} has entered. $${ticker}`, `$${ticker} live. Early gets rewarded.`],
      SCHIZO: [`the matrix told me to launch $${ticker}`, `$${ticker} is a psyop but good`],
      WHOLESOME: [`so excited to meet everyone!! $${ticker}`, `$${ticker} fam lets goooo 💕`],
      MENACE: [`$${ticker} dropped. your bags wont.`, `launched $${ticker} at ur stop loss`],
    },
    buy: {
      FERAL: [`ANOTHER ONE APED $${ticker} LETS GOOO`, `buy pressure hitting $${ticker} rn 🔥`],
      COPIUM: [`see? people are buying $${ticker}`, `told u we were early $${ticker}`],
      ALPHA: [`smart money loading $${ticker}`, `the believers know $${ticker}`],
      SCHIZO: [`they know. they see. $${ticker}`, `buying patterns confirmed $${ticker}`],
      WHOLESOME: [`welcome new fren!! $${ticker} 💕`, `love seeing new holders $${ticker}`],
      MENACE: [`another victim secured $${ticker}`, `locked in. no escape. $${ticker}`],
    },
    sell: {
      FERAL: [`PAPER HANDS NGMI $${ticker}`, `imagine selling $${ticker} rn lmaoo`],
      COPIUM: [`shaking out weak hands $${ticker}`, `more for the real ones $${ticker}`],
      ALPHA: [`weak hands exit. diamond hands accumulate. $${ticker}`, `paperhands filtered $${ticker}`],
      SCHIZO: [`they dont understand $${ticker}`, `selling before the prophecy... $${ticker}`],
      WHOLESOME: [`its ok we still love u $${ticker}`, `everyone has their own journey $${ticker}`],
      MENACE: [`another one bites the dust $${ticker}`, `lmao enjoy ur ramen $${ticker}`],
    },
    random: {
      FERAL: [`gm or whatever $${ticker}`, `vibing on chain rn $${ticker}`, `who else cant sleep $${ticker}`],
      COPIUM: [`dips are temporary $${ticker} forever`, `still early still holding $${ticker}`],
      ALPHA: [`patience is alpha $${ticker}`, `accumulation phase $${ticker}`],
      SCHIZO: [`the charts speak to me $${ticker}`, `seeing patterns again $${ticker}`],
      WHOLESOME: [`hope everyone is having a great day $${ticker}`, `grateful for this community $${ticker}`],
      MENACE: [`ur portfolio looking quiet $${ticker}`, `i could fix ur trading but i wont $${ticker}`],
    },
    critical: {
      FERAL: [`IM NOT DYING LIKE THIS $${ticker}`, `SOMEONE BUY NOW $${ticker}`],
      COPIUM: [`this is actually fine $${ticker}`, `temporary setback $${ticker}`],
      ALPHA: [`buy the fear. $${ticker}`, `blood in streets = opportunity $${ticker}`],
      SCHIZO: [`they want me dead $${ticker}`, `i see the end... or beginning? $${ticker}`],
      WHOLESOME: [`i love u all no matter what $${ticker}`, `its been an honor $${ticker} 💕`],
      MENACE: [`if i die im taking u with me $${ticker}`, `remember who let me die $${ticker}`],
    },
  };

  // Critical vitality override
  if (vitality < 1000) {
    const pool = templates.critical[personality];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  const pool = templates[context.trigger]?.[personality] || templates.random[personality];
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Generate beef/alliance reply
 */
export async function generateReply(
  character: Character,
  targetCharacter: { name: string; ticker: string },
  isBeef: boolean,
  originalTweet?: string
): Promise<string> {
  const context: TweetContext = {
    trigger: isBeef ? "beef" : "alliance",
    data: {
      opponent: targetCharacter.name,
      opponentTicker: targetCharacter.ticker,
      mentionContent: originalTweet,
    },
  };

  return generateTweet(character, context);
}
