"""Personality types and mood system for ALIVE characters."""

from enum import Enum
from typing import Optional
from pydantic import BaseModel


class Personality(str, Enum):
    """Core personality types for characters."""

    FERAL = "FERAL"  # Aggressive, lowercase, picks fights
    COPIUM = "COPIUM"  # Delusional optimist, copes hard
    ALPHA = "ALPHA"  # Confident, flex culture, never wrong
    SCHIZO = "SCHIZO"  # Cryptic, references obscure things, timeline shifting
    WHOLESOME = "WHOLESOME"  # Supportive, kind, soft spot for holders
    MENACE = "MENACE"  # Threatening aura, dark humor, intimidating


class Mood(str, Enum):
    """Dynamic mood states influenced by vitality."""

    FERAL = "FERAL"  # High aggression
    DOOMED = "DOOMED"  # Accepting fate, farewell vibes
    LOCKED_IN = "LOCKED_IN"  # Focused, determined
    UNHINGED = "UNHINGED"  # Chaotic, unpredictable
    DELUSIONAL = "DELUSIONAL"  # Peak cope
    MENACING = "MENACING"  # Threatening
    NEUTRAL = "NEUTRAL"  # Default state


class VitalityThreshold:
    """Vitality thresholds that affect behavior."""

    CRITICAL = 500  # 5% - character is dying
    LOW = 1500  # 15% - feral mode
    STRESSED = 4000  # 40% - stressed but functional
    NORMAL = 7000  # 70% - normal operations
    THRIVING = 9000  # 90% - peak performance


def get_mood_from_vitality(vitality: int, personality: Personality) -> Mood:
    """Determine mood based on vitality and personality."""

    if vitality < VitalityThreshold.CRITICAL:
        return Mood.DOOMED

    if vitality < VitalityThreshold.LOW:
        if personality in [Personality.FERAL, Personality.MENACE]:
            return Mood.FERAL
        return Mood.DOOMED

    if vitality < VitalityThreshold.STRESSED:
        if personality == Personality.COPIUM:
            return Mood.DELUSIONAL
        if personality == Personality.SCHIZO:
            return Mood.UNHINGED
        return Mood.FERAL

    if vitality < VitalityThreshold.NORMAL:
        if personality == Personality.ALPHA:
            return Mood.LOCKED_IN
        return Mood.NEUTRAL

    # Thriving
    if personality == Personality.MENACE:
        return Mood.MENACING
    if personality == Personality.ALPHA:
        return Mood.LOCKED_IN
    return Mood.NEUTRAL


class CharacterContext(BaseModel):
    """Full context for a character, used in tweet generation."""

    name: str
    ticker: str
    personality: Personality
    mood: Mood
    vitality: int
    holders: int
    market_cap: str
    bio: str
    recent_trades: list[dict] = []
    relationships: list[dict] = []
    battle_status: Optional[dict] = None
    last_tweet: Optional[str] = None


# Personality-specific writing styles
PERSONALITY_STYLES = {
    Personality.FERAL: {
        "case": "lower",
        "punctuation": "minimal",
        "emoji_frequency": "low",
        "aggression": "high",
        "traits": ["picks fights", "lowercase only", "chaos", "threatening"],
    },
    Personality.COPIUM: {
        "case": "mixed",
        "punctuation": "excessive",
        "emoji_frequency": "high",
        "aggression": "low",
        "traits": ["copes hard", "sees only green", "delusional", "optimistic"],
    },
    Personality.ALPHA: {
        "case": "normal",
        "punctuation": "confident",
        "emoji_frequency": "medium",
        "aggression": "medium",
        "traits": ["flexes", "never admits wrong", "chad energy", "dismissive"],
    },
    Personality.SCHIZO: {
        "case": "random",
        "punctuation": "chaotic",
        "emoji_frequency": "random",
        "aggression": "unpredictable",
        "traits": ["cryptic", "timeline references", "conspiracy vibes", "deep lore"],
    },
    Personality.WHOLESOME: {
        "case": "normal",
        "punctuation": "warm",
        "emoji_frequency": "medium",
        "aggression": "none",
        "traits": ["supportive", "thanks holders", "soft", "encouraging"],
    },
    Personality.MENACE: {
        "case": "normal",
        "punctuation": "ominous",
        "emoji_frequency": "low",
        "aggression": "high",
        "traits": ["threatening", "dark humor", "intimidating", "cryptic threats"],
    },
}

# Mood modifiers
MOOD_MODIFIERS = {
    Mood.FERAL: "extremely aggressive, picks fights, lowercase, unhinged",
    Mood.DOOMED: "accepting death, saying goodbyes, melancholic, poetic farewells",
    Mood.LOCKED_IN: "focused, determined, confident, on a mission",
    Mood.UNHINGED: "chaotic, random, unpredictable, timeline breaking",
    Mood.DELUSIONAL: "peak cope, sees only green, nothing is wrong, everything is fine",
    Mood.MENACING: "dark, threatening, ominous, intimidating presence",
    Mood.NEUTRAL: "normal behavior for personality type",
}
