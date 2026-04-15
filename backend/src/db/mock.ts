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
  // Agentic Wallet fields
  agenticWalletId?: string;
  agenticWalletAddress?: string;
  treasuryBalanceOkb?: string;
  walletEnabled: boolean;
  lastWalletSync?: Date;
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

export type CharacterTransaction = {
  id: string;
  characterId: string;
  type: string;
  amount: string;
  tokenAddress?: string;
  txHash?: string;
  counterparty?: string;
  counterpartyCharacterId?: string;
  status: string;
  metadata?: any;
  createdAt: Date;
};

export type Relationship = {
  id: string;
  characterA: string;
  characterB: string;
  type: "BEEF" | "NEUTRAL" | "ALLIANCE";
  sentiment: number;
  reason?: string;
  lastInteraction?: Date;
  createdAt: Date;
  updatedAt: Date;
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
const transactionStore = new MockStore<CharacterTransaction>();
const relationshipStore = new MockStore<Relationship>();

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
    characterTransactions: {
      findFirst: (opts?: { where?: (t: CharacterTransaction) => boolean }) =>
        transactionStore.findFirst(opts?.where || (() => true)),
      findMany: (opts?: { where?: (t: CharacterTransaction) => boolean; orderBy?: any; limit?: number }) =>
        transactionStore.findMany(opts?.where, { limit: opts?.limit, orderBy: "desc" }),
    },
    relationships: {
      findFirst: (opts?: { where?: (r: Relationship) => boolean }) =>
        relationshipStore.findFirst(opts?.where || (() => true)),
      findMany: (opts?: { where?: (r: Relationship) => boolean; limit?: number }) =>
        relationshipStore.findMany(opts?.where, { limit: opts?.limit }),
    },
  },

  insert: (table: any) => ({
    values: (data: any) => {
      // Get table name from Drizzle - try multiple methods
      const drizzleNameSymbol = Symbol.for("drizzle:Name");
      let tableName = table?.[drizzleNameSymbol]
        || table?._?.name
        || table?._.name
        || (typeof table === "string" ? table : null);

      // Fallback: check the table config for name
      if (!tableName && table?._) {
        const config = table._;
        tableName = config.name || config.tableName;
      }

      // Insert logging (disabled in production)
      // console.log(`[MockDB] INSERT into table: ${tableName || 'UNKNOWN'}`);

      // Perform the insert immediately
      let result: any[] = [];

      if (tableName === "characters") {
        result = [characterStore.insert({
          ...data,
          vitality: data.vitality || 5000,
          hp: data.hp || 5000,
          holders: data.holders || 0,
          marketCap: data.marketCap || "0",
          mood: data.mood || "FERAL",
          graduated: false,
          critical: false,
          walletEnabled: data.walletEnabled || false,
          treasuryBalanceOkb: data.treasuryBalanceOkb || "0",
          createdAt: new Date(),
          updatedAt: new Date()
        })];
      } else if (tableName === "battles") {
        result = [battleStore.insert({ ...data, status: data.status || "OPEN", roundsCompleted: 0, poolA: "0", poolB: "0", createdAt: new Date(), updatedAt: new Date() })];
      } else if (tableName === "battle_stakes") {
        result = [stakeStore.insert({ ...data, claimed: false, createdAt: new Date() })];
      } else if (tableName === "tweet_queue") {
        result = [tweetStore.insert({ ...data, status: data.status || "PENDING", createdAt: new Date() })];
      } else if (tableName === "vitality_snapshots") {
        result = [vitalityStore.insert({ ...data, createdAt: new Date() })];
      } else if (tableName === "users") {
        result = [userStore.insert({ ...data, createdAt: new Date() })];
      } else if (tableName === "character_transactions") {
        result = [transactionStore.insert({ ...data, status: data.status || "pending", createdAt: new Date() })];
      } else if (tableName === "relationships") {
        result = [relationshipStore.insert({ ...data, sentiment: data.sentiment || 0, type: data.type || "NEUTRAL", createdAt: new Date(), updatedAt: new Date() })];
      } else {
        console.log("Unknown table for insert. tableName:", tableName);
      }

      // Return a thenable object that also has returning() method
      return {
        returning: () => result,
        then: (resolve: (val: any) => void) => resolve(result),
      };
    },
  }),

  update: (table: any) => ({
    set: (data: any) => ({
      where: (condition: any) => {
        // Get table name from Drizzle symbol or string
        const drizzleNameSymbol = Symbol.for("drizzle:Name");
        const tableName = table?.[drizzleNameSymbol] || (typeof table === "string" ? table : null);

        // Find matching item and update
        if (tableName === "characters") {
          const items = characterStore.findMany(condition);
          items.forEach(item => {
            characterStore.update(item.id, { ...data, updatedAt: new Date() });
          });
        }
        if (tableName === "battles") {
          const items = battleStore.findMany(condition);
          items.forEach(item => {
            battleStore.update(item.id, { ...data, updatedAt: new Date() });
          });
        }
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
  // Try multiple ways to get the column name from Drizzle column object
  let fieldName: string;
  if (typeof field === "string") {
    fieldName = field;
  } else {
    // Drizzle column objects can have different structures
    fieldName = field.name
      || field._.name
      || field._.config?.name
      || field.config?.name
      || (typeof field.columnType === "string" ? field.mapFromDriverValue?.name : null)
      || "unknown";

    // Convert camelCase to snake_case field might be stored differently
    // Try both the direct fieldName and camelCase version
  }

  // Handle both camelCase (JS) and snake_case (DB) field names
  const camelFieldName = fieldName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

  // Debug (disabled in production)
  // console.log(`[MockDB] eq: fieldName=${fieldName}, camelFieldName=${camelFieldName}, value=${value}`);

  return item[fieldName] === value || item[camelFieldName] === value;
};

export const ne = (field: any, value: any) => (item: any) => {
  const fieldName = typeof field === "string" ? field : field.name;
  return item[fieldName] !== value;
};

export const and = (...conditions: Array<(item: any) => boolean>) => (item: any) => {
  return conditions.every((cond) => cond(item));
};

export const or = (...conditions: Array<(item: any) => boolean>) => (item: any) => {
  return conditions.some((cond) => cond(item));
};

export const desc = (field: any) => "desc" as const;

// Export for compatibility
export { characters, battles, battleStakes, tweetQueue, vitalitySnapshots, users, characterTransactions, relationships } from "./schema";
