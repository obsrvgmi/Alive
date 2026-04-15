export type Character = {
  name: string;
  ticker: string; // without $
  age: string;
  vit: number;
  crit?: boolean;
  q: string;
  chips: { t: string; c: "blood" | "acid" }[];
  ava: string;
  emoji: string;
  hp: number;
  holders: number;
  mood: string;
  mc: number; // numeric market cap in USD
  bio: string;
  handle: string;
};

/** Format a numeric market cap for display */
export function formatMarketCap(mc: number): string {
  if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(1)}M`;
  if (mc >= 1_000) return `$${Math.round(mc / 1_000)}k`;
  return `$${mc}`;
}

// No mock characters - data comes from API/blockchain
export const characters: Character[] = [];

export const findCharacter = (ticker: string) =>
  characters.find((c) => c.ticker.toLowerCase() === ticker.toLowerCase());
