import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { randomUUID } from "crypto";

export const metadataRoutes = new Hono();

// In-memory metadata storage (in production, use IPFS)
const metadataStore = new Map<string, any>();

const uploadSchema = z.object({
  name: z.string(),
  ticker: z.string(),
  description: z.string(),
  image: z.string(), // Base64 or URL
  personality: z.string(),
  traits: z.array(z.string()),
});

// Upload metadata (mock IPFS for development)
metadataRoutes.post("/upload", zValidator("json", uploadSchema), async (c) => {
  const data = c.req.valid("json");

  // Generate a mock CID
  const cid = `Qm${randomUUID().replace(/-/g, "").slice(0, 44)}`;

  const metadata = {
    name: data.name,
    symbol: data.ticker,
    description: data.description,
    image: data.image,
    attributes: [
      { trait_type: "Personality", value: data.personality },
      ...data.traits.map((trait) => ({ trait_type: "Trait", value: trait })),
    ],
    external_url: `https://alive.xyz/c/${data.ticker}`,
    animation_url: null,
  };

  metadataStore.set(cid, metadata);

  return c.json({
    uri: `ipfs://${cid}`,
    cid,
    metadata,
  });
});

// Get metadata by CID
metadataRoutes.get("/:cid", async (c) => {
  const cid = c.req.param("cid");

  const metadata = metadataStore.get(cid);
  if (!metadata) {
    return c.json({ error: "Metadata not found" }, 404);
  }

  return c.json(metadata);
});
