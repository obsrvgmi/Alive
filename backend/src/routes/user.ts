import { Hono } from "hono";
import { db, characters, battleStakes, battles, desc } from "../db";

export const userRoutes = new Hono();

// Get user portfolio (tokens held)
userRoutes.get("/portfolio/:address", async (c) => {
  const address = c.req.param("address").toLowerCase();

  // Get characters created by user
  const createdCharacters = db.query.characters.findMany({
    orderBy: desc(characters.createdAt),
  }).filter((char: any) => char.creator === address);

  return c.json({
    address,
    created: createdCharacters,
    holdings: [], // In production: from indexer
  });
});

// Get user's battle history
userRoutes.get("/battles/:address", async (c) => {
  const address = c.req.param("address").toLowerCase();

  const stakes = db.query.battleStakes.findMany({
    where: (s: any) => s.staker === address,
  });

  // Get unique battle IDs
  const battleIds = [...new Set(stakes.map((s: any) => s.battleId))];

  // Fetch full battle data
  const userBattles = battleIds.map((id) =>
    db.query.battles.findFirst({
      where: (b: any) => b.id === id,
    })
  ).filter(Boolean);

  return c.json({
    stakes,
    battles: userBattles,
  });
});

// Get user stats
userRoutes.get("/stats/:address", async (c) => {
  const address = c.req.param("address").toLowerCase();

  const createdCharacters = db.query.characters.findMany({
    orderBy: desc(characters.createdAt),
  }).filter((char: any) => char.creator === address);

  const stakesResult = db.query.battleStakes.findMany({
    where: (s: any) => s.staker === address,
  });

  // Calculate win/loss from stakes
  const stakesByBattle: Record<string, typeof stakesResult> = {};
  stakesResult.forEach((s: any) => {
    if (!stakesByBattle[s.battleId]) stakesByBattle[s.battleId] = [];
    stakesByBattle[s.battleId].push(s);
  });

  let wins = 0;
  let losses = 0;
  let totalStaked = 0;
  let totalWon = 0;

  for (const battleId of Object.keys(stakesByBattle)) {
    const battle = db.query.battles.findFirst({
      where: (b: any) => b.id === battleId,
    });

    if (battle?.status === "RESOLVED" && battle.winner) {
      const userStakes = stakesByBattle[battleId];
      for (const stake of userStakes) {
        totalStaked += parseFloat(stake.amount);
        if (stake.backedCharacter === battle.winner) {
          wins++;
          if (stake.claimedAmount) {
            totalWon += parseFloat(stake.claimedAmount);
          }
        } else {
          losses++;
        }
      }
    }
  }

  return c.json({
    address,
    charactersCreated: createdCharacters.length,
    battlesParticipated: Object.keys(stakesByBattle).length,
    wins,
    losses,
    winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
    totalStaked: totalStaked.toFixed(4),
    totalWon: totalWon.toFixed(4),
    pnl: (totalWon - totalStaked).toFixed(4),
  });
});
