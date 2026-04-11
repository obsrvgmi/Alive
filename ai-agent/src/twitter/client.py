"""Twitter/X API client for posting character tweets."""

import tweepy
from typing import Optional
from ..config import settings


class TwitterClient:
    """Client for posting tweets as ALIVE characters."""

    def __init__(self):
        """Initialize Twitter client with credentials."""
        self.client: Optional[tweepy.Client] = None
        self.api: Optional[tweepy.API] = None
        self._initialize()

    def _initialize(self):
        """Set up Twitter API clients."""
        if not all([
            settings.twitter_api_key,
            settings.twitter_api_secret,
            settings.twitter_access_token,
            settings.twitter_access_secret,
        ]):
            print("Twitter credentials not configured - running in mock mode")
            return

        # v2 Client for posting tweets
        self.client = tweepy.Client(
            bearer_token=settings.twitter_bearer_token,
            consumer_key=settings.twitter_api_key,
            consumer_secret=settings.twitter_api_secret,
            access_token=settings.twitter_access_token,
            access_token_secret=settings.twitter_access_secret,
            wait_on_rate_limit=True,
        )

        # v1.1 API for some operations
        auth = tweepy.OAuth1UserHandler(
            settings.twitter_api_key,
            settings.twitter_api_secret,
            settings.twitter_access_token,
            settings.twitter_access_secret,
        )
        self.api = tweepy.API(auth, wait_on_rate_limit=True)

    @property
    def is_configured(self) -> bool:
        """Check if Twitter client is properly configured."""
        return self.client is not None

    async def post_tweet(
        self,
        text: str,
        reply_to: Optional[str] = None,
        quote_tweet_id: Optional[str] = None,
    ) -> Optional[str]:
        """
        Post a tweet and return the tweet ID.

        Args:
            text: Tweet content (max 280 chars)
            reply_to: Tweet ID to reply to
            quote_tweet_id: Tweet ID to quote

        Returns:
            Tweet ID if successful, None otherwise
        """
        if not self.client:
            print(f"[MOCK TWEET] {text}")
            return "mock_tweet_id"

        try:
            response = self.client.create_tweet(
                text=text[:280],
                in_reply_to_tweet_id=reply_to,
                quote_tweet_id=quote_tweet_id,
            )
            tweet_id = response.data["id"]
            print(f"Posted tweet {tweet_id}: {text[:50]}...")
            return tweet_id

        except tweepy.TweepyException as e:
            print(f"Failed to post tweet: {e}")
            return None

    async def get_mentions(
        self,
        since_id: Optional[str] = None,
        max_results: int = 100,
    ) -> list[dict]:
        """
        Get recent mentions of the authenticated account.

        Args:
            since_id: Only get mentions after this tweet ID
            max_results: Maximum number of mentions to return

        Returns:
            List of mention data dicts
        """
        if not self.client:
            return []

        try:
            # Get authenticated user ID
            me = self.client.get_me()
            user_id = me.data.id

            response = self.client.get_users_mentions(
                id=user_id,
                since_id=since_id,
                max_results=min(max_results, 100),
                tweet_fields=["author_id", "created_at", "conversation_id"],
            )

            if not response.data:
                return []

            return [
                {
                    "id": tweet.id,
                    "text": tweet.text,
                    "author_id": tweet.author_id,
                    "created_at": tweet.created_at,
                    "conversation_id": tweet.conversation_id,
                }
                for tweet in response.data
            ]

        except tweepy.TweepyException as e:
            print(f"Failed to get mentions: {e}")
            return []

    async def search_tweets(
        self,
        query: str,
        max_results: int = 100,
        since_id: Optional[str] = None,
    ) -> list[dict]:
        """
        Search for recent tweets matching a query.

        Args:
            query: Search query
            max_results: Maximum results to return
            since_id: Only get tweets after this ID

        Returns:
            List of tweet data dicts
        """
        if not self.client:
            return []

        try:
            response = self.client.search_recent_tweets(
                query=query,
                max_results=min(max_results, 100),
                since_id=since_id,
                tweet_fields=["author_id", "created_at", "public_metrics"],
            )

            if not response.data:
                return []

            return [
                {
                    "id": tweet.id,
                    "text": tweet.text,
                    "author_id": tweet.author_id,
                    "created_at": tweet.created_at,
                    "metrics": tweet.public_metrics,
                }
                for tweet in response.data
            ]

        except tweepy.TweepyException as e:
            print(f"Failed to search tweets: {e}")
            return []

    async def get_user_by_username(self, username: str) -> Optional[dict]:
        """Get user data by username."""
        if not self.client:
            return None

        try:
            response = self.client.get_user(
                username=username,
                user_fields=["id", "name", "username", "description"],
            )

            if not response.data:
                return None

            return {
                "id": response.data.id,
                "name": response.data.name,
                "username": response.data.username,
                "description": response.data.description,
            }

        except tweepy.TweepyException as e:
            print(f"Failed to get user: {e}")
            return None


# Global client instance
twitter_client = TwitterClient()
