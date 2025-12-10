"""
Data cache for TaskManagement Agent
Caches backend API data to reduce polling frequency
"""

import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import httpx
from ..config.settings import settings

logger = logging.getLogger(__name__)


class DataCache:
    """Cache for backend API data"""

    def __init__(self):
        self.data: Optional[Dict[str, Any]] = None
        self.last_update: Optional[datetime] = None
        self.lock = asyncio.Lock()

    async def get_data(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Get cached data, refresh if needed"""
        async with self.lock:
            now = datetime.now()
            
            # Check if cache is valid
            if (
                not force_refresh
                and self.data
                and self.last_update
                and (now - self.last_update).total_seconds() < settings.DATA_CACHE_TTL
            ):
                logger.debug("Using cached data")
                return self.data

            # Refresh data from backend
            logger.info("Refreshing data from backend API")
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(
                        f"{settings.BACKEND_API_URL}/api/taskmanagement/data"
                    )
                    response.raise_for_status()
                    result = response.json()
                    
                    if result.get("success"):
                        self.data = result.get("data", {})
                        self.last_update = now
                        logger.info("✅ Data cache refreshed successfully")
                        return self.data
                    else:
                        logger.error(f"Backend API returned error: {result.get('error')}")
                        # Return cached data if available, even if stale
                        if self.data:
                            logger.warning("Using stale cached data due to API error")
                            return self.data
                        raise Exception(f"Backend API error: {result.get('error')}")
            except Exception as e:
                logger.error(f"Failed to refresh data cache: {e}")
                # Return cached data if available, even if stale
                if self.data:
                    logger.warning("Using stale cached data due to refresh failure")
                    return self.data
                raise

    async def start_polling(self):
        """Start background polling task"""
        logger.info(f"Starting data polling (interval: {settings.DATA_POLL_INTERVAL}s)")
        
        while True:
            try:
                await self.get_data(force_refresh=True)
            except Exception as e:
                logger.error(f"Error in polling task: {e}")
            
            await asyncio.sleep(settings.DATA_POLL_INTERVAL)


# Global cache instance
data_cache = DataCache()

