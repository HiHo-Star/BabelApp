"""
BabelBot Agent Service - Main Entry Point
Construction/Building Domain Expert Chatbot
"""

import logging
import sys
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config.settings import settings
from src.api.endpoints import router

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
    logger.info("Starting BabelBot Agent Service...")
    logger.info(f"Host: {settings.HOST}:{settings.PORT}")
    logger.info(f"Gemini Model: {settings.GEMINI_MODEL}")

    # Check Gemini availability
    from src.services.response_formatter import response_formatter
    if response_formatter.model:
        logger.info("Gemini model initialized successfully")
    else:
        logger.warning("Gemini not available - service degraded")

    logger.info("BabelBot Agent Service startup complete")

    yield

    # Shutdown
    logger.info("Shutting down BabelBot Agent Service...")


# Create FastAPI app
app = FastAPI(
    title="BabelBot Agent Service",
    description="Gemini-based construction/building domain expert chatbot",
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
app.include_router(router, prefix="", tags=["BabelBot Agent"])


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        log_level=settings.LOG_LEVEL.lower(),
    )

