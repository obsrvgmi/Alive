"""Beef and alliance detection between ALIVE characters."""

from typing import Optional
from dataclasses import dataclass
from enum import Enum
from openai import AsyncOpenAI

from ..config import settings
from ..personality.types import CharacterContext


openai_client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None


class RelationshipType(str, Enum):
    """Type of relationship between characters."""
    BEEF = "beef"          # Hostile
    NEUTRAL = "neutral"    # No strong feelings
    ALLIANCE = "alliance"  # Friendly


@dataclass
class RelationshipUpdate:
    """An update to the relationship between two characters."""
    character_a: str  # ticker
    character_b: str  # ticker
    relationship_type: RelationshipType
    sentiment_score: int  # -100 to +100
    reason: str
    trigger_tweet_id: Optional[str] = None


async def analyze_interaction(
    character_a: CharacterContext,
    character_b: CharacterContext,
    tweet_text: str,
    tweet_author_ticker: str,
) -> Optional[RelationshipUpdate]:
    """
    Analyze a tweet to detect beef or alliance formation.

    Args:
        character_a: First character in potential relationship
        character_b: Second character in potential relationship
        tweet_text: The tweet content to analyze
        tweet_author_ticker: Which character wrote the tweet

    Returns:
        RelationshipUpdate if sentiment detected, None otherwise
    """

    prompt = f"""Analyze this tweet for signs of beef (hostility) or alliance (friendship) between two memecoin characters.

Tweet by ${tweet_author_ticker}:
"{tweet_text}"

Character A: {character_a.name} (${character_a.ticker}) - {character_a.personality.value}
Character B: {character_b.name} (${character_b.ticker}) - {character_b.personality.value}

Respond with ONLY a JSON object:
{{
    "relationship": "beef" | "neutral" | "alliance",
    "sentiment_score": -100 to +100 (negative = hostile, positive = friendly),
    "reason": "brief explanation"
}}

If the tweet doesn't indicate any strong relationship sentiment, use "neutral" with score 0."""

    try:
        if openai_client:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=150,
                messages=[
                    {"role": "system", "content": "You analyze social media interactions between characters for relationship sentiment. Respond only with valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,  # Low temp for consistent analysis
            )

            import json
            result = json.loads(response.choices[0].message.content.strip())

            relationship = RelationshipType(result["relationship"])

            # Only return update if sentiment is significant
            if relationship == RelationshipType.NEUTRAL and abs(result["sentiment_score"]) < 20:
                return None

            return RelationshipUpdate(
                character_a=character_a.ticker,
                character_b=character_b.ticker,
                relationship_type=relationship,
                sentiment_score=result["sentiment_score"],
                reason=result["reason"],
            )

    except Exception as e:
        print(f"Interaction analysis error: {e}")

    return None


async def detect_beef_keywords(tweet_text: str, tickers: list[str]) -> list[str]:
    """
    Quick check for beef-indicating keywords mentioning specific tickers.

    Returns list of mentioned tickers that might be in beef.
    """
    beef_keywords = [
        "mid", "ngmi", "rug", "scam", "dead", "cope", "seethe",
        "ratio", "L", "finished", "over", "rekt", "fraud",
        "fake", "trash", "garbage", "joke", "clown", "pathetic",
    ]

    text_lower = tweet_text.lower()

    # Check if any beef keywords present
    has_beef_keyword = any(kw in text_lower for kw in beef_keywords)
    if not has_beef_keyword:
        return []

    # Find mentioned tickers
    mentioned = []
    for ticker in tickers:
        if f"${ticker.lower()}" in text_lower or ticker.lower() in text_lower:
            mentioned.append(ticker)

    return mentioned


async def detect_alliance_keywords(tweet_text: str, tickers: list[str]) -> list[str]:
    """
    Quick check for alliance-indicating keywords mentioning specific tickers.

    Returns list of mentioned tickers that might be in alliance.
    """
    alliance_keywords = [
        "wagmi", "fren", "based", "king", "queen", "legend",
        "goat", "respect", "love", "support", "holding", "together",
        "ally", "partner", "collab", "team", "homie", "brother", "sister",
    ]

    text_lower = tweet_text.lower()

    # Check if any alliance keywords present
    has_alliance_keyword = any(kw in text_lower for kw in alliance_keywords)
    if not has_alliance_keyword:
        return []

    # Find mentioned tickers
    mentioned = []
    for ticker in tickers:
        if f"${ticker.lower()}" in text_lower or ticker.lower() in text_lower:
            mentioned.append(ticker)

    return mentioned


def should_auto_beef(
    character: CharacterContext,
    potential_target: CharacterContext,
) -> bool:
    """
    Determine if a character should automatically start beef with another.

    Based on personality types and current mood.
    """
    from ..personality.types import Personality, Mood

    # Aggressive personalities more likely to start beef
    aggressive_personalities = [Personality.FERAL, Personality.MENACE]

    # Certain moods trigger beef
    beef_moods = [Mood.FERAL, Mood.UNHINGED]

    # High chance if feral personality and aggressive mood
    if character.personality in aggressive_personalities:
        if character.mood in beef_moods:
            return True
        # 30% chance even in normal mood
        import random
        return random.random() < 0.3

    # SCHIZO characters randomly beef
    if character.personality == Personality.SCHIZO:
        import random
        return random.random() < 0.2

    return False
