"""Main entry point for ALIVE AI Agent."""

import asyncio
import httpx
from datetime import datetime
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import structlog

from .config import settings
from .personality.types import (
    CharacterContext,
    Personality,
    Mood,
    get_mood_from_vitality,
)
from .generation.tweets import (
    generate_tweet,
    generate_beef_tweet,
    generate_battle_commentary,
)
from .twitter.client import twitter_client
from .beef.detector import (
    detect_beef_keywords,
    detect_alliance_keywords,
    analyze_interaction,
    should_auto_beef,
)
from .battles.resolver import resolve_round, calculate_battle_winner


# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.dev.ConsoleRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

log = structlog.get_logger()


class AliveAgent:
    """Main AI agent for ALIVE characters."""

    def __init__(self):
        """Initialize the agent."""
        self.scheduler = AsyncIOScheduler()
        self.http_client = httpx.AsyncClient(
            base_url=settings.backend_url,
            headers={"X-API-Key": settings.internal_api_key},
            timeout=30.0,
        )
        self.last_mention_id: Optional[str] = None
        self.active_characters: dict[str, CharacterContext] = {}

    async def start(self):
        """Start the agent scheduler."""
        log.info("Starting ALIVE AI Agent")

        # Schedule regular jobs
        self.scheduler.add_job(
            self.tweet_cycle,
            IntervalTrigger(minutes=settings.tweet_interval_minutes),
            id="tweet_cycle",
            name="Generate and post tweets",
        )

        self.scheduler.add_job(
            self.check_vitality,
            IntervalTrigger(minutes=settings.vitality_check_interval_minutes),
            id="vitality_check",
            name="Check vitality and update moods",
        )

        self.scheduler.add_job(
            self.beef_detection,
            IntervalTrigger(minutes=settings.beef_detection_interval_minutes),
            id="beef_detection",
            name="Detect beef and alliances",
        )

        # Start scheduler
        self.scheduler.start()

        # Initial load of characters
        await self.load_characters()

        log.info("Agent started", jobs=len(self.scheduler.get_jobs()))

        # Keep running
        try:
            while True:
                await asyncio.sleep(60)
        except (KeyboardInterrupt, SystemExit):
            await self.stop()

    async def stop(self):
        """Stop the agent gracefully."""
        log.info("Stopping ALIVE AI Agent")
        self.scheduler.shutdown()
        await self.http_client.aclose()

    async def load_characters(self):
        """Load all active characters from backend."""
        try:
            response = await self.http_client.get("/api/characters")
            if response.status_code == 200:
                characters = response.json()
                for char in characters:
                    ctx = self._parse_character(char)
                    if ctx:
                        self.active_characters[ctx.ticker] = ctx

                log.info("Loaded characters", count=len(self.active_characters))
            else:
                log.error("Failed to load characters", status=response.status_code)

        except Exception as e:
            log.error("Error loading characters", error=str(e))

    def _parse_character(self, data: dict) -> Optional[CharacterContext]:
        """Parse character data from backend into CharacterContext."""
        try:
            personality = Personality(data.get("personality", "ALPHA"))
            vitality = data.get("vitality", 5000)
            mood = get_mood_from_vitality(vitality, personality)

            return CharacterContext(
                name=data["name"],
                ticker=data["ticker"],
                personality=personality,
                mood=mood,
                vitality=vitality,
                holders=data.get("holders", 0),
                market_cap=data.get("marketCap", "$0"),
                bio=data.get("bio", ""),
                recent_trades=data.get("recentTrades", []),
                relationships=data.get("relationships", []),
                battle_status=data.get("battleStatus"),
                last_tweet=data.get("lastTweet"),
            )
        except Exception as e:
            log.error("Error parsing character", data=data, error=str(e))
            return None

    async def tweet_cycle(self):
        """Generate and post tweets for all characters."""
        log.info("Starting tweet cycle")

        for ticker, ctx in self.active_characters.items():
            try:
                # Refresh character data
                response = await self.http_client.get(f"/api/characters/{ticker}")
                if response.status_code == 200:
                    ctx = self._parse_character(response.json())
                    if ctx:
                        self.active_characters[ticker] = ctx

                # Determine tweet type based on state
                tweet_type = self._determine_tweet_type(ctx)

                # Generate tweet
                tweet = await generate_tweet(ctx, tweet_type)

                # Post tweet
                tweet_id = await twitter_client.post_tweet(tweet)

                if tweet_id:
                    # Record tweet in backend
                    await self.http_client.post(
                        f"/api/characters/{ticker}/tweets",
                        json={"content": tweet, "tweetId": tweet_id},
                    )

                log.info(
                    "Posted tweet",
                    ticker=ticker,
                    type=tweet_type,
                    tweet=tweet[:50],
                )

                # Stagger tweets
                await asyncio.sleep(5)

            except Exception as e:
                log.error("Error in tweet cycle", ticker=ticker, error=str(e))

    def _determine_tweet_type(self, ctx: CharacterContext) -> str:
        """Determine what type of tweet to generate based on character state."""
        # Dying
        if ctx.vitality < 500:
            return "dying"

        # In battle
        if ctx.battle_status:
            return "battle"

        # Pumping (vitality high and increasing)
        if ctx.vitality > 8000:
            return "pumping"

        # Dumping (vitality low and recent sells)
        if ctx.vitality < 3000:
            recent_sells = sum(
                1 for t in ctx.recent_trades
                if t.get("type") == "sell"
            )
            if recent_sells > 2:
                return "dumping"

        # Check for beef relationships
        has_beef = any(
            r.get("type") == "beef"
            for r in ctx.relationships
        )
        if has_beef and ctx.mood in [Mood.FERAL, Mood.UNHINGED]:
            return "beef"

        return "general"

    async def check_vitality(self):
        """Check vitality levels and update moods."""
        log.info("Checking vitality levels")

        for ticker, ctx in self.active_characters.items():
            try:
                # Get fresh vitality from backend
                response = await self.http_client.get(
                    f"/api/characters/{ticker}/vitality"
                )
                if response.status_code == 200:
                    data = response.json()
                    new_vitality = data.get("vitality", ctx.vitality)

                    # Update mood based on new vitality
                    new_mood = get_mood_from_vitality(new_vitality, ctx.personality)

                    # Check for significant changes
                    if new_mood != ctx.mood:
                        log.info(
                            "Mood changed",
                            ticker=ticker,
                            old_mood=ctx.mood.value,
                            new_mood=new_mood.value,
                            vitality=new_vitality,
                        )

                    # Update local state
                    ctx.vitality = new_vitality
                    ctx.mood = new_mood

                    # Critical vitality alert
                    if new_vitality < 500 and ctx.vitality >= 500:
                        log.warning(
                            "Character entering critical vitality!",
                            ticker=ticker,
                            vitality=new_vitality,
                        )
                        # Trigger dying tweet
                        tweet = await generate_tweet(ctx, "dying")
                        await twitter_client.post_tweet(tweet)

            except Exception as e:
                log.error("Error checking vitality", ticker=ticker, error=str(e))

    async def beef_detection(self):
        """Detect beef and alliances from mentions and interactions."""
        log.info("Running beef detection")

        if not twitter_client.is_configured:
            log.debug("Twitter not configured, skipping beef detection")
            return

        try:
            # Get mentions since last check
            mentions = await twitter_client.get_mentions(
                since_id=self.last_mention_id,
            )

            if mentions:
                self.last_mention_id = mentions[0]["id"]

            # Get all tickers for keyword detection
            all_tickers = list(self.active_characters.keys())

            for mention in mentions:
                tweet_text = mention["text"]

                # Check for beef keywords
                beef_targets = await detect_beef_keywords(tweet_text, all_tickers)
                for target in beef_targets:
                    if target in self.active_characters:
                        log.info(
                            "Potential beef detected",
                            target=target,
                            tweet=tweet_text[:100],
                        )
                        # TODO: Update relationship in backend

                # Check for alliance keywords
                alliance_targets = await detect_alliance_keywords(tweet_text, all_tickers)
                for target in alliance_targets:
                    if target in self.active_characters:
                        log.info(
                            "Potential alliance detected",
                            target=target,
                            tweet=tweet_text[:100],
                        )
                        # TODO: Update relationship in backend

        except Exception as e:
            log.error("Error in beef detection", error=str(e))

    async def handle_battle_round(
        self,
        battle_id: int,
        round_number: int,
        character_a_ticker: str,
        character_b_ticker: str,
        pool_a: float,
        pool_b: float,
    ):
        """Handle a battle round resolution."""
        log.info(
            "Resolving battle round",
            battle_id=battle_id,
            round=round_number,
        )

        char_a = self.active_characters.get(character_a_ticker)
        char_b = self.active_characters.get(character_b_ticker)

        if not char_a or not char_b:
            log.error("Characters not found for battle")
            return

        # Resolve the round
        result = await resolve_round(
            round_number=round_number,
            character_a=char_a,
            character_b=char_b,
            pool_a=pool_a,
            pool_b=pool_b,
        )

        # Generate commentary tweets
        winner_ctx = char_a if result.winner_address == char_a.ticker else char_b
        loser_ctx = char_b if result.winner_address == char_a.ticker else char_a

        winner_tweet = await generate_battle_commentary(
            winner_ctx, round_number, won_round=True, opponent_name=loser_ctx.name
        )
        loser_tweet = await generate_battle_commentary(
            loser_ctx, round_number, won_round=False, opponent_name=winner_ctx.name
        )

        # Post tweets
        await twitter_client.post_tweet(winner_tweet)
        await asyncio.sleep(2)
        await twitter_client.post_tweet(loser_tweet)

        # Report to backend
        await self.http_client.post(
            f"/api/battles/{battle_id}/rounds",
            json={
                "roundNumber": round_number,
                "winnerAddress": result.winner_address,
                "narrative": result.narrative,
            },
        )

        log.info(
            "Battle round resolved",
            winner=result.winner_name,
            loser=result.loser_name,
        )


async def main():
    """Main entry point."""
    agent = AliveAgent()
    await agent.start()


if __name__ == "__main__":
    asyncio.run(main())
