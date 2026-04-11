import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { randomUUID, randomBytes } from "crypto";

export const authRoutes = new Hono();

// In-memory session store (for development)
const sessions = new Map<string, { address: string; expiresAt: Date }>();

// Generate nonce for SIWE
authRoutes.get("/nonce", async (c) => {
  const nonce = randomBytes(16).toString("hex");
  return c.json({ nonce });
});

// SIWE verification (simplified for development)
const siweSchema = z.object({
  message: z.string(),
  signature: z.string(),
});

authRoutes.post("/siwe", zValidator("json", siweSchema), async (c) => {
  const { message, signature } = c.req.valid("json");

  try {
    // Parse the SIWE message to extract address
    // In production, use siwe library for full verification
    const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
    if (!addressMatch) {
      return c.json({ error: "Invalid message format" }, 400);
    }

    const address = addressMatch[0].toLowerCase();

    // Create session
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    sessions.set(token, { address, expiresAt });

    return c.json({
      token,
      address,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("SIWE verification error:", error);
    return c.json({ error: "Verification failed" }, 401);
  }
});

// Verify session
authRoutes.get("/session", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "No token provided" }, 401);
  }

  const token = authHeader.slice(7);
  const session = sessions.get(token);

  if (!session || session.expiresAt < new Date()) {
    sessions.delete(token);
    return c.json({ error: "Invalid or expired session" }, 401);
  }

  return c.json({
    address: session.address,
    expiresAt: session.expiresAt.toISOString(),
  });
});

// Logout
authRoutes.post("/logout", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    sessions.delete(token);
  }

  return c.json({ success: true });
});
