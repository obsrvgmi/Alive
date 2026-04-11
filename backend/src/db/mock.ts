/**
 * In-memory mock database for local development
 * Provides same interface as Drizzle ORM but stores data in memory
 */

import { randomUUID } from "crypto";

// Type definitions matching schema
export type Character = {
  id: string;
  tokenAddress: string;
  name: string;
  ticker: string;
  metadataUri?: string;
  creator: string;
  personality: "FERAL" | "COPIUM" | "ALPHA" | "SCHIZO" | "WHOLESOME" | "MENACE";
  personalitySeed?: string;
  mood: string;
  bio?: string;
  vitality: number;
  hp: number;
  holders: number;
  marketCap: string;
  xHandle?: string;
  avatarUrl?: string;
  graduated: boolean;
  critical: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type VitalitySnapshot = {
  id: string;
  characterId: string;
  vitality: number;
  triggerType: string;
  triggerAmount?: string;
  createdAt: Date;
};

export type Battle = {
  id: string;
  onChainId?: number;
  characterA: string;
  characterB: string;
  poolA: string;
  poolB: string;
  roundsCompleted: number;
  winner?: string;
  status: "OPEN" | "LIVE" | "RESOLVED" | "CANCELLED";
  roundResults?: any;
  startTime?: Date;
  endTime?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type BattleStake = {
  id: string;
  battleId: string;
  staker: string;
  backedCharacter: string;
  amount: string;
  claimed: boolean;
  claimedAmount?: string;
  txHash?: string;
  createdAt: Date;
};

export type Tweet = {
  id: string;
  characterId: string;
  content: string;
  context?: any;
  scheduledFor: Date;
  status: "PENDING" | "POSTED" | "FAILED" | "CANCELLED";
  tweetId?: string;
  error?: string;
  createdAt: Date;
  postedAt?: Date;
};

export type User = {
  id: string;
  address: string;
  nonce?: string;
  createdAt: Date;
  lastLogin?: Date;
};

// In-memory storage
class MockStore<T extends { id: string }> {
  private data: Map<string, T> = new Map();

  insert(item: Omit<T, "id"> & { id?: string }): T {
    const id = item.id || randomUUID();
    const record = { ...item, id } as T;
    this.data.set(id, record);
    return record;
  }

  findFirst(predicate: (item: T) => boolean): T | undefined {
    for (const item of this.data.values()) {
      if (predicate(item)) return item;
    }
    return undefined;
  }

  findMany(predicate?: (item: T) => boolean, options?: { limit?: number; orderBy?: "desc" | "asc" }): T[] {
    let results = Array.from(this.data.values());
    if (predicate) {
      results = results.filter(predicate);
    }
    if (options?.orderBy === "desc") {
      results.reverse();
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }
    return results;
  }

  update(id: string, updates: Partial<T>): T | undefined {
    const item = this.data.get(id);
    if (!item) return undefined;
    const updated = { ...item, ...updates };
    this.data.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.data.delete(id);
  }

  clear(): void {
    this.data.clear();
  }
}

// Initialize stores
const characterStore = new MockStore<Character>();
const vitalityStore = new MockStore<VitalitySnapshot>();
const battleStore = new MockStore<Battle>();
const stakeStore = new MockStore<BattleStake>();
const tweetStore = new MockStore<Tweet>();
const userStore = new MockStore<User>();

// No seed data - start with empty database
// Data will be created through API calls

// Export mock database interface matching Drizzle
export const mockDb = {
  query: {
    characters: {
      findFirst: (opts?: { where?: (char: Character) => boolean }) =>
        characterStore.findFirst(opts?.where || (() => true)),
      findMany: (opts?: { orderBy?: any; limit?: number; offset?: number }) =>
        characterStore.findMany(undefined, { limit: opts?.limit }),
    },
    battles: {
      findFirst: (opts?: { where?: (b: Battle) => boolean }) =>
        battleStore.findFirst(opts?.where || (() => true)),
      findMany: (opts?: { orderBy?: any; limit?: number }) =>
        battleStore.findMany(undefined, { limit: opts?.limit }),
    },
    battleStakes: {
      findFirst: (opts?: { where?: (s: BattleStake) => boolean }) =>
        stakeStore.findFirst(opts?.where || (() => true)),
      findMany: (opts?: { where?: (s: BattleStake) => boolean; limit?: number }) =>
        stakeStore.findMany(opts?.where, { limit: opts?.limit }),
    },
    tweetQueue: {
      findFirst: (opts?: { where?: (t: Tweet) => boolean }) =>
        tweetStore.findFirst(opts?.where || (() => true)),
      findMany: (opts?: { where?: (t: Tweet) => boolean; orderBy?: any; limit?: number }) =>
        tweetStore.findMany(opts?.where, { limit: opts?.limit, orderBy: "desc" }),
    },
    vitalitySnapshots: {
      findMany: (opts?: { where?: (v: VitalitySnapshot) => boolean; orderBy?: any; limit?: number }) =>
        vitalityStore.findMany(opts?.where, { limit: opts?.limit, orderBy: "desc" }),
    },
    users: {
      findFirst: (opts?: { where?: (u: User) => boolean }) =>
        userStore.findFirst(opts?.where || (() => true)),
    },
  },

  insert: (table: any) => ({
    values: (data: any) => ({
      returning: () => {
        // Get table name from Drizzle symbol or string
        const drizzleNameSymbol = Symbol.for("drizzle:Name");
        const tableName = table?.[drizzleNameSymbol] || (typeof table === "string" ? table : null);

        if (tableName === "characters") {
          return [characterStore.insert({
            ...data,
            vitality: data.vitality || 5000,
            hp: data.hp || 5000,
            holders: data.holders || 0,
            marketCap: data.marketCap || "0",
            mood: data.mood || "FERAL",
            graduated: false,
            critical: false,
            createdAt: new Date(),
            updatedAt: new Date()
          })];
        }
        if (tableName === "battles") {
          return [battleStore.insert({ ...data, status: data.status || "OPEN", roundsCompleted: 0, poolA: "0", poolB: "0", createdAt: new Date(), updatedAt: new Date() })];
        }
        if (tableName === "battle_stakes") {
          return [stakeStore.insert({ ...data, claimed: false, createdAt: new Date() })];
        }
        if (tableName === "tweet_queue") {
          return [tweetStore.insert({ ...data, status: data.status || "PENDING", createdAt: new Date() })];
        }
        if (tableName === "vitality_snapshots") {
          return [vitalityStore.insert({ ...data, createdAt: new Date() })];
        }
        if (tableName === "users") {
          return [userStore.insert({ ...data, createdAt: new Date() })];
        }
        console.log("Unknown table for insert:", tableName, table);
        return [];
      },
    }),
  }),

  update: (table: any) => ({
    set: (data: any) => ({
      where: (condition: any) => {
        // Simple update - finds first matching and updates
        return Promise.resolve();
      },
    }),
  }),

  // Re-export table references for insert()
  characters: "characters" as const,
  battles: "battles" as const,
  battleStakes: "battleStakes" as const,
  tweetQueue: "tweetQueue" as const,
  vitalitySnapshots: "vitalitySnapshots" as const,
  users: "users" as const,
};

// Helper functions
export const eq = (field: any, value: any) => (item: any) => {
  const fieldName = typeof field === "string" ? field : field.name;
  return item[fieldName] === value;
};

export const desc = (field: any) => "desc" as const;

// Export for compatibility
export { characters, battles, battleStakes, tweetQueue, vitalitySnapshots, users } from "./schema";
