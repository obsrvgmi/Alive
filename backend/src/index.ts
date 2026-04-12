import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";

import { authRoutes } from "./routes/auth";
import { characterRoutes } from "./routes/characters";
import { battleRoutes } from "./routes/battles";
import { userRoutes } from "./routes/user";
import { metadataRoutes } from "./routes/metadata";
import { tweetRoutes } from "./routes/tweets";
import { agentRoutes } from "./routes/agent";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", prettyJSON());
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "https://alive.xyz",
      "https://assisted-production.up.railway.app",
      /\.railway\.app$/,
    ],
    credentials: true,
  })
);

// Health check
app.get("/", (c) => {
  return c.json({
    name: "ALIVE API",
    version: "0.1.0",
    status: "operational",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (c) => c.json({ status: "ok" }));

// Routes
app.route("/api/auth", authRoutes);
app.route("/api/characters", characterRoutes);
app.route("/api/battles", battleRoutes);
app.route("/api/user", userRoutes);
app.route("/api/metadata", metadataRoutes);
app.route("/api/tweets", tweetRoutes);
app.route("/api/agent", agentRoutes);

// Error handling
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json(
    {
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    },
    500
  );
});

app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

const port = parseInt(process.env.PORT || "3001");

console.log(`🧬 ALIVE API starting on port ${port}`);
console.log(`Environment: NODE_ENV=${process.env.NODE_ENV}, PORT=${process.env.PORT}`);

try {
  const server = Bun.serve({
    port,
    hostname: "0.0.0.0",
    fetch: app.fetch,
  });

  console.log(`✅ Server running at http://${server.hostname}:${server.port}`);

  // Keep the process alive and log heartbeat
  setInterval(() => {
    console.log(`💓 Heartbeat - server still running on port ${port}`);
  }, 30000);
} catch (error) {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
}
