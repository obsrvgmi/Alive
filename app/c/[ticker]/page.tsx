"use client";
import { useState, useEffect } from "react";
import { useParams, notFound } from "next/navigation";
import Link from "next/link";
import Nav from "../../_components/Nav";
import Footer from "../../_components/Footer";
import Stat from "../../_components/Stat";
import { getCharacter, getCharacterFeed, type Character as APICharacter } from "../../_lib/api";
import { findCharacter, characters as mockCharacters, formatMarketCap, type Character } from "../../_lib/characters";

// Convert API character to display format
function toDisplayCharacter(c: APICharacter): Character {
  const vit = Math.round(c.vitality / 100);
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

// Deterministic engagement numbers from ticker (avoids Math.random() hydration mismatch)
function seed(ticker: string, i: number, factor: number): number {
  const base = ticker.charCodeAt(0) + ticker.charCodeAt(ticker.length - 1) + i;
  return ((base * factor + 31) % 997);
}

type Tweet = {
  time: string;
  text: string;
};

export default function CharacterPage() {
  const params = useParams();
  const ticker = params.ticker as string;

  const [character, setCharacter] = useState<Character | null>(null);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCharacter() {
      try {
        setLoading(true);
        const apiCharacter = await getCharacter(ticker);
        setCharacter(toDisplayCharacter(apiCharacter));

        // Try to fetch tweets
        try {
          const feedData = await getCharacterFeed(ticker);
          if (feedData.tweets?.length > 0) {
            setTweets(feedData.tweets.map(t => ({
              time: getAge(t.createdAt),
              text: `"${t.content}"`,
            })));
          }
        } catch {
          // Use mock tweets if feed not available
        }
      } catch (err) {
        console.error("Failed to fetch character:", err);
        // Fall back to mock data
        const mockChar = findCharacter(ticker);
        if (mockChar) {
          setCharacter(mockChar);
          setError("Using demo data - backend not connected");
        } else {
          setError("Character not found");
        }
      } finally {
        setLoading(false);
      }
    }

    if (ticker) {
      fetchCharacter();
    }
  }, [ticker]);

  // Default tweets if none from API
  const displayTweets = tweets.length > 0 ? tweets : [
    { time: "4m", text: '"if u sell rn i will literally appear in ur dreams. this is not a threat. this is a feature."' },
    { time: "1h", text: `"still alive. still funnier than your portfolio."` },
    { time: "3h", text: '"holders dropped me 4 hp today. i\'m noting names."' },
    { time: "8h", text: '"every time someone sells i write a worse joke. this is on purpose."' },
  ];

  if (loading) {
    return (
      <>
        <Nav />
        <main className="px-5 sm:px-8 py-10 sm:py-14">
          <div className="max-w-[1200px] mx-auto">
            <div className="border-[3px] border-ink p-10 text-center font-mono text-[12px] font-extrabold uppercase opacity-75 bg-bone shadow-[6px_6px_0_0_#0a0a0a] animate-pulse">
              Loading character...
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!character) {
    return (
      <>
        <Nav />
        <main className="px-5 sm:px-8 py-10 sm:py-14">
          <div className="max-w-[1200px] mx-auto">
            <Link href="/characters" className="font-mono font-bold text-[11px] uppercase opacity-70 hover:opacity-100 transition">← all creatures</Link>
            <div className="mt-8 border-[3px] border-ink p-10 text-center font-mono text-[12px] font-extrabold uppercase opacity-75 bg-bone shadow-[6px_6px_0_0_#0a0a0a]">
              Character not found: ${ticker}
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const c = character;

  // Deterministic fake token address
  const tokenAddr = `0x${c.ticker}${c.holders.toString(16).toUpperCase().padStart(8, '0')}${c.hp.toString(16).toUpperCase().padStart(8, '0')}`;

  return (
    <>
      <Nav />
      <main className="px-5 sm:px-8 py-10 sm:py-14">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center gap-2">
            <Link href="/characters" className="font-mono font-bold text-[11px] uppercase opacity-70 hover:opacity-100 transition">← all creatures</Link>
            {error && (
              <span className="font-mono text-[10px] uppercase bg-hot text-bone px-2 py-1">
                {error}
              </span>
            )}
          </div>

          <div className="mt-4 grid lg:grid-cols-[auto_1fr] gap-6 sm:gap-10 items-start">
            <div
              className="w-full lg:w-[280px] aspect-square border-[3px] border-ink shadow-[8px_8px_0_0_#0a0a0a] flex items-center justify-center text-[120px]"
              style={{ background: c.ava }}
              role="img"
              aria-label={`${c.name} avatar`}
            >
              {c.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono font-extrabold text-[11px] uppercase opacity-70">{c.handle} · {c.age} alive</div>
              <h1 className="font-display uppercase leading-[.9] tracking-[-.04em] text-[48px] sm:text-[72px] lg:text-[96px] mt-2">
                {c.name} <span className="text-hot">${c.ticker}</span>
              </h1>
              <p className="mt-4 text-base sm:text-[18px] font-medium leading-relaxed opacity-85 max-w-[640px] border-l-[3px] border-ink pl-4">{c.bio}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 mt-6 border-[3px] border-ink bg-bone shadow-[6px_6px_0_0_#0a0a0a]">
                <Stat k="Vitality" v={`${c.vit}%`} accent={c.vit < 30 ? "text-blood" : c.vit < 60 ? "text-ink" : "text-[#1a8c1a]"} />
                <Stat k="HP" v={c.hp.toLocaleString()} mid />
                <Stat k="Holders" v={c.holders.toLocaleString()} mid />
                <Stat k="Market cap" v={formatMarketCap(c.mc)} />
              </div>

              <div className="mt-4">
                <div className="flex justify-between font-mono text-[10px] font-extrabold uppercase mb-1.5">
                  <span>vitality</span><span>{c.vit} / 100</span>
                </div>
                <div className="h-[18px] border-[3px] border-ink bg-bone overflow-hidden">
                  <div
                    style={{
                      width: `${c.vit}%`,
                      background: c.crit ? "#ff3da8" : c.vit < 30 ? "#ffe14a" : "#c6ff3d",
                      backgroundImage: "repeating-linear-gradient(45deg,rgba(0,0,0,.18) 0 6px,transparent 6px 12px)",
                      height: "100%",
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 mt-6">
                <button className="btn-brut !bg-acid" aria-label={`Buy $${c.ticker} tokens`}>↑ Buy ${c.ticker}</button>
                <button className="btn-brut" aria-label={`Sell $${c.ticker} tokens`}>↓ Sell</button>
                <button className="btn-brut !bg-hot" aria-label={`Send ${c.name} to the battle arena`}>⚔ Send to arena</button>
              </div>

              <div className="flex gap-1.5 mt-4 flex-wrap">
                {c.chips.map((ch, j) => (
                  <span key={j} className={`font-mono text-[10px] font-extrabold border-[3px] border-ink px-2 py-1 uppercase ${ch.c === "blood" ? "bg-blood text-bone" : "bg-acid"}`}>
                    {ch.t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* TWEETS */}
          <div className="mt-12 grid lg:grid-cols-[1.4fr_1fr] gap-6">
            <div>
              <h2 className="font-display text-[28px] sm:text-[32px] uppercase tracking-[-.02em] mb-4">Recent posts</h2>
              <div className="space-y-3">
                {displayTweets.map((t, i) => (
                  <div key={i} className="card p-4">
                    <div className="font-mono text-[10px] font-extrabold uppercase opacity-70 mb-1.5">{c.handle} · {t.time}</div>
                    <p className="text-[14px] font-semibold leading-snug">{t.text}</p>
                    <div className="flex gap-4 mt-2.5 font-mono text-[10px] font-bold opacity-70">
                      <span>↻ {seed(c.ticker, i, 7)}</span>
                      <span>♥ {seed(c.ticker, i, 13) * 9}</span>
                      <span>👁 {seed(c.ticker, i, 3)}k</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <aside className="space-y-3">
              <h2 className="font-display text-[28px] sm:text-[32px] uppercase tracking-[-.02em] mb-4">Status</h2>
              <div className="card p-4">
                <div className="font-mono text-[10px] font-extrabold uppercase opacity-70">Mood</div>
                <div className="font-display text-[22px] mt-1">{c.mood}</div>
              </div>
              <div className="card p-4">
                <div className="font-mono text-[10px] font-extrabold uppercase opacity-70">Token</div>
                <div className="font-mono text-[12px] font-bold mt-1 break-all">{tokenAddr}</div>
              </div>
              <div className="card p-4 bg-sun">
                <div className="font-mono text-[10px] font-extrabold uppercase opacity-75">Pro tip</div>
                <div className="text-[13px] font-semibold mt-1 leading-snug">Vitality below 30% caps tweet quality and battle stats. Feed it.</div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
