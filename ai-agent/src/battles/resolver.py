"""Battle round resolution logic for ALIVE arena."""

import random
from typing import Optional
from dataclasses import dataclass
from openai import AsyncOpenAI

from ..config import settings
from ..personality.types import CharacterContext, Personality
from ..generation.tweets import generate_battle_commentary


openai_client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None


@dataclass
class BattleRound:
    """Result of a single battle round."""
    round_number: int
    winner_address: str
    winner_name: str
    loser_address: str
    loser_name: str
    margin: float  # 0-1, how decisive the win was
    narrative: str  # AI-generated battle description


@dataclass
class BattleResult:
    """Final result of a complete battle."""
    battle_id: int
    winner_address: str
    winner_name: str
    loser_address: str
    loser_name: str
    rounds_won: int
    rounds_lost: int
    total_pool: float
    winner_payout: float
    platform_fee: float


async def resolve_round(
    round_number: int,
    character_a: CharacterContext,
    character_b: CharacterContext,
    pool_a: float,
    pool_b: float,
) -> BattleRound:
    """
    Resolve a single battle round.

    Winner is determined by a weighted random selection based on:
    - Pool sizes (more stakes = higher chance)
    - Vitality levels
    - Personality modifiers
    """

    # Calculate base weights from pools
    total_pool = pool_a + pool_b
    weight_a = pool_a / total_pool if total_pool > 0 else 0.5
    weight_b = pool_b / total_pool if total_pool > 0 else 0.5

    # Vitality modifier (higher vitality = small bonus)
    vitality_mod_a = 1 + (character_a.vitality / 10000) * 0.1  # Up to 10% bonus
    vitality_mod_b = 1 + (character_b.vitality / 10000) * 0.1

    # Personality modifiers for battle
    personality_mods = {
        Personality.FERAL: 1.15,     # Aggressive = good in fights
        Personality.MENACE: 1.12,    # Intimidating presence
        Personality.ALPHA: 1.08,     # Confident
        Personality.SCHIZO: 1.05,    # Unpredictable
        Personality.COPIUM: 0.95,    # Optimism doesn't help in fights
        Personality.WHOLESOME: 0.90, # Too nice
    }

    pers_mod_a = personality_mods.get(character_a.personality, 1.0)
    pers_mod_b = personality_mods.get(character_b.personality, 1.0)

    # Final weights
    final_weight_a = weight_a * vitality_mod_a * pers_mod_a
    final_weight_b = weight_b * vitality_mod_b * pers_mod_b

    # Normalize
    total_weight = final_weight_a + final_weight_b
    prob_a = final_weight_a / total_weight

    # Determine winner
    roll = random.random()
    a_wins = roll < prob_a

    # Calculate margin (how close the roll was)
    if a_wins:
        margin = (prob_a - roll) / prob_a  # Higher margin = more decisive
    else:
        margin = (roll - prob_a) / (1 - prob_a)

    # Generate narrative
    narrative = await generate_battle_narrative(
        round_number=round_number,
        winner=character_a if a_wins else character_b,
        loser=character_b if a_wins else character_a,
        margin=margin,
    )

    if a_wins:
        return BattleRound(
            round_number=round_number,
            winner_address=character_a.ticker,  # Using ticker as address placeholder
            winner_name=character_a.name,
            loser_address=character_b.ticker,
            loser_name=character_b.name,
            margin=margin,
            narrative=narrative,
        )
    else:
        return BattleRound(
            round_number=round_number,
            winner_address=character_b.ticker,
            winner_name=character_b.name,
            loser_address=character_a.ticker,
            loser_name=character_a.name,
            margin=margin,
            narrative=narrative,
        )


async def generate_battle_narrative(
    round_number: int,
    winner: CharacterContext,
    loser: CharacterContext,
    margin: float,
) -> str:
    """Generate an entertaining narrative for a battle round."""

    intensity = "barely" if margin < 0.3 else "decisively" if margin > 0.7 else ""

    prompt = f"""Generate a short, dramatic battle narrative (2-3 sentences) for round {round_number}.

Winner: {winner.name} (${winner.ticker}) - {winner.personality.value} personality
Loser: {loser.name} (${loser.ticker}) - {loser.personality.value} personality
Victory margin: {intensity}

Make it entertaining and fitting for a memecoin battle arena. Reference their personalities.
Keep it under 200 characters. No hashtags."""

    try:
        if openai_client:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=100,
                messages=[
                    {"role": "system", "content": "You are a dramatic battle announcer for a memecoin arena."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.9,
            )
            return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Narrative generation error: {e}")

    # Fallback narratives
    fallbacks = [
        f"{winner.name} lands a devastating blow! {loser.name} staggers back.",
        f"Round {round_number} goes to {winner.name}! {loser.name} didn't see it coming.",
        f"{winner.name} dominates round {round_number}. {loser.name} needs a miracle.",
        f"The crowd goes wild as {winner.name} takes round {round_number}!",
    ]
    return random.choice(fallbacks)


def calculate_battle_winner(rounds: list[BattleRound]) -> tuple[str, str, int, int]:
    """
    Determine overall battle winner from rounds.

    Returns: (winner_address, loser_address, winner_rounds, loser_rounds)
    """
    if not rounds:
        raise ValueError("No rounds to calculate winner from")

    # Count wins per character
    wins = {}
    for r in rounds:
        wins[r.winner_address] = wins.get(r.winner_address, 0) + 1

    # Sort by wins
    sorted_winners = sorted(wins.items(), key=lambda x: x[1], reverse=True)
    winner_address = sorted_winners[0][0]
    winner_rounds = sorted_winners[0][1]

    # Get loser
    loser_address = rounds[0].loser_address if rounds[0].winner_address == winner_address else rounds[0].winner_address
    loser_rounds = len(rounds) - winner_rounds

    return winner_address, loser_address, winner_rounds, loser_rounds


def calculate_payouts(
    total_pool: float,
    platform_fee_pct: float = 0.05,
) -> tuple[float, float]:
    """
    Calculate winner payout and platform fee.

    Returns: (winner_payout, platform_fee)
    """
    platform_fee = total_pool * platform_fee_pct
    winner_payout = total_pool - platform_fee
    return winner_payout, platform_fee
