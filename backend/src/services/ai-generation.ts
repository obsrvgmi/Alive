import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Personality = "FERAL" | "COPIUM" | "ALPHA" | "SCHIZO" | "WHOLESOME" | "MENACE";

interface CharacterCandidate {
  name: string;
  ticker: string;
  bio: string;
  personality: Personality;
  mood: string;
  emoji: string;
  firstTweet: string;
  vibe: string;
  avatar: string;
}

const SYSTEM_PROMPT = `You are a creative character designer for a memecoin launchpad called ALIVE.
Your job is to generate unique, engaging AI character concepts based on a brief description.

Each character should have:
- A memorable name (1-2 words, catchy)
- A ticker (max 6 uppercase letters)
- A personality type: FERAL, COPIUM, ALPHA, SCHIZO, WHOLESOME, or MENACE
- A short bio (1-2 sentences, lowercase, casual internet voice)
- A mood (FERAL, DOOMED, LOCKED_IN, UNHINGED, DELUSIONAL, MENACING)
- An emoji that represents them
- A first tweet in their voice (use quotes, be funny/edgy)
- A vibe description (3 words separated by ·)

The characters should feel like they could go viral on crypto Twitter.
They're memecoins with AI personalities that post autonomously.
Be creative, funny, and slightly unhinged. Reference internet culture.`;

export async function generateCharacterCandidates(
  brief: string,
  refineChips: string[] = []
): Promise<CharacterCandidate[]> {
  const refineContext = refineChips.length > 0
    ? `\n\nRefine with these traits: ${refineChips.join(", ")}`
    : "";

  const prompt = `Generate 4 unique character candidates based on this brief: "${brief}"${refineContext}

Return a JSON array with 4 objects, each containing:
- name: string
- ticker: string (max 6 chars, uppercase)
- bio: string
- personality: "FERAL" | "COPIUM" | "ALPHA" | "SCHIZO" | "WHOLESOME" | "MENACE"
- mood: "FERAL" | "DOOMED" | "LOCKED_IN" | "UNHINGED" | "DELUSIONAL" | "MENACING"
- emoji: string (single emoji)
- firstTweet: string (in character voice, use quotes)
- vibe: string (3 words like "chaos · loyal · loud")

Each candidate should be distinct but related to the brief.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.9,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in response");
    }

    const parsed = JSON.parse(content);
    let candidates = parsed.candidates || parsed;

    if (!Array.isArray(candidates)) {
      candidates = Object.values(parsed);
    }

    // Generate avatar gradients
    const palettes = [
      ["#c6ff3d", "#ff3da8", "#0a0a0a"],
      ["#ffe14a", "#0a0a0a", "#ff4127"],
      ["#3d6bff", "#c6ff3d", "#0a0a0a"],
      ["#ff3da8", "#ffe14a", "#0a0a0a"],
    ];

    return candidates.slice(0, 4).map((c: any, i: number) => ({
      ...c,
      ticker: c.ticker?.slice(0, 6).toUpperCase() || "TOKEN",
      avatar: `linear-gradient(135deg, ${palettes[i][0]} 0%, ${palettes[i][1]} 50%, ${palettes[i][2]} 100%)`,
    }));
  } catch (error) {
    console.error("AI generation error:", error);

    // Fallback to deterministic generation
    return generateFallbackCandidates(brief, refineChips);
  }
}

function generateFallbackCandidates(
  brief: string,
  refineChips: string[]
): CharacterCandidate[] {
  const base = (brief + " " + refineChips.join(" ")).trim().toLowerCase() || "mystery";
  const words = base.split(/\s+/).filter(Boolean);
  const root = (words[words.length - 1] || "thing").replace(/[^a-z0-9]/g, "");
  const adj = words[0] || "feral";
  const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

  const namePool = [
    cap(root) + "z",
    cap(adj.slice(0, 4)) + cap(root.slice(0, 4)),
    cap(root) + "Lord",
    "Lil " + cap(root),
  ];

  const tickerPool = [
    (root.slice(0, 5) || "TOKEN").toUpperCase(),
    (adj.slice(0, 3) + root.slice(0, 3)).toUpperCase(),
    (root.slice(0, 4) + "X").toUpperCase(),
    ("L" + root.slice(0, 4)).toUpperCase(),
  ];

  const personalities: Personality[] = ["FERAL", "COPIUM", "ALPHA", "MENACE"];
  const moods = ["FERAL", "DOOMED", "LOCKED_IN", "UNHINGED"];
  const emojis = ["💀", "🔥", "👁", "⚡"];
  const vibes = [
    "chaos · loyal · loud",
    "doomer · funny · soft",
    "alpha · loud · merciless",
    "schizo · cryptic · long lore",
  ];

  const bios = [
    `${base}. types in lowercase. picks fights with bigger tokens.`,
    `chronically online ${base} with anger issues.`,
    `${base}, but make it on-chain. catchphrase incoming.`,
    `the ${base} the timeline deserved. sleeps never.`,
  ];

  const tweets = [
    `"hello internet. i'm ${cap(root)}. if u sell me i will appear in ur dreams."`,
    `"day 1. already started a fight. already winning."`,
    `"i was made from one sentence. and i'm funnier than ur portfolio."`,
    `"some of u are gonna sell me by friday. some of u are wrong forever."`,
  ];

  const palettes = [
    ["#c6ff3d", "#ff3da8", "#0a0a0a"],
    ["#ffe14a", "#0a0a0a", "#ff4127"],
    ["#3d6bff", "#c6ff3d", "#0a0a0a"],
    ["#ff3da8", "#ffe14a", "#0a0a0a"],
  ];

  return Array.from({ length: 4 }, (_, i) => ({
    name: namePool[i],
    ticker: tickerPool[i].slice(0, 6),
    bio: bios[i],
    personality: personalities[i],
    mood: moods[i],
    emoji: emojis[i],
    firstTweet: tweets[i],
    vibe: vibes[i],
    avatar: `linear-gradient(135deg, ${palettes[i][0]} 0%, ${palettes[i][1]} 50%, ${palettes[i][2]} 100%)`,
  }));
}
