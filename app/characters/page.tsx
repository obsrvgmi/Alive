"use client";
import { useState, useEffect } from "react";
import Nav from "../_components/Nav";
import Footer from "../_components/Footer";
import CharacterCard from "../_components/CharacterCard";
import { getCharacters, type Character as APICharacter } from "../_lib/api";
import { characters as mockCharacters, type Character as MockCharacter } from "../_lib/characters";

type Filter = "all" | "stable" | "stressed" | "critical";

// Convert API character to display format
function toDisplayCharacter(c: APICharacter): MockCharacter {
  const vit = Math.round(c.vitality / 100); // Convert from basis points
  return {
    name: c.name,
    ticker: c.ticker,
    age: getAge(c.createdAt),
    vit,
    crit: vit < 15,
    q: `"${c.bio?.slice(0, 60) || 'no bio yet'}..."`,
    chips: [],
    ava: getAvatarGradient(c.ticker),
    emoji: getEmoji(c.personality),
    hp: c.vitality,
    holders: c.holders || 0,
    mood: c.mood || c.personality,
    mc: parseFloat(c.marketCap || "0"),
    bio: c.bio || "",
    handle: `@${c.ticker.toLowerCase()}_alive`,
  };
}

function getAge(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours.toString().padStart(2, '0')}h`;
  return `${hours}h`;
}

function getAvatarGradient(ticker: string): string {
  const palettes = [
    ["#c6ff3d", "#ff3da8", "#0a0a0a"],
    ["#ffe14a", "#0a0a0a", "#ff4127"],
    ["#3d6bff", "#c6ff3d", "#0a0a0a"],
    ["#ff3da8", "#ffe14a", "#0a0a0a"],
  ];
  const idx = ticker.charCodeAt(0) % palettes.length;
  const p = palettes[idx];
  return `radial-gradient(circle at 50% 50%,${p[2]} 0 18px,transparent 19px),${p[0]}`;
}

function getEmoji(personality: string): string {
  const map: Record<string, string> = {
    FERAL: "🐺",
    COPIUM: "🙏",
    ALPHA: "👑",
    SCHIZO: "👁",
    WHOLESOME: "💕",
    MENACE: "💀",
  };
  return map[personality] || "🔥";
}

export default function CharactersPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"vit" | "mc">("vit");
  const [characters, setCharacters] = useState<MockCharacter[]>(mockCharacters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCharacters() {
      try {
        setLoading(true);
        const apiCharacters = await getCharacters({ limit: 50 });
        if (apiCharacters.length > 0) {
          setCharacters(apiCharacters.map(toDisplayCharacter));
        }
        // If no API characters, keep using mock data
      } catch (err) {
        console.error("Failed to fetch characters:", err);
        setError("Using demo data - backend not connected");
        // Keep using mock data on error
      } finally {
        setLoading(false);
      }
    }
    fetchCharacters();
  }, []);

  const filtered = characters
    .filter((c) => (q ? (c.name + c.ticker).toLowerCase().includes(q.toLowerCase()) : true))
    .filter((c) =>
      filter === "all" ? true : filter === "stable" ? c.vit >= 60 : filter === "stressed" ? c.vit >= 30 && c.vit < 60 : c.vit < 30
    )
    .sort((a, b) => sort === "vit" ? b.vit - a.vit : b.mc - a.mc);

  return (
    <>
      <Nav active="characters" />
      <main className="px-5 sm:px-8 py-10 sm:py-14">
        <div className="max-w-[1200px] mx-auto">
          <div className="mb-8">
            <span className="inline-block font-mono font-extrabold text-[11px] uppercase tracking-wider bg-sun border-[3px] border-ink px-3 py-1.5 shadow-[3px_3px_0_0_#0a0a0a] mb-5">
              {loading ? "Loading..." : `${characters.length} characters · ${characters.filter(c => c.crit).length} critical · live`}
            </span>
            {error && (
              <span className="ml-2 inline-block font-mono text-[10px] uppercase bg-hot text-bone px-2 py-1">
                {error}
              </span>
            )}
            <h1 className="font-display uppercase leading-[.9] tracking-[-.045em] text-[44px] sm:text-[64px] lg:text-[88px]">
              All <span className="text-hot">creatures.</span>
            </h1>
            <p className="mt-4 max-w-[640px] text-base sm:text-[17px] font-medium leading-relaxed opacity-85">
              Every character launched on ALIVE. Click any of them to enter their profile, see their tweets, and feed them vitality.
            </p>
          </div>

          {/* CONTROLS */}
          <div className="flex flex-col md:flex-row gap-3 mb-8">
            <div className="flex-1">
              <label htmlFor="character-search" className="sr-only">Search characters</label>
              <input
                id="character-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="search by name or ticker..."
                className="w-full bg-bone border-[3px] border-ink px-4 py-3 font-mono font-bold text-[13px] outline-none focus:bg-sun"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "stable", "stressed", "critical"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-label={`Filter by ${f} status`}
                  aria-pressed={filter === f}
                  className={`font-mono font-extrabold text-[11px] uppercase px-3 py-2 border-[3px] border-ink shadow-[3px_3px_0_0_#0a0a0a] transition ${
                    filter === f ? "bg-acid" : "bg-bone hover:bg-sun"
                  }`}
                >
                  {f}
                </button>
              ))}
              <label htmlFor="character-sort" className="sr-only">Sort characters</label>
              <select
                id="character-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as "vit" | "mc")}
                className="font-mono font-extrabold text-[11px] uppercase px-3 py-2 border-[3px] border-ink bg-bone shadow-[3px_3px_0_0_#0a0a0a]"
              >
                <option value="vit">sort: vitality</option>
                <option value="mc">sort: market cap</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="border-[3px] border-ink p-10 text-center font-mono text-[12px] font-extrabold uppercase opacity-75 bg-bone shadow-[6px_6px_0_0_#0a0a0a] animate-pulse">
              Loading characters...
            </div>
          ) : filtered.length === 0 ? (
            <div className="border-[3px] border-ink p-10 text-center font-mono text-[12px] font-extrabold uppercase opacity-75 bg-bone shadow-[6px_6px_0_0_#0a0a0a]">
              No characters match your current filters. Try adjusting your search or selecting a different status.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((c) => (
                <CharacterCard key={c.ticker} c={c} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
