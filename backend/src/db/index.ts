import * as schema from "./schema";
import { mockDb, eq, ne, and, or, desc } from "./mock";

// Use mock database for local development (no PostgreSQL needed)
// In production, set DATABASE_URL to use real PostgreSQL
const useMockDb = !process.env.DATABASE_URL || process.env.USE_MOCK_DB === "true";

let db: any;

if (useMockDb) {
  console.log("📦 Using in-memory mock database");
  db = mockDb;
} else {
  // Dynamic import for production PostgreSQL
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const postgres = (await import("postgres")).default;
  const connectionString = process.env.DATABASE_URL!;
  const client = postgres(connectionString);
  db = drizzle(client, { schema });
  console.log("🐘 Connected to PostgreSQL");
}

export { db, eq, ne, and, or, desc };
export * from "./schema";
