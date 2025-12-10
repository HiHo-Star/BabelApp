"""
TaskManagement Agent Service - Main Entry Point
AI-powered task extraction and management from natural language
"""

import logging
import sys
import asyncio
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config.settings import settings
from src.api.endpoints import router
from src.database.connection import db
from src.database.cache import data_cache

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    logger.info("Starting TaskManagement Agent Service...")
    logger.info(f"Host: {settings.HOST}:{settings.PORT}")
    logger.info(f"Gemini Model: {settings.GEMINI_MODEL}")
    logger.info(f"Backend API: {settings.BACKEND_API_URL}")

    try:
        # Connect to database
        await db.connect()
        logger.info("✅ Database connected")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
        raise

    # Initialize data cache and start polling
    try:
        # Initial data load
        await data_cache.get_data(force_refresh=True)
        logger.info("✅ Initial data cache loaded")
        
        # Start background polling task
        asyncio.create_task(data_cache.start_polling())
        logger.info("✅ Data polling started")
    except Exception as e:
        logger.warning(f"⚠️ Data cache initialization failed: {e}")
        logger.warning("Service will continue but may have limited functionality")

    # Check Gemini availability
    try:
        from src.services.task_extractor import task_extractor
        if task_extractor.model:
            logger.info("✅ Gemini model initialized successfully")
        else:
            logger.warning("⚠️ Gemini not available - service degraded")
    except Exception as e:
        logger.warning(f"⚠️ Gemini initialization warning: {e}")

    logger.info("TaskManagement Agent Service startup complete")

    yield

    # Shutdown
    logger.info("Shutting down TaskManagement Agent Service...")
    await db.disconnect()
    logger.info("TaskManagement Agent Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="TaskManagement Agent Service",
    description="AI-powered task extraction and management from natural language",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="", tags=["TaskManagement Agent"])


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        log_level=settings.LOG_LEVEL.lower(),
    )

