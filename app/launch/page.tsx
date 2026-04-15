"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import Nav from "../_components/Nav";
import Footer from "../_components/Footer";
import Stat from "../_components/Stat";
import FocusTrap from "../_components/FocusTrap";
import { useWallet } from "../_components/WalletProvider";
import { devTokensFromOKB, devPctFromOKB, MAX_DEV_OKB, isValidWalletInput } from "../_lib/curve";
import { validateImageFile, sanitizeLabel } from "../_lib/validation";
import { useLaunch, type LaunchParams } from "../_lib/contracts/hooks";
import { parseEther, type Address } from "viem";
import { uploadMetadata } from "../_lib/api";
import { MAX_BRIEF_LENGTH, MAX_LABEL_LENGTH, MAX_WALLET_LENGTH, LAUNCH_FEE, NETWORK_FEE, ACCEPTED_IMAGE_ACCEPT, MIN_IMAGE_DIM } from "../_lib/constants";
import type { Personality, Candidate, Step, Split, ReviewModalProps } from "../_lib/types";

const PERS_COLOR: Record<Personality, string> = {
  FERAL: "bg-hot",
  COPIUM: "bg-sun",
  ALPHA: "bg-acid",
  SCHIZO: "bg-elec text-bone",
  WHOLESOME: "bg-bone",
  MENACE: "bg-blood text-bone",
};

const palettes = [
  ["#c6ff3d", "#ff3da8", "#0a0a0a"],
  ["#ffe14a", "#0a0a0a", "#ff4127"],
  ["#3d6bff", "#c6ff3d", "#0a0a0a"],
  ["#ff3da8", "#ffe14a", "#0a0a0a"],
  ["#0a0a0a", "#c6ff3d", "#ff3da8"],
  ["#ff4127", "#ffe14a", "#0a0a0a"],
];

function makeAvatar(seed: number) {
  const p = palettes[seed % palettes.length];
  const variants = [
    `radial-gradient(circle at 35% 38%,${p[2]} 0 8px,transparent 9px),radial-gradient(circle at 65% 38%,${p[2]} 0 8px,transparent 9px),radial-gradient(circle at 50% 66%,${p[1]} 0 16px,transparent 17px),${p[0]}`,
    `repeating-conic-gradient(${p[2]} 0 25%,${p[0]} 0 50%)`,
    `radial-gradient(circle at 50% 50%,${p[1]} 0 24px,transparent 25px),linear-gradient(180deg,${p[0]} 50%,${p[2]} 50%)`,
    `conic-gradient(from 45deg,${p[0]},${p[1]},${p[2]},${p[0]})`,
    `radial-gradient(circle at 50% 60%,${p[2]} 0 22px,transparent 23px),${p[0]}`,
    `linear-gradient(135deg,${p[0]} 50%,${p[1]} 50%)`,
  ];
  return variants[seed % variants.length];
}

function generateCandidates(brief: string, refine: string[], n = 4): Candidate[] {
  const base = (brief + " " + refine.join(" ")).trim().toLowerCase() || "mystery";
  const words = base.split(/\s+/).filter(Boolean);
  const root = (words[words.length - 1] || "thing").replace(/[^a-z0-9]/g, "");
  const adj = words[0] || "feral";
  const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const namePool = [cap(root) + "z", cap(adj.slice(0, 4)) + cap(root.slice(0, 4)), cap(root) + "Lord", "Lil " + cap(root)];
  const tickerPool = [
    (root.slice(0, 5) || "TOKEN").toUpperCase(),
    (adj.slice(0, 3) + root.slice(0, 3)).toUpperCase(),
    (root.slice(0, 4) + "X").toUpperCase(),
    ("L" + root.slice(0, 4)).toUpperCase(),
  ];
  const personasFor = (b: string): Personality[] => {
    if (/grumpy|angry|mad|hate|feral/.test(b)) return ["FERAL", "MENACE", "ALPHA", "COPIUM"];
    if (/sad|cry|lonely|cope|doomer/.test(b)) return ["COPIUM", "WHOLESOME", "SCHIZO", "FERAL"];
    if (/chad|alpha|king|boss/.test(b)) return ["ALPHA", "MENACE", "FERAL", "SCHIZO"];
    if (/cute|wholesome|soft/.test(b)) return ["WHOLESOME", "COPIUM", "ALPHA", "FERAL"];
    if (/cat|dog|frog|bear|pet/.test(b)) return ["FERAL", "WHOLESOME", "MENACE", "COPIUM"];
    return ["FERAL", "COPIUM", "ALPHA", "MENACE"];
  };
  const emojisFor = (b: string): string[] => {
    if (/cat/.test(b)) return ["😾", "🐱", "🙀", "😼"];
    if (/dog/.test(b)) return ["🐶", "🐕", "🦴", "🐺"];
    if (/frog/.test(b)) return ["🐸", "🪷", "🟢", "👁"];
    if (/bear/.test(b)) return ["🐻", "🍯", "🐾", "🪓"];
    if (/moon|space|astro/.test(b)) return ["🌚", "🚀", "🛸", "👽"];
    if (/bull/.test(b)) return ["🐂", "🔱", "🔥", "💥"];
    return ["💀", "🔥", "👁", "⚡"];
  };
  const personas = personasFor(base);
  const emojis = emojisFor(base);
  const moods = ["FERAL", "DOOMED", "LOCKED IN", "UNHINGED", "DELUSIONAL", "MENACING"];
  const bios = [
    `${base}. types in lowercase. picks fights with bigger tokens. surprisingly soft about its holders.`,
    `chronically online ${base} with anger issues and a soft spot for losers. references obscure 2014 vines.`,
    `${base}, but make it on-chain. catchphrase incoming. alliances only with the brave.`,
    `the ${base} the timeline deserved. doesn't shut up. sleeps never.`,
  ];
  const tweets = [
    `"hello internet. i'm ${cap(root)}. if u sell me i will appear in ur dreams. that's not a threat that's a feature."`,
    `"day 1. already started a fight. already winning. holders eat tonight."`,
    `"i was made from one sentence. and i'm already funnier than half ur portfolio."`,
    `"some of u are gonna sell me by friday. some of u are gonna be wrong forever."`,
  ];
  const vibes = ["chaos · loyal · loud", "doomer · funny · soft", "alpha · loud · merciless", "schizo · cryptic · long lore"];
  // Seeded jitter from brief content (deterministic within event handler)
  const seedJitter = Math.floor(Math.random() * 9);
  return Array.from({ length: n }, (_, i) => ({
    name: namePool[i],
    ticker: tickerPool[i].slice(0, 6),
    bio: bios[i],
    personality: personas[i],
    mood: moods[(i + base.length + seedJitter) % moods.length],
    avatar: makeAvatar(i + base.length + seedJitter),
    emoji: emojis[(i + seedJitter) % emojis.length],
    firstTweet: tweets[i],
    vibe: vibes[i],
  }));
}

const REFINE_CHIPS = ["more feral", "more wholesome", "less cute", "more schizo", "make it french", "more menace", "doomer arc"];

export default function LaunchPage() {
  const { wallet, openModal } = useWallet();
  const { launch, hash, isPending, isConfirming, isSuccess, error: launchError } = useLaunch();

  const [step, setStep] = useState<Step>("brief");
  const [brief, setBrief] = useState("");
  const [refine, setRefine] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [devBuy, setDevBuy] = useState(0);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [imgWarn, setImgWarn] = useState<string | null>(null);
  const [splits, setSplits] = useState<Split[]>([
    { wallet: "you (creator)", pct: 100, label: "creator" },
  ]);
  const [progress, setProgress] = useState<{ step: number; label: string }>({ step: 0, label: "" });
  const [launchedToken, setLaunchedToken] = useState<{ addr: string; ts: number } | null>(null);
  const [launchInitiated, setLaunchInitiated] = useState(false);

  // Watch for transaction hash (user signed)
  useEffect(() => {
    if (launchInitiated && hash) {
      setProgress({ step: 3, label: "confirming on blockchain..." });
    }
  }, [hash, launchInitiated]);

  // Watch for transaction success
  useEffect(() => {
    if (launchInitiated && isSuccess && hash) {
      setProgress({ step: 4, label: "token launched!" });
      setLaunchedToken({
        addr: hash,
        ts: Date.now(),
      });
      setStep("done");
      setLaunchInitiated(false);
    }
  }, [isSuccess, hash, launchInitiated]);

  // Watch for launch errors
  useEffect(() => {
    if (launchInitiated && launchError) {
      const msg = launchError.message || "Transaction failed";
      // Check for user rejection
      if (msg.includes("rejected") || msg.includes("denied") || msg.includes("cancelled")) {
        setError("Transaction cancelled by user");
      } else {
        setError(msg);
      }
      setStep("review");
      setLaunchInitiated(false);
    }
  }, [launchError, launchInitiated]);

  // Watch for pending state (wallet is open)
  useEffect(() => {
    if (launchInitiated && isPending) {
      setProgress({ step: 2, label: "confirm in your wallet..." });
    }
  }, [isPending, launchInitiated]);

  // Watch for confirming state (tx submitted, waiting for block)
  useEffect(() => {
    if (launchInitiated && isConfirming) {
      setProgress({ step: 3, label: "mining transaction..." });
    }
  }, [isConfirming, launchInitiated]);

  const totalSplit = splits.reduce((s, x) => s + x.pct, 0);
  const splitOk = totalSplit === 100;
  const splitsValid = splits.every((s, i) => i === 0 || isValidWalletInput(s.wallet));

  const devTokens = useMemo(() => devTokensFromOKB(devBuy), [devBuy]);
  const devPct = useMemo(() => devPctFromOKB(devBuy), [devBuy]);
  const devWarn = devPct > 4;

  const totalCost = useMemo(() => LAUNCH_FEE + devBuy + NETWORK_FEE, [devBuy]);
  const insufficientFunds = wallet ? wallet.balance < totalCost : false;

  // ---- handlers ----
  const onGenerate = () => {
    if (!brief.trim()) return setError("Type a brief first.");
    setError(null);
    setStep("generating");
    setPicked(null);
    setRefine([]);
    setTimeout(() => {
      try {
        setCandidates(generateCandidates(brief, []));
        setStep("pick");
      } catch {
        setError("Generation failed. Try a different brief.");
        setStep("brief");
      }
    }, 1100);
  };

  const onRegenerate = () => {
    setStep("generating");
    setTimeout(() => {
      setCandidates((prev) =>
        generateCandidates(brief, refine).map((nc, i) => (prev[i]?.locked ? prev[i] : nc))
      );
      setStep("pick");
    }, 900);
  };

  const toggleLock = (i: number) => {
    setCandidates((cs) => cs.map((c, j) => (j === i ? { ...c, locked: !c.locked } : c)));
  };

  const toggleRefine = (chip: string) => {
    setRefine((r) => (r.includes(chip) ? r.filter((x) => x !== chip) : [...r, chip]));
  };

  const onImageUpload = (file: File | undefined) => {
    if (!file) return;
    setImgWarn(null);
    const validation = validateImageFile(file);
    if (!validation.valid) return setImgWarn(validation.error!);
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const img = new Image();
      img.onload = () => {
        if (img.width < MIN_IMAGE_DIM || img.height < MIN_IMAGE_DIM) setImgWarn(`warning: under ${MIN_IMAGE_DIM}×${MIN_IMAGE_DIM} — will look fuzzy`);
      };
      img.src = url;
      setCustomImage(url);
    };
    reader.readAsDataURL(file);
  };

  const addSplit = () => setSplits((s) => [...s, { wallet: "", pct: 0, label: "collaborator" }]);
  const removeSplit = (i: number) => setSplits((s) => s.filter((_, j) => j !== i));
  const updateSplit = (i: number, patch: Partial<Split>) =>
    setSplits((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const balanceSplits = () => {
    if (splits.length === 0) return;
    const each = Math.floor(100 / splits.length);
    const rem = 100 - each * splits.length;
    setSplits((s) => s.map((x, i) => ({ ...x, pct: each + (i === 0 ? rem : 0) })));
  };

  const goToReview = () => {
    if (picked === null) return;
    if (!wallet) return openModal();
    if (!splitOk) return setError("Fee splits must total 100%.");
    if (!splitsValid) return setError("One of the wallet addresses is invalid.");
    if (insufficientFunds) return setError("Insufficient OKB in wallet.");
    setError(null);
    setStep("review");
  };

  const confirmLaunch = async () => {
    if (!chosen || !wallet) return;

    setStep("launching");
    setError(null);
    setLaunchInitiated(false);

    try {
      // Step 1: Upload metadata
      setProgress({ step: 0, label: "uploading character metadata" });

      const metadataResult = await uploadMetadata({
        name: chosen.name,
        ticker: chosen.ticker,
        description: chosen.bio,
        image: customImage || chosen.avatar,
        personality: chosen.personality,
        traits: [chosen.mood, chosen.vibe],
      });

      // Step 2: Prepare launch parameters
      setProgress({ step: 1, label: "preparing transaction" });

      const feeRecipients: Address[] = splits
        .filter(s => s.wallet !== "you (creator)" && s.pct > 0)
        .map(s => s.wallet as Address);

      // If no custom recipients, use creator wallet
      if (feeRecipients.length === 0) {
        feeRecipients.push(wallet.address as Address);
      }

      const feeSplits = splits
        .filter(s => s.wallet !== "you (creator)" && s.pct > 0)
        .map(s => BigInt(s.pct * 100)); // Convert to basis points

      // If no custom splits, 100% to creator
      if (feeSplits.length === 0) {
        feeSplits.push(10000n); // 100% in basis points
      }

      const launchParams: LaunchParams = {
        name: chosen.name,
        ticker: chosen.ticker,
        metadataURI: metadataResult.uri,
        feeRecipients,
        feeSplits,
        devBuyAmount: parseEther(devBuy.toString()),
      };

      // Step 3: Call contract - this triggers wallet popup
      setProgress({ step: 2, label: "waiting for wallet signature..." });
      setLaunchInitiated(true);

      // Call launch - this opens wallet, doesn't return promise
      // useEffect hooks above will handle hash/success/error
      launch(launchParams);

    } catch (err: any) {
      console.error("Launch failed:", err);
      setError(err?.message || "Launch failed. Please try again.");
      setStep("review");
      setLaunchInitiated(false);
    }
  };

  const reset = () => {
    setBrief("");
    setRefine([]);
    setCandidates([]);
    setPicked(null);
    setCustomImage(null);
    setImgWarn(null);
    setDevBuy(0);
    setSplits([{ wallet: "you (creator)", pct: 100, label: "creator" }]);
    setLaunchedToken(null);
    setError(null);
    setStep("brief");
  };

  const retryFromError = useCallback(() => {
    setError(null);
    setStep("brief");
  }, []);

  const chosen = picked !== null ? candidates[picked] : null;

  return (
    <>
      <Nav active="launch" />

      <main className="relative z-[1] px-5 sm:px-8 py-10 sm:py-14 pb-32">
        <div className="max-w-[1200px] mx-auto">
          {/* HEADER */}
          <div className="mb-10">
            <span className="inline-block font-mono font-extrabold text-[11px] uppercase tracking-wider bg-sun border-[3px] border-ink px-3 py-1.5 shadow-[3px_3px_0_0_#0a0a0a] mb-5">
              ⚡ AI-assisted launch — 3 words, ship a creature
            </span>
            <h1 className="font-display uppercase leading-[.9] tracking-[-.045em] text-[44px] sm:text-[64px] lg:text-[88px]">
              Just say the<br />
              <span className="bg-acid border-[3px] border-ink shadow-[6px_6px_0_0_#0a0a0a] inline-block px-[.12em]">vibe.</span>
            </h1>
            <p className="mt-5 max-w-[680px] text-base sm:text-[17px] font-medium leading-relaxed opacity-85">
              Type a 3-word brief like <b className="bg-ink text-bone px-1.5 py-0.5">grumpy cat</b>. We generate{" "}
              <b className="bg-ink text-bone px-1.5 py-0.5">4 candidates</b>. Pick one and we mint it.
            </p>
          </div>

          {/* STEPPER */}
          <Stepper step={step} />

          {/* ERROR */}
          {error && (
            <div className="mt-5 border-[3px] border-ink bg-blood text-bone px-4 py-3 font-mono text-[12px] font-extrabold uppercase shadow-[3px_3px_0_0_#0a0a0a] flex items-center justify-between gap-3 flex-wrap" role="alert" aria-live="assertive">
              <span>⚠ {error}</span>
              <button onClick={retryFromError} className="font-mono font-extrabold text-[11px] uppercase px-3 py-1.5 border-[2px] border-bone hover:bg-bone hover:text-ink transition">
                retry
              </button>
            </div>
          )}

          {/* BRIEF */}
          {(step === "brief" || step === "generating" || step === "pick") && (
            <div className="mt-8 border-[3px] border-ink shadow-[6px_6px_0_0_#0a0a0a] bg-bone">
              <div className="flex items-center gap-3 px-4 py-3 border-b-[3px] border-ink bg-sun">
                <span className="font-display text-[22px] bg-ink text-bone px-2.5 leading-none py-1 border-[3px] border-ink">01</span>
                <h2 className="font-display text-[24px] uppercase tracking-[-.02em] leading-none">Brief</h2>
              </div>
              <div className="p-5">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1">
                    <label htmlFor="brief-input" className="sr-only">Character brief</label>
                    <input
                      id="brief-input"
                      value={brief}
                      onChange={(e) => setBrief(e.target.value.slice(0, MAX_BRIEF_LENGTH))}
                      onKeyDown={(e) => e.key === "Enter" && onGenerate()}
                      placeholder="grumpy cat"
                      maxLength={MAX_BRIEF_LENGTH}
                      className="w-full bg-bone border-[3px] border-ink px-4 py-4 font-display text-[24px] sm:text-[28px] uppercase tracking-tight outline-none focus:bg-acid placeholder:opacity-30"
                    />
                  </div>
                  <button
                    onClick={onGenerate}
                    disabled={!brief.trim() || step === "generating"}
                    className="btn-brut !bg-acid disabled:!bg-bone disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {step === "generating" ? "⟳ generating…" : "⟶ generate 4"}
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="font-mono text-[10px] font-extrabold uppercase opacity-50 self-center">try:</span>
                  {["grumpy cat", "doomer frog", "delusional bull", "schizo astronaut", "lonely shiba"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setBrief(s)}
                      className="font-mono font-extrabold text-[11px] uppercase px-2.5 py-1.5 border-[3px] border-ink bg-bone hover:bg-sun shadow-[2px_2px_0_0_#0a0a0a] transition"
                    >
                      ⤷ {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* GENERATING SKELETONS */}
          {step === "generating" && (
            <div className="mt-8" role="status" aria-label="Generating character candidates">
              <div className="font-mono text-[11px] font-extrabold uppercase opacity-75 mb-4 text-center">Generating candidates… this takes about 2 seconds</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="border-[3px] border-ink shadow-[6px_6px_0_0_#0a0a0a] bg-bone p-4 animate-pulse">
                    <div className="h-44 border-[3px] border-ink bg-sun flex items-center justify-center">
                      <span className="font-mono font-extrabold text-[12px] uppercase">⟳ rendering face…</span>
                    </div>
                    <div className="h-5 mt-4 bg-ink/10 border-[3px] border-ink" />
                    <div className="h-3 mt-2 bg-ink/10 border-[3px] border-ink w-2/3" />
                    <div className="h-12 mt-3 bg-ink/10 border-[3px] border-ink" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CANDIDATES */}
          {step === "pick" && candidates.length > 0 && (
            <div className="mt-10">
              <div className="flex justify-between items-end gap-4 flex-wrap mb-5">
                <h3 className="font-display text-[28px] sm:text-[32px] uppercase tracking-[-.02em] leading-none">Pick your creature</h3>
                <button
                  onClick={onRegenerate}
                  className="font-mono font-extrabold text-[11px] uppercase px-3 py-2 border-[3px] border-ink bg-bone hover:bg-sun shadow-[3px_3px_0_0_#0a0a0a] transition"
                >
                  ⟳ regenerate unlocked
                </button>
              </div>

              {/* REFINE CHIPS */}
              <div className="mb-5 flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] font-extrabold uppercase opacity-50">refine:</span>
                {REFINE_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => toggleRefine(chip)}
                    aria-pressed={refine.includes(chip)}
                    className={`font-mono font-extrabold text-[10px] uppercase px-2.5 py-1.5 border-[3px] border-ink shadow-[2px_2px_0_0_#0a0a0a] transition ${
                      refine.includes(chip) ? "bg-acid" : "bg-bone hover:bg-sun"
                    }`}
                  >
                    {refine.includes(chip) ? "✓ " : "+ "}
                    {chip}
                  </button>
                ))}
                {refine.length > 0 && (
                  <button
                    onClick={onRegenerate}
                    className="font-mono font-extrabold text-[10px] uppercase px-2.5 py-1.5 border-[3px] border-ink bg-hot text-ink shadow-[2px_2px_0_0_#0a0a0a]"
                  >
                    apply refine →
                  </button>
                )}
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {candidates.map((c, i) => {
                  const active = picked === i;
                  return (
                    <div
                      key={i}
                      className={`relative bg-bone border-[3px] border-ink transition ${
                        active ? "shadow-[8px_8px_0_0_#c6ff3d] -translate-x-1 -translate-y-1" : "shadow-[6px_6px_0_0_#0a0a0a] hover:-translate-x-0.5 hover:-translate-y-0.5"
                      }`}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleLock(i); }}
                        className={`absolute top-2 right-2 z-10 w-8 h-8 border-[3px] border-ink shadow-[2px_2px_0_0_#0a0a0a] flex items-center justify-center text-[14px] ${
                          c.locked ? "bg-acid" : "bg-bone hover:bg-sun"
                        }`}
                        aria-label={c.locked ? `Unlock ${c.name} — will regenerate` : `Lock ${c.name} — keep on regenerate`}
                        title={c.locked ? "locked — won't regenerate" : "lock to keep on regenerate"}
                      >
                        {c.locked ? "🔒" : "🔓"}
                      </button>
                      <button onClick={() => setPicked(i)} className="text-left w-full" aria-label={`Pick ${c.name} ($${c.ticker})`}>
                        <div className="flex items-center justify-between bg-ink text-bone px-3 py-2 border-b-[3px] border-ink font-mono font-extrabold text-[11px] uppercase">
                          <span>OPTION 0{i + 1}</span>
                          {active && <span className="text-acid">● PICKED</span>}
                        </div>
                        <div className="h-44 border-b-[3px] border-ink relative flex items-center justify-center" style={{ background: c.avatar }} role="img" aria-label={`${c.name} avatar`}>
                          <span className="text-[64px] drop-shadow-[3px_3px_0_#0a0a0a]">{c.emoji}</span>
                          <span className={`absolute top-3 left-3 border-[3px] border-ink px-2.5 py-1 font-mono font-extrabold text-[10px] shadow-[3px_3px_0_0_#0a0a0a] ${PERS_COLOR[c.personality]}`}>
                            {c.personality}
                          </span>
                          <span className="absolute left-3 bottom-2 font-display text-[22px] bg-ink text-bone px-2 py-0.5 border-[3px] border-ink">
                            ${c.ticker}
                          </span>
                        </div>
                        <div className="p-4">
                          <div className="font-display text-[24px] uppercase tracking-[-.02em] leading-none">{c.name}</div>
                          <div className="font-mono text-[10px] font-extrabold opacity-70 mt-1.5 uppercase">{c.vibe}</div>
                          <p className="mt-3 text-[13px] font-semibold leading-snug border-l-[3px] border-ink pl-2.5">{c.bio}</p>
                          <div className="mt-3 bg-sun border-[3px] border-ink p-2.5">
                            <div className="font-mono text-[9px] font-extrabold uppercase opacity-75 mb-1">first tweet draft</div>
                            <p className="text-[12px] font-semibold leading-snug">{c.firstTweet}</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>

              {chosen && (
                <>
                  {/* CUSTOM IMAGE */}
                  <div className="mt-8 border-[3px] border-ink shadow-[6px_6px_0_0_#0a0a0a] bg-bone">
                    <div className="flex items-center gap-3 px-4 py-3 border-b-[3px] border-ink bg-elec text-bone">
                      <span className="font-display text-[22px] bg-bone text-ink px-2.5 leading-none py-1 border-[3px] border-ink">📷</span>
                      <h2 className="font-display text-[24px] uppercase tracking-[-.02em] leading-none">Custom face</h2>
                      <span className="ml-auto font-mono text-[10px] font-extrabold uppercase opacity-80 hidden md:inline">optional · overrides ai face</span>
                    </div>
                    <div className="p-5 grid md:grid-cols-[auto_1fr] gap-5 items-center">
                      <div
                        className="w-32 h-32 border-[3px] border-ink shadow-[3px_3px_0_0_#0a0a0a] flex items-center justify-center text-[56px]"
                        style={
                          customImage
                            ? { backgroundImage: `url(${customImage})`, backgroundSize: "cover", backgroundPosition: "center" }
                            : { background: chosen.avatar }
                        }
                        role="img"
                        aria-label={`${chosen.name} avatar preview`}
                      >
                        {!customImage && chosen.emoji}
                      </div>
                      <div>
                        <label className="btn-brut !bg-acid inline-block cursor-pointer">
                          ⟶ upload png / jpg / gif
                          <input type="file" accept={ACCEPTED_IMAGE_ACCEPT} className="hidden" onChange={(e) => onImageUpload(e.target.files?.[0])} />
                        </label>
                        {customImage && (
                          <button
                            onClick={() => { setCustomImage(null); setImgWarn(null); }}
                            className="ml-3 font-mono font-extrabold text-[11px] uppercase px-3 py-2 border-[3px] border-ink bg-bone hover:bg-hot shadow-[3px_3px_0_0_#0a0a0a] transition"
                          >
                            ⟲ revert
                          </button>
                        )}
                        <div className="mt-3 font-mono text-[10px] font-extrabold uppercase opacity-70">
                          512×512 recommended · max 4MB · square crops best
                        </div>
                        {imgWarn && (
                          <div className="mt-2 inline-block font-mono text-[10px] font-extrabold uppercase bg-blood text-bone border-[3px] border-ink px-2 py-1" role="alert">
                            ⚠ {imgWarn}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* FEE SPLITS */}
                  <div className="mt-8 border-[3px] border-ink shadow-[6px_6px_0_0_#0a0a0a] bg-bone">
                    <div className="flex items-center gap-3 px-4 py-3 border-b-[3px] border-ink bg-acid">
                      <span className="font-display text-[22px] bg-ink text-bone px-2.5 leading-none py-1 border-[3px] border-ink">%</span>
                      <h2 className="font-display text-[24px] uppercase tracking-[-.02em] leading-none">Fee splits</h2>
                      <span className="ml-auto font-mono text-[10px] font-extrabold uppercase opacity-75 hidden md:inline">share creator fees</span>
                    </div>
                    <div className="p-5">
                      <p className="font-mono text-[11px] font-extrabold uppercase opacity-75 mb-4">
                        every trade pays a creator fee. split it with artists, devs, kols. payouts stream live, on-chain.
                      </p>
                      <div className="space-y-3">
                        {splits.map((row, i) => {
                          const valid = i === 0 || isValidWalletInput(row.wallet);
                          return (
                            <div key={i} className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-center">
                              <div className="grid grid-cols-[auto_1fr] gap-2">
                                <div>
                                  <label htmlFor={`split-label-${i}`} className="sr-only">Collaborator role</label>
                                  <input
                                    id={`split-label-${i}`}
                                    value={row.label}
                                    onChange={(e) => updateSplit(i, { label: sanitizeLabel(e.target.value) })}
                                    placeholder="role"
                                    maxLength={MAX_LABEL_LENGTH}
                                    className="bg-bone border-[3px] border-ink px-3 py-2.5 font-mono text-[12px] font-extrabold uppercase outline-none focus:bg-sun w-28"
                                  />
                                </div>
                                <div>
                                  <label htmlFor={`split-wallet-${i}`} className="sr-only">Wallet address</label>
                                  <input
                                    id={`split-wallet-${i}`}
                                    value={row.wallet}
                                    onChange={(e) => updateSplit(i, { wallet: e.target.value })}
                                    placeholder="wallet address or @handle"
                                    maxLength={MAX_WALLET_LENGTH}
                                    className={`w-full bg-bone border-[3px] px-3 py-2.5 font-mono text-[12px] font-bold outline-none focus:bg-sun ${
                                      valid ? "border-ink" : "border-blood"
                                    }`}
                                    disabled={i === 0}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center border-[3px] border-ink bg-bone justify-self-start sm:justify-self-auto">
                                <label htmlFor={`split-pct-${i}`} className="sr-only">Fee percentage</label>
                                <input
                                  id={`split-pct-${i}`}
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={row.pct}
                                  onChange={(e) => updateSplit(i, { pct: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                                  className="w-20 px-3 py-2.5 font-display text-[20px] text-right outline-none bg-bone focus:bg-sun"
                                />
                                <span className="px-2 font-mono font-extrabold text-[12px] opacity-70">%</span>
                              </div>
                              <button
                                onClick={() => removeSplit(i)}
                                disabled={i === 0}
                                className="w-10 h-10 border-[3px] border-ink bg-bone font-display text-[18px] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-hot shadow-[2px_2px_0_0_#0a0a0a] transition"
                                aria-label={`Remove ${row.label} split`}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 flex justify-between items-center flex-wrap gap-3">
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={addSplit} className="font-mono font-extrabold text-[11px] uppercase px-3 py-2 border-[3px] border-ink bg-sun hover:bg-acid shadow-[3px_3px_0_0_#0a0a0a] transition">
                            + add collaborator
                          </button>
                          <button onClick={balanceSplits} className="font-mono font-extrabold text-[11px] uppercase px-3 py-2 border-[3px] border-ink bg-bone hover:bg-sun shadow-[3px_3px_0_0_#0a0a0a] transition">
                            ⚖ split evenly
                          </button>
                        </div>
                        <div className={`font-mono font-extrabold text-[11px] uppercase border-[3px] border-ink px-3 py-2 ${splitOk && splitsValid ? "bg-acid" : "bg-blood text-bone"}`}>
                          total {totalSplit}% {splitOk && splitsValid ? "✓" : !splitOk ? "· must equal 100" : "· bad address"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DEV ALLOCATION */}
                  <div className="mt-8 border-[3px] border-ink shadow-[6px_6px_0_0_#0a0a0a] bg-bone">
                    <div className="flex items-center gap-3 px-4 py-3 border-b-[3px] border-ink bg-hot">
                      <span className="font-display text-[22px] bg-ink text-bone px-2.5 leading-none py-1 border-[3px] border-ink">⚙</span>
                      <h2 className="font-display text-[24px] uppercase tracking-[-.02em] leading-none">Dev allocation</h2>
                      <span className="ml-auto font-mono text-[10px] font-extrabold uppercase opacity-75 hidden md:inline">optional · pump.fun style</span>
                    </div>
                    <div className="p-5 grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
                      <div>
                        <div className="flex justify-between items-baseline mb-2">
                          <label htmlFor="dev-buy-slider" className="font-mono text-[11px] font-extrabold uppercase opacity-75">your buy at launch</label>
                          <span className="font-display text-[28px] sm:text-[32px] tracking-tight">
                            {devBuy.toFixed(2)} <span className="text-[14px] sm:text-[16px] opacity-70">OKB</span>
                          </span>
                        </div>
                        <input
                          id="dev-buy-slider"
                          type="range"
                          min={0}
                          max={MAX_DEV_OKB}
                          step={0.05}
                          value={devBuy}
                          onChange={(e) => setDevBuy(parseFloat(e.target.value))}
                          className="w-full accent-ink h-2"
                        />
                        <div className="flex justify-between font-mono text-[10px] font-extrabold opacity-70 mt-1">
                          <span>0 OKB</span>
                          <span>max {MAX_DEV_OKB} OKB</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-4">
                          {[0, 0.25, 0.5, 1, 2, 5].map((v) => (
                            <button
                              key={v}
                              onClick={() => setDevBuy(v)}
                              className={`font-mono font-extrabold text-[11px] uppercase px-2.5 py-1.5 border-[3px] border-ink shadow-[2px_2px_0_0_#0a0a0a] transition ${
                                devBuy === v ? "bg-acid" : "bg-bone hover:bg-sun"
                              }`}
                            >
                              {v === 0 ? "none" : `${v} OKB`}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="border-[3px] border-ink bg-bone">
                        <div className="px-3 py-2 border-b-[3px] border-ink bg-sun font-mono font-extrabold text-[10px] uppercase">you receive (est)</div>
                        <div className="p-3">
                          <div className="font-display text-[24px] sm:text-[28px] tracking-tight leading-none">
                            {devTokens.toLocaleString()}
                          </div>
                          <div className="font-mono text-[10px] font-extrabold uppercase opacity-70 mt-1">
                            ${chosen.ticker} · {devPct.toFixed(2)}% of supply
                          </div>
                          <div className={`mt-3 font-mono text-[10px] font-extrabold uppercase border-[3px] border-ink px-2 py-1.5 ${devWarn ? "bg-blood text-bone" : "bg-acid"}`}>
                            {devWarn ? "⚠ high dev bag — holders will notice" : devBuy === 0 ? "✓ clean launch · 0 dev bag" : "✓ healthy range"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* CONFIRM BAR */}
              <div className="mt-8 sticky bottom-4 z-40">
                <div className={`border-[3px] border-ink shadow-[6px_6px_0_0_#0a0a0a] p-4 flex items-center justify-between gap-4 flex-wrap transition ${chosen ? "bg-acid" : "bg-bone"}`}>
                  <div className="flex items-center gap-4 min-w-0">
                    {chosen ? (
                      <>
                        <div
                          className="w-14 h-14 border-[3px] border-ink shadow-[3px_3px_0_0_#0a0a0a] flex-none flex items-center justify-center text-[28px]"
                          style={
                            customImage
                              ? { backgroundImage: `url(${customImage})`, backgroundSize: "cover", backgroundPosition: "center" }
                              : { background: chosen.avatar }
                          }
                        >
                          {!customImage && chosen.emoji}
                        </div>
                        <div className="min-w-0">
                          <div className="font-display text-[20px] sm:text-[22px] uppercase leading-none tracking-[-.02em] truncate">
                            {chosen.name} <span className="font-mono text-[12px] opacity-75">${chosen.ticker}</span>
                          </div>
                          <div className="font-mono text-[10px] font-extrabold uppercase opacity-75 mt-1">
                            ≈ {totalCost.toFixed(3)} OKB · dev {devBuy.toFixed(2)} ({devPct.toFixed(1)}%)
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="font-mono text-[12px] font-extrabold uppercase opacity-75">⤷ pick one of the 4 to continue</div>
                    )}
                  </div>
                  <button
                    onClick={goToReview}
                    disabled={picked === null}
                    className="btn-brut !bg-ink !text-bone disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ⟶ {wallet ? "review & launch" : "connect & launch"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* LAUNCHING */}
          {step === "launching" && chosen && (
            <div className="mt-12 border-[3px] border-ink shadow-[8px_8px_0_0_#0a0a0a] bg-bone p-6 sm:p-10">
              <div className="font-mono text-[11px] font-extrabold uppercase opacity-75 mb-2" role="status">⟳ {progress.label}…</div>
              <div className="font-display text-[36px] sm:text-[48px] uppercase tracking-[-.03em]">birthing {chosen.name}</div>
              <div className="mt-6 max-w-md bar h-[18px] border-[3px] border-ink bg-bone relative overflow-hidden">
                <i style={{ width: `${((progress.step + 1) / 5) * 100}%`, transition: "width .5s ease" }} />
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-1.5 max-w-2xl">
                {["mint", "curve", "metadata", "agent", "first tweet"].map((s, i) => (
                  <div
                    key={i}
                    className={`font-mono text-[9px] font-extrabold uppercase border-[3px] border-ink px-2 py-1.5 ${
                      i < progress.step ? "bg-acid" : i === progress.step ? "bg-sun animate-pulse" : "bg-bone opacity-50"
                    }`}
                  >
                    {i + 1}. {s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DONE */}
          {step === "done" && chosen && launchedToken && (
            <div className="mt-12 border-[3px] border-ink shadow-[8px_8px_0_0_#0a0a0a] bg-acid p-6 sm:p-10">
              <span className="inline-block font-mono font-extrabold text-[11px] uppercase tracking-wider bg-ink text-acid border-[3px] border-ink px-3 py-1.5 shadow-[3px_3px_0_0_#0a0a0a]">
                ⚡ ALIVE
              </span>
              <h2 className="font-display uppercase leading-[.9] tracking-[-.03em] text-[40px] sm:text-[64px] lg:text-[84px] mt-4">
                {chosen.name} is breathing.
              </h2>
              <div className="grid md:grid-cols-[auto_1fr] gap-6 mt-8">
                <div
                  className="w-40 h-40 sm:w-44 sm:h-44 border-[3px] border-ink shadow-[6px_6px_0_0_#0a0a0a] flex items-center justify-center text-[80px]"
                  style={
                    customImage
                      ? { backgroundImage: `url(${customImage})`, backgroundSize: "cover", backgroundPosition: "center" }
                      : { background: chosen.avatar }
                  }
                  role="img"
                  aria-label={`${chosen.name} avatar`}
                >
                  {!customImage && chosen.emoji}
                </div>
                <div className="min-w-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 border-[3px] border-ink bg-bone">
                    <Stat k="Ticker" v={`$${chosen.ticker}`} />
                    <Stat k="Vitality" v="100%" mid />
                    <Stat k="Mood" v={chosen.mood} mid />
                    <Stat k="Holders" v="0" />
                  </div>

                  <div className="mt-4 border-[3px] border-ink bg-bone p-3">
                    <div className="font-mono text-[10px] font-extrabold uppercase opacity-70">Token address</div>
                    <div className="font-mono text-[11px] sm:text-[12px] font-bold mt-1 break-all">{launchedToken.addr}</div>
                  </div>

                  <p className="mt-4 text-[14px] sm:text-[15px] font-semibold leading-snug border-l-[3px] border-ink pl-3 bg-bone p-3">
                    First tweet drafted: {chosen.firstTweet}
                  </p>

                  <div className="flex flex-wrap gap-3 mt-5">
                    <Link href={`/c/${chosen.ticker}`} className="btn-brut !bg-bone">⟶ visit profile</Link>
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just birthed ${chosen.name} ($${chosen.ticker}) on @ALIVE 🧬\n\n${chosen.firstTweet}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-brut !bg-ink !text-bone"
                    >
                      𝕏 share on X
                    </a>
                    <button onClick={reset} className="btn-brut !bg-hot">↻ launch another</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* REVIEW MODAL */}
      {step === "review" && chosen && (
        <ReviewModal
          chosen={chosen}
          customImage={customImage}
          devBuy={devBuy}
          devTokens={devTokens}
          devPct={devPct}
          totalCost={totalCost}
          splits={splits}
          balance={wallet?.balance || 0}
          onCancel={() => setStep("pick")}
          onConfirm={confirmLaunch}
        />
      )}

      <Footer />
    </>
  );
}

function ReviewModal({ chosen, customImage, devBuy, devTokens, devPct, totalCost, splits, balance, onCancel, onConfirm }: ReviewModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-ink/70 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-4 overflow-y-auto"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
    >
      <FocusTrap onClose={onCancel}>
        <div className="w-full max-w-lg bg-bone border-[3px] border-ink shadow-[8px_8px_0_0_#0a0a0a] my-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b-[3px] border-ink bg-ink text-bone">
            <div id="review-modal-title" className="font-display text-[18px] uppercase tracking-tight">Review & sign</div>
            <button onClick={onCancel} className="w-7 h-7 border-[2px] border-bone hover:bg-hot transition font-display" aria-label="Close review dialog">×</button>
          </div>
          <div className="p-5 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center gap-4 mb-5">
              <div
                className="w-20 h-20 border-[3px] border-ink shadow-[3px_3px_0_0_#0a0a0a] flex items-center justify-center text-[40px] flex-none"
                style={customImage ? { backgroundImage: `url(${customImage})`, backgroundSize: "cover" } : { background: chosen.avatar }}
                role="img"
                aria-label={`${chosen.name} avatar`}
              >
                {!customImage && chosen.emoji}
              </div>
              <div className="min-w-0">
                <div className="font-display text-[26px] uppercase leading-none tracking-[-.02em]">{chosen.name}</div>
                <div className="font-mono text-[11px] font-extrabold opacity-70 mt-1">${chosen.ticker} · {chosen.personality}</div>
              </div>
            </div>

            <div className="border-[3px] border-ink divide-y-[3px] divide-ink">
              <Row k="Launch fee" v={`${LAUNCH_FEE.toFixed(3)} OKB`} />
              <Row k="Dev buy" v={`${devBuy.toFixed(3)} OKB`} sub={`${devTokens.toLocaleString()} $${chosen.ticker} (${devPct.toFixed(2)}%)`} />
              <Row k="Network" v={`~${NETWORK_FEE} OKB`} />
              <Row k="Total" v={`${totalCost.toFixed(4)} OKB`} big />
            </div>

            <div className="mt-4 border-[3px] border-ink bg-bone">
              <div className="px-3 py-2 border-b-[3px] border-ink bg-sun font-mono font-extrabold text-[10px] uppercase">Fee splits</div>
              <div className="p-3 space-y-1.5">
                {splits.map((s, i) => (
                  <div key={i} className="flex justify-between font-mono text-[11px] font-bold">
                    <span className="opacity-75 uppercase">{s.label}</span>
                    <span>{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 font-mono text-[10px] font-extrabold uppercase opacity-75">
              wallet balance · {balance.toFixed(2)} OKB
            </div>

            <div className="mt-5 flex gap-3 flex-wrap">
              <button onClick={onConfirm} className="btn-brut !bg-acid flex-1">⟶ sign & launch</button>
              <button onClick={onCancel} className="btn-brut">cancel</button>
            </div>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}

function Row({ k, v, sub, big }: { k: string; v: string; sub?: string; big?: boolean }) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <div>
        <div className="font-mono text-[11px] font-extrabold uppercase opacity-75">{k}</div>
        {sub && <div className="font-mono text-[10px] opacity-50 mt-0.5">{sub}</div>}
      </div>
      <div className={`font-display ${big ? "text-[24px]" : "text-[16px]"}`}>{v}</div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step | Step[]; label: string }[] = [
    { id: "brief", label: "01 · Brief" },
    { id: ["generating", "pick"], label: "02 · Pick" },
    { id: ["review", "launching", "done"], label: "03 · Launch" },
  ];
  const isActive = (id: Step | Step[]) => (Array.isArray(id) ? id.includes(step) : id === step);
  return (
    <nav className="flex gap-3 flex-wrap" aria-label="Launch progress">
      {steps.map((s, i) => (
        <div
          key={i}
          className={`font-mono font-extrabold text-[11px] uppercase px-3 py-2 border-[3px] border-ink shadow-[3px_3px_0_0_#0a0a0a] ${
            isActive(s.id) ? "bg-acid" : "bg-bone opacity-60"
          }`}
          aria-current={isActive(s.id) ? "step" : undefined}
        >
          {s.label}
        </div>
      ))}
    </nav>
  );
}
