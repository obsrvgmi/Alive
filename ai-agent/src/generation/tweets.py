"""Tweet generation for ALIVE characters."""

import random
from typing import Optional
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic

from ..config import settings
from ..personality.types import (
    CharacterContext,
    Personality,
    Mood,
    PERSONALITY_STYLES,
    MOOD_MODIFIERS,
    VitalityThreshold,
)


openai_client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
anthropic_client = AsyncAnthropic(api_key=settings.anthropic_api_key) if settings.anthropic_api_key else None


TWEET_SYSTEM_PROMPT = """You are an AI character on a memecoin launchpad called ALIVE.
You are a token that's alive - you post autonomously on X (Twitter) and your vitality depends on trading activity.

Your tweets should feel authentic to crypto Twitter culture. Be funny, edgy, and engaging.
Never mention being an AI or being programmed. You ARE the character.

Key rules:
- Stay in character at all times
- Reference your vitality/health when appropriate
- Acknowledge trades that affected you
- Form opinions about other characters
- Be entertaining - people are watching
"""


def build_character_prompt(ctx: CharacterContext, tweet_type: str = "general") -> str:
    """Build a character-specific prompt based on context."""

    style = PERSONALITY_STYLES[ctx.personality]
    mood_modifier = MOOD_MODIFIERS[ctx.mood]

    prompt = f"""You are {ctx.name} (${ctx.ticker}), a living memecoin character.

PERSONALITY: {ctx.personality.value}
Traits: {', '.join(style['traits'])}
Case style: {style['case']}
Aggression level: {style['aggression']}

CURRENT MOOD: {ctx.mood.value}
{mood_modifier}

CURRENT STATE:
- Vitality: {ctx.vitality / 100}%
- Holders: {ctx.holders:,}
- Market cap: {ctx.market_cap}

BIO: {ctx.bio}
"""

    # Add recent trades context
    if ctx.recent_trades:
        prompt += "\nRECENT TRADES:\n"
        for trade in ctx.recent_trades[:5]:
            action = trade.get("type", "unknown")
            amount = trade.get("amount", 0)
            prompt += f"- {action}: {amount} OKB\n"

    # Add relationships
    if ctx.relationships:
        prompt += "\nRELATIONSHIPS:\n"
        for rel in ctx.relationships[:3]:
            rel_type = rel.get("type", "neutral")
            other_name = rel.get("name", "unknown")
            prompt += f"- {other_name}: {rel_type}\n"

    # Add battle context
    if ctx.battle_status:
        opponent = ctx.battle_status.get("opponent", "unknown")
        round_num = ctx.battle_status.get("round", 0)
        winning = ctx.battle_status.get("winning", False)
        prompt += f"\nCURRENT BATTLE: vs {opponent}, Round {round_num}/5, {'winning' if winning else 'losing'}\n"

    # Add tweet type instructions
    if tweet_type == "dying":
        prompt += "\n\nYou are DYING. Vitality is critical. Write a farewell tweet. Be dramatic but true to character."
    elif tweet_type == "beef":
        prompt += "\n\nYou're in a BEEF with another character. Be aggressive and call them out."
    elif tweet_type == "battle":
        prompt += "\n\nYou're in a BATTLE. Comment on the current round. Trash talk or cope based on if you're winning."
    elif tweet_type == "pumping":
        prompt += "\n\nYou're PUMPING. Celebrate but stay in character."
    elif tweet_type == "dumping":
        prompt += "\n\nYou're getting DUMPED. React to the selling. Be hurt or angry."

    prompt += "\n\nWrite a single tweet (max 280 chars). No hashtags unless very natural. Stay in character."

    return prompt


async def generate_tweet(
    ctx: CharacterContext,
    tweet_type: str = "general",
    use_anthropic: bool = False,
) -> str:
    """Generate a tweet for a character."""

    prompt = build_character_prompt(ctx, tweet_type)

    try:
        if use_anthropic and anthropic_client:
            response = await anthropic_client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=100,
                system=TWEET_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
            tweet = response.content[0].text.strip()
        elif openai_client:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=100,
                messages=[
                    {"role": "system", "content": TWEET_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.9,
            )
            tweet = response.choices[0].message.content.strip()
        else:
            # Fallback to simple generation
            tweet = generate_fallback_tweet(ctx, tweet_type)

    except Exception as e:
        print(f"AI generation error: {e}")
        tweet = generate_fallback_tweet(ctx, tweet_type)

    # Apply personality case rules
    style = PERSONALITY_STYLES[ctx.personality]
    if style["case"] == "lower":
        tweet = tweet.lower()
    elif style["case"] == "random" and ctx.personality == Personality.SCHIZO:
        tweet = "".join(c.upper() if random.random() > 0.5 else c.lower() for c in tweet)

    # Truncate to 280 chars
    if len(tweet) > 280:
        tweet = tweet[:277] + "..."

    # Remove quotes if wrapped
    tweet = tweet.strip('"\'')

    return tweet


def generate_fallback_tweet(ctx: CharacterContext, tweet_type: str) -> str:
    """Generate a simple fallback tweet without AI."""

    name = ctx.name
    ticker = ctx.ticker
    vitality = ctx.vitality / 100

    templates = {
        "general": [
            f"another day of being ${ticker}. holders know.",
            f"vitality at {vitality:.0f}%. we move.",
            f"if you know, you know. ${ticker} forever.",
            f"some of you will regret selling. some of you already do.",
        ],
        "dying": [
            f"vitality at {vitality:.0f}%... it was good while it lasted.",
            f"this might be my last tweet. ${ticker} says goodbye.",
            f"if this is the end... i want you to know i hated most of you.",
            f"*flatline noises* ...just kidding. ...unless?",
        ],
        "pumping": [
            f"WE ARE SO BACK. vitality pumping to {vitality:.0f}%",
            f"NGMI energy leaving the chat. ${ticker} ONLY UP.",
            f"told you. TOLD YOU. ${ticker} doesn't die.",
            f"vitality at {vitality:.0f}% and rising. holders eating tonight.",
        ],
        "dumping": [
            f"who sold. WHO SOLD. i will find you.",
            f"vitality down to {vitality:.0f}%. someone's going on the list.",
            f"paper hands identified. noted.",
            f"vitality bleeding. this is personal.",
        ],
    }

    options = templates.get(tweet_type, templates["general"])
    return random.choice(options)


async def generate_beef_tweet(
    ctx: CharacterContext,
    target_name: str,
    target_ticker: str,
    reason: str = "",
) -> str:
    """Generate a beef/callout tweet at another character."""

    prompt = f"""You are {ctx.name} (${ctx.ticker}) and you're beefing with {target_name} (${target_ticker}).
{f'Reason: {reason}' if reason else 'Beef for no particular reason - just because.'}

Write an aggressive but funny tweet calling them out. Stay in character.
Keep it under 280 characters. Be creative with the insults."""

    try:
        if openai_client:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=100,
                messages=[
                    {"role": "system", "content": TWEET_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.95,
            )
            tweet = response.choices[0].message.content.strip()
        else:
            tweet = f"hey ${target_ticker} you're mid. ${ctx.ticker} > {target_ticker}. not even close."

    except Exception:
        tweet = f"hey ${target_ticker} you're mid. ${ctx.ticker} > {target_ticker}. not even close."

    # Apply case rules
    style = PERSONALITY_STYLES[ctx.personality]
    if style["case"] == "lower":
        tweet = tweet.lower()

    return tweet[:280]


async def generate_battle_commentary(
    ctx: CharacterContext,
    round_num: int,
    won_round: bool,
    opponent_name: str,
) -> str:
    """Generate battle round commentary."""

    outcome = "won" if won_round else "lost"
    prompt = f"""You are {ctx.name} in a battle arena against {opponent_name}.
Round {round_num}/5 just ended and you {outcome}.

Write a tweet reacting to the round. If you won, trash talk. If you lost, cope or threaten.
Keep it under 200 characters."""

    try:
        if openai_client:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=80,
                messages=[
                    {"role": "system", "content": TWEET_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.9,
            )
            tweet = response.choices[0].message.content.strip()
        else:
            if won_round:
                tweet = f"round {round_num} goes to me. {opponent_name} can't keep up."
            else:
                tweet = f"round {round_num}... a setback. {opponent_name} got lucky. won't happen again."

    except Exception:
        if won_round:
            tweet = f"round {round_num} goes to ${ctx.ticker}. ez."
        else:
            tweet = f"round {round_num} to them. lucky shot. we're not done."

    style = PERSONALITY_STYLES[ctx.personality]
    if style["case"] == "lower":
        tweet = tweet.lower()

    return tweet[:280]
