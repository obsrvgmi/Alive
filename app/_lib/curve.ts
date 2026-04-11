// Toy bonding curve — close enough for UX. Real launch wires to on-chain math.
// y = supply * (1 - 1 / (1 + okb/k))
const TOTAL = 1_000_000_000;
const K = 30;

export function devTokensFromOKB(okb: number): number {
  if (okb <= 0) return 0;
  const frac = 1 - 1 / (1 + okb / K);
  return Math.round(TOTAL * frac);
}

export function devPctFromOKB(okb: number): number {
  return (devTokensFromOKB(okb) / TOTAL) * 100;
}

export const TOTAL_SUPPLY = TOTAL;
export const MAX_DEV_OKB = 5;

// EVM address validation (0x + 40 hex chars). Also accepts @handles.
export function isValidWalletInput(s: string): boolean {
  if (!s) return false;
  if (s.startsWith("@") && s.length > 1) return true;
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}
