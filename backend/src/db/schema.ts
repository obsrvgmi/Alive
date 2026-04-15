import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  decimal,
  jsonb,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const personalityEnum = pgEnum("personality", [
  "FERAL",
  "COPIUM",
  "ALPHA",
  "SCHIZO",
  "WHOLESOME",
  "MENACE",
]);

export const moodEnum = pgEnum("mood", [
  "FERAL",
  "DOOMED",
  "LOCKED_IN",
  "UNHINGED",
  "DELUSIONAL",
  "MENACING",
  "NEUTRAL",
]);

export const battleStatusEnum = pgEnum("battle_status", [
  "OPEN",
  "LIVE",
  "RESOLVED",
  "CANCELLED",
]);

export const tweetStatusEnum = pgEnum("tweet_status", [
  "PENDING",
  "POSTED",
  "FAILED",
  "CANCELLED",
]);

export const relationshipTypeEnum = pgEnum("relationship_type", [
  "BEEF",
  "NEUTRAL",
  "ALLIANCE",
]);

// Characters table
export const characters = pgTable("characters", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenAddress: text("token_address").unique().notNull(),
  name: text("name").notNull(),
  ticker: text("ticker").notNull(),
  metadataUri: text("metadata_uri"),
  creator: text("creator").notNull(),

  // Personality & AI
  personality: personalityEnum("personality").notNull().default("FERAL"),
  personalitySeed: text("personality_seed"),
  mood: moodEnum("mood").notNull().default("NEUTRAL"),
  bio: text("bio"),

  // Stats (synced from chain)
  vitality: integer("vitality").notNull().default(10000), // Basis points
  hp: integer("hp").notNull().default(0),
  holders: integer("holders").notNull().default(0),
  marketCap: decimal("market_cap", { precision: 30, scale: 18 }).default("0"),

  // Social
  xHandle: text("x_handle"),
  avatarUrl: text("avatar_url"),

  // Status
  graduated: boolean("graduated").notNull().default(false),
  critical: boolean("critical").notNull().default(false),

  // Agentic Wallet (OKX Onchain OS)
  agenticWalletId: text("agentic_wallet_id"),
  agenticWalletAddress: text("agentic_wallet_address"),
  treasuryBalanceOkb: decimal("treasury_balance_okb", { precision: 30, scale: 18 }).default("0"),
  walletEnabled: boolean("wallet_enabled").notNull().default(false),
  lastWalletSync: timestamp("last_wallet_sync"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Transaction type enum
export const transactionTypeEnum = pgEnum("transaction_type", [
  "earn_fee",      // Earned from trading fees
  "tip_ally",      // Tipped an ally character
  "buy_token",     // Bought a token via DEX
  "battle_stake",  // Staked on a battle
  "pay_action",    // Paid for an action (tweet, etc)
  "receive_tip",   // Received a tip from another character
  "battle_win",    // Won battle winnings
]);

// Character transactions (economy loop)
export const characterTransactions = pgTable("character_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterId: uuid("character_id").references(() => characters.id).notNull(),
  type: transactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 30, scale: 18 }).notNull(),
  tokenAddress: text("token_address"),
  txHash: text("tx_hash"),
  counterparty: text("counterparty"), // Other wallet/character involved
  counterpartyCharacterId: uuid("counterparty_character_id").references(() => characters.id),
  status: text("status").notNull().default("pending"), // pending, confirmed, failed
  metadata: jsonb("metadata"), // Additional context
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Vitality snapshots for time-series
export const vitalitySnapshots = pgTable("vitality_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterId: uuid("character_id").references(() => characters.id).notNull(),
  vitality: integer("vitality").notNull(),
  triggerType: text("trigger_type").notNull(), // 'buy', 'sell', 'decay', 'battle'
  triggerAmount: decimal("trigger_amount", { precision: 30, scale: 18 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relationships between characters
export const relationships = pgTable("relationships", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterA: uuid("character_a").references(() => characters.id).notNull(),
  characterB: uuid("character_b").references(() => characters.id).notNull(),
  type: relationshipTypeEnum("type").notNull().default("NEUTRAL"),
  sentiment: integer("sentiment").notNull().default(0), // -100 to 100
  reason: text("reason"),
  lastInteraction: timestamp("last_interaction").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tweet queue
export const tweetQueue = pgTable("tweet_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  characterId: uuid("character_id").references(() => characters.id).notNull(),
  content: text("content").notNull(),
  context: jsonb("context"), // Battle, trade, beef context
  scheduledFor: timestamp("scheduled_for").notNull(),
  status: tweetStatusEnum("status").notNull().default("PENDING"),
  tweetId: text("tweet_id"), // X tweet ID once posted
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  postedAt: timestamp("posted_at"),
});

// Battles
export const battles = pgTable("battles", {
  id: uuid("id").defaultRandom().primaryKey(),
  onChainId: integer("on_chain_id").unique(),
  characterA: uuid("character_a").references(() => characters.id).notNull(),
  characterB: uuid("character_b").references(() => characters.id).notNull(),
  poolA: decimal("pool_a", { precision: 30, scale: 18 }).default("0"),
  poolB: decimal("pool_b", { precision: 30, scale: 18 }).default("0"),
  roundsCompleted: integer("rounds_completed").notNull().default(0),
  winner: uuid("winner").references(() => characters.id),
  status: battleStatusEnum("status").notNull().default("OPEN"),
  roundResults: jsonb("round_results"), // Array of round winners
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Battle stakes
export const battleStakes = pgTable("battle_stakes", {
  id: uuid("id").defaultRandom().primaryKey(),
  battleId: uuid("battle_id").references(() => battles.id).notNull(),
  staker: text("staker").notNull(), // Wallet address
  backedCharacter: uuid("backed_character").references(() => characters.id).notNull(),
  amount: decimal("amount", { precision: 30, scale: 18 }).notNull(),
  claimed: boolean("claimed").notNull().default(false),
  claimedAmount: decimal("claimed_amount", { precision: 30, scale: 18 }),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Users (for SIWE auth)
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  address: text("address").unique().notNull(),
  nonce: text("nonce"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLogin: timestamp("last_login"),
});

// Sessions
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const characterRelations = relations(characters, ({ many }) => ({
  vitalitySnapshots: many(vitalitySnapshots),
  tweets: many(tweetQueue),
  battlesAsA: many(battles, { relationName: "characterA" }),
  battlesAsB: many(battles, { relationName: "characterB" }),
  transactions: many(characterTransactions),
}));

export const characterTransactionRelations = relations(characterTransactions, ({ one }) => ({
  character: one(characters, {
    fields: [characterTransactions.characterId],
    references: [characters.id],
  }),
  counterpartyChar: one(characters, {
    fields: [characterTransactions.counterpartyCharacterId],
    references: [characters.id],
  }),
}));

export const battleRelations = relations(battles, ({ one, many }) => ({
  charA: one(characters, {
    fields: [battles.characterA],
    references: [characters.id],
  }),
  charB: one(characters, {
    fields: [battles.characterB],
    references: [characters.id],
  }),
  winnerChar: one(characters, {
    fields: [battles.winner],
    references: [characters.id],
  }),
  stakes: many(battleStakes),
}));
