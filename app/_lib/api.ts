/**
 * API client for ALIVE backend
 */

// Get API URL dynamically (handles SSR vs client-side)
function getApiUrl(): string {
  // Check env var first
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  // Client-side: detect production by hostname
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return 'https://backend-production-0e38.up.railway.app';
  }
  // Default for local development
  return 'http://localhost:3001';
}

type FetchOptions = RequestInit & {
  params?: Record<string, string | number>;
};

async function fetcher<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...init } = options;

  const apiUrl = getApiUrl();
  let url = `${apiUrl}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    url += `?${searchParams.toString()}`;
  }

  console.log(`[API] Fetching: ${url}`);

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error(`[API] Error ${response.status}:`, errorData);
      // Backend uses "error" key, but also support "message" for flexibility
      const errorMessage = errorData.error || errorData.message || `API error: ${response.status}`;
      const err = new Error(errorMessage);
      (err as any).status = response.status;
      throw err;
    }

    const data = await response.json();
    console.log(`[API] Success:`, data);
    return data;
  } catch (err) {
    console.error(`[API] Fetch failed for ${url}:`, err);
    throw err;
  }
}

// ============ Character API ============

export type GeneratedCandidate = {
  name: string;
  ticker: string;
  bio: string;
  personality: 'FERAL' | 'COPIUM' | 'ALPHA' | 'SCHIZO' | 'WHOLESOME' | 'MENACE';
  mood: string;
  firstTweet: string;
  avatarSeed: number;
};

export type Character = {
  id: string;
  name: string;
  ticker: string;
  tokenAddress: string;
  personality: string;
  mood: string;
  vitality: number;
  holders: number;
  marketCap: string;
  bio: string;
  metadataURI: string;
  createdAt: string;
};

export async function generateCandidates(
  brief: string,
  refineChips: string[] = []
): Promise<GeneratedCandidate[]> {
  return fetcher<GeneratedCandidate[]>('/api/characters/generate', {
    method: 'POST',
    body: JSON.stringify({ brief, refineChips }),
  });
}

export async function getCharacter(ticker: string): Promise<Character> {
  return fetcher<Character>(`/api/characters/${ticker}`);
}

export async function getCharacters(options?: {
  limit?: number;
  offset?: number;
  sort?: 'vitality' | 'created' | 'holders';
}): Promise<Character[]> {
  const response = await fetcher<{ characters: Character[]; page: number; limit: number }>(
    '/api/characters',
    { params: options as any }
  );
  return response.characters;
}

export async function getCharacterFeed(ticker: string): Promise<{
  tweets: Array<{ id: string; content: string; createdAt: string; tweetId: string }>;
}> {
  return fetcher(`/api/characters/${ticker}/feed`);
}

export async function getVitalityHistory(ticker: string): Promise<{
  history: Array<{ vitality: number; timestamp: string; trigger: string }>;
}> {
  return fetcher(`/api/characters/${ticker}/vitality`);
}

// ============ Battle API ============

export type Battle = {
  id: string;
  characterA: { name: string; ticker: string; tokenAddress: string } | null;
  characterB: { name: string; ticker: string; tokenAddress: string } | null;
  poolA: string;
  poolB: string;
  currentRound: number;
  roundsWonA: number;
  roundsWonB: number;
  winner: string | null;
  status: 'pending' | 'active' | 'completed';
  startTime?: string;
};

export async function getBattles(options?: {
  status?: 'active' | 'completed' | 'pending';
  limit?: number;
}): Promise<Battle[]> {
  return fetcher<Battle[]>('/api/battles', { params: options as any });
}

export async function getBattle(id: number): Promise<Battle> {
  return fetcher<Battle>(`/api/battles/${id}`);
}

// ============ User API ============

export type Portfolio = {
  holdings: Array<{
    tokenAddress: string;
    ticker: string;
    name: string;
    balance: string;
    value: string;
  }>;
  totalValue: string;
};

export async function getPortfolio(address: string): Promise<Portfolio> {
  return fetcher<Portfolio>(`/api/user/${address}/portfolio`);
}

// ============ SIWE Auth ============

export async function getNonce(): Promise<{ nonce: string }> {
  return fetcher('/api/auth/nonce');
}

export async function verifySignature(
  message: string,
  signature: string
): Promise<{ token: string; address: string }> {
  return fetcher('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ message, signature }),
  });
}

// ============ Metadata API ============

export async function uploadMetadata(data: {
  name: string;
  ticker: string;
  description: string;
  image: string; // Base64 or URL
  personality: string;
  traits: string[];
}): Promise<{ uri: string; cid: string }> {
  return fetcher('/api/metadata/upload', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
